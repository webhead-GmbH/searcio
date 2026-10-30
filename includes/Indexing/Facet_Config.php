<?php
/**
 * Local mirror of Searcio's `search-config.facet_fields`, and the filters the
 * search window is told about.
 *
 * Like {@see Language_Config}, this never calls the Searcio API itself: the
 * storefront config reads it on every page that prints the search window.
 * {@see \Webhead\WP\SearchCloud\Routing\Search_Config_Endpoint} refreshes the
 * mirror whenever an admin reads or writes the search configuration.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use Webhead\WP\SearchCloud\DTO\Attribute_Swatches;
use Webhead\WP\SearchCloud\DTO\Storefront_Facet;
use Webhead\WP\SearchCloud\Enums\Category_Filter;
use Webhead\WP\SearchCloud\Enums\Facet_Display;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Facet_Config {
	/** The field the plugin writes a post's categories to. */
	private const CATEGORY_FIELD = 'categories';

	/** The taxonomies that field is read from. */
	private const CATEGORY_TAXONOMIES = [ Woo::CATEGORY_TAXONOMY, 'category' ];

	public function __construct(
		private Settings_Manager $settings,
		private Index_Config $index_config,
		private Woo $woo
	) {}

	/**
	 * The facet fields, in the order Search Config lists them. Empty until an
	 * admin has opened Search Config once.
	 *
	 * @return array<int,string>
	 */
	public function fields(): array {
		$stored = $this->settings->get( Plugin_Settings::FACET_FIELDS );

		return is_array( $stored ) ? $this->clean( $stored ) : [];
	}

	public function set_fields( mixed $fields ): void {
		$this->settings->set( Plugin_Settings::FACET_FIELDS, is_array( $fields ) ? $this->clean( $fields ) : [] );
	}

	/**
	 * The filters of the search window, in order, each with how its values are
	 * drawn and, for an attribute a swatches plugin dresses, the colour, image
	 * or label of each value in the language of the current request. The
	 * category filter comes with the shop's tree when the Search Config tab
	 * asks for one.
	 *
	 * How a field is drawn is the storefront's to decide (`auto`) unless the
	 * attribute's type says or a shop does, through
	 * `webhead_search_cloud/storefront/facet_display`, which is given that and
	 * the field and answers `list`, `tiles`, `color`, `image` or `range`.
	 * Colours and images can be given or corrected through
	 * `webhead_search_cloud/storefront/facet_colors` and
	 * `webhead_search_cloud/storefront/facet_images`, which are given the value
	 * => hex or address map, the field and its taxonomy (empty when it has
	 * none).
	 *
	 * @return array<int,Storefront_Facet>
	 */
	public function storefront(): array {
		$fields = $this->fields();

		if ( [] === $fields ) {
			return [];
		}

		$taxonomies = $this->index_config->attribute_taxonomies();
		$facets     = [];

		foreach ( $fields as $order => $field ) {
			$taxonomy = $taxonomies[ $field ] ?? '';
			$swatches = '' === $taxonomy ? new Attribute_Swatches() : $this->woo->attribute_swatches( $taxonomy );
			$display  = Facet_Display::from_storage(
				apply_filters( 'webhead_search_cloud/storefront/facet_display', $swatches->display->value, $field )
			);
			$colors   = apply_filters( 'webhead_search_cloud/storefront/facet_colors', $swatches->colors, $field, $taxonomy );
			$images   = apply_filters( 'webhead_search_cloud/storefront/facet_images', $swatches->images, $field, $taxonomy );

			$facets[] = new Storefront_Facet(
				$field,
				$order,
				$display,
				$this->colors( $colors ),
				$this->colors( $swatches->second_colors ),
				$this->images( $images ),
				$swatches->labels,
				self::CATEGORY_FIELD === $field ? $this->category_tree() : null
			);
		}

		return $facets;
	}

	/**
	 * The levels the category filter shows and each category's parent, or null
	 * for the list a search answers with. The main categories alone are a tree
	 * of one level.
	 *
	 * @return array{depth:int,parents:array<string,string>}|null
	 */
	private function category_tree(): ?array {
		$mode = Category_Filter::from_storage( $this->settings->get( Plugin_Settings::CATEGORY_FILTER ) );

		if ( Category_Filter::All === $mode ) {
			return null;
		}

		return [
			'depth'   => Category_Filter::Main === $mode ? 1 : max( 1, (int) $this->settings->get( Plugin_Settings::CATEGORY_FILTER_DEPTH ) ),
			'parents' => $this->category_parents(),
		];
	}

	/**
	 * Category name => the name of its parent, in the language of the current
	 * request. A search answers with names, so two categories of one name are
	 * one value: it is a main category if either is, and under the first
	 * parent otherwise.
	 *
	 * @return array<string,string>
	 */
	private function category_parents(): array {
		$parents = [];
		$roots   = [];

		foreach ( self::CATEGORY_TAXONOMIES as $taxonomy ) {
			$terms = taxonomy_exists( $taxonomy ) ? get_terms( [ 'taxonomy' => $taxonomy, 'hide_empty' => false, 'update_term_meta_cache' => false ] ) : [];

			if ( ! is_array( $terms ) ) {
				continue;
			}

			$names = [];

			foreach ( $terms as $term ) {
				$names[ $term->term_id ] = Term_Names::decode( $term->name );
			}

			foreach ( $terms as $term ) {
				$parent = $names[ $term->parent ] ?? '';
				$name   = $names[ $term->term_id ];

				if ( '' === $parent || $parent === $name ) {
					$roots[ $name ] = true;
				} elseif ( ! isset( $parents[ $name ] ) ) {
					$parents[ $name ] = $parent;
				}
			}
		}

		return array_diff_key( $parents, $roots );
	}

	/**
	 * @param  array<mixed>  $fields
	 * @return array<int,string>
	 */
	private function clean( array $fields ): array {
		$fields = array_filter( array_map( static fn ( mixed $field ): string => is_string( $field ) ? trim( $field ) : '', $fields ) );

		return array_values( array_unique( $fields ) );
	}

	/**
	 * Only a value with a valid hex colour is kept.
	 *
	 * @return array<string,string>
	 */
	private function colors( mixed $colors ): array {
		if ( ! is_array( $colors ) ) {
			return [];
		}

		$out = [];

		foreach ( $colors as $value => $color ) {
			$color = is_string( $color ) ? sanitize_hex_color( $color ) : null;

			if ( '' !== (string) $value && is_string( $color ) && '' !== $color ) {
				$out[ (string) $value ] = $color;
			}
		}

		return $out;
	}

	/**
	 * Only a value with an address on the web is kept.
	 *
	 * @return array<string,string>
	 */
	private function images( mixed $images ): array {
		if ( ! is_array( $images ) ) {
			return [];
		}

		$out = [];

		foreach ( $images as $value => $image ) {
			$image = is_string( $image ) ? esc_url_raw( $image, [ 'http', 'https' ] ) : '';

			if ( '' !== (string) $value && '' !== $image ) {
				$out[ (string) $value ] = $image;
			}
		}

		return $out;
	}
}
