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
use Webhead\WP\SearchCloud\Enums\Category_Order;
use Webhead\WP\SearchCloud\Enums\Facet_Display;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;
use WP_Term;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Facet_Config {
	/** The field the plugin writes a post's categories to, by name. */
	public const CATEGORY_FIELD = 'categories';

	/** The same categories as paths from the top (see {@see Term_Paths}). */
	public const CATEGORY_PATHS_FIELD = 'category_paths';

	/** The taxonomies that field is read from. */
	private const CATEGORY_TAXONOMIES = [ Woo::CATEGORY_TAXONOMY, 'category' ];

	public function __construct(
		private Settings_Manager $settings,
		private Index_Config $index_config,
		private Swatch_Reader $swatches
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
	 * Keep the fields whose picks a result must all have, from Searcio's
	 * `facet_match` (field => `any` or `all`); a service that does not report
	 * it has none.
	 */
	public function set_match( mixed $match ): void {
		$all = [];

		foreach ( is_array( $match ) ? $match : [] as $field => $mode ) {
			if ( is_string( $field ) && '' !== trim( $field ) && 'all' === $mode ) {
				$all[ trim( $field ) ] = 'all';
			}
		}

		$this->settings->set( Plugin_Settings::FACET_MATCH, $all );
	}

	/**
	 * Whether a result must have every value picked in this field.
	 */
	public function matches_all( string $field ): bool {
		$stored = $this->settings->get( Plugin_Settings::FACET_MATCH );

		return is_array( $stored ) && 'all' === ( $stored[ $field ] ?? '' );
	}

	/**
	 * The filters of the search window, in order, each with how its values are
	 * drawn and, for an attribute a swatches plugin dresses, the colour, image
	 * or label of each value in the language of the current request. The
	 * category filter comes with the shop's tree when the Search Config tab
	 * asks for one, and with the order to list the categories in.
	 *
	 * The category filter is one filter. It is drawn as a tree from
	 * `category_paths` when the site has that facet, since a tree of names has
	 * one "MTS Technik" for three categories of that name, and from
	 * `categories` otherwise. The field it is not drawn from is `hidden`, and
	 * stays a facet field for the quizzes and rules that use it.
	 *
	 * How a field is drawn is the storefront's to decide (`auto`) unless the
	 * attribute's type says or a shop does, through
	 * `searcio_storefront_facet_display`, which is given that and
	 * the field and answers `list`, `tiles`, `color`, `image` or `range`.
	 * Colours and images can be given or corrected through
	 * `searcio_storefront_facet_colors` and
	 * `searcio_storefront_facet_images`, which are given the value
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
		$category   = $this->category_filter( $fields );
		$facets     = [];

		foreach ( $fields as $order => $field ) {
			$taxonomy = $taxonomies[ $field ] ?? '';
			$swatches = '' === $taxonomy ? new Attribute_Swatches() : $this->swatches->read( $taxonomy );
			$display  = Facet_Display::from_storage(
				apply_filters( 'searcio_storefront_facet_display', $swatches->display->value, $field )
			);
			$colors   = apply_filters( 'searcio_storefront_facet_colors', $swatches->colors, $field, $taxonomy );
			$images   = apply_filters( 'searcio_storefront_facet_images', $swatches->images, $field, $taxonomy );

			$facets[] = new Storefront_Facet(
				$field,
				$order,
				$display,
				$this->colors( $colors ),
				$this->colors( $swatches->second_colors ),
				$this->images( $images ),
				$swatches->labels,
				$category[ $field ]['tree'] ?? null,
				$category[ $field ]['hidden'] ?? false,
				$category[ $field ]['sort'] ?? null,
				$category[ $field ]['order'] ?? [],
				$this->matches_all( $field )
			);
		}

		return $facets;
	}

	/**
	 * For each category field among the facet fields: the tree it is drawn as,
	 * or null for one list; whether the filter is drawn from the other one;
	 * and the order of its values. The main categories alone are a tree of
	 * one level.
	 *
	 * @param  array<int,string>  $fields
	 * @return array<string,array{tree:array<string,mixed>|null,hidden:bool,sort:Category_Order,order:array<int,string>}>
	 */
	private function category_filter( array $fields ): array {
		$name_fields = array_intersect_key( $this->index_config->category_fields(), array_flip( $fields ) );
		$has_names   = isset( $name_fields[ self::CATEGORY_FIELD ] );
		$has_paths   = in_array( self::CATEGORY_PATHS_FIELD, $fields, true );

		if ( [] === $name_fields && ! $has_paths ) {
			return [];
		}

		$mode  = Category_Filter::from_storage( $this->settings->get( Plugin_Settings::CATEGORY_FILTER ) );
		$sort  = Category_Order::from_storage( $this->settings->get( Plugin_Settings::CATEGORY_FILTER_ORDER ) );
		$depth = Category_Filter::Main === $mode ? 1 : max( 1, (int) $this->settings->get( Plugin_Settings::CATEGORY_FILTER_DEPTH ) );
		$tree  = Category_Filter::All !== $mode;
		$shop  = Category_Order::Shop === $sort;
		$terms = $tree || $shop ? $this->category_terms() : [];
		$out   = [];

		// The categories by name: the plugin's own field, and any field a
		// mapping writes from a category taxonomy, each from its own terms.
		foreach ( $name_fields as $field => $taxonomies ) {
			$own     = array_intersect_key( $terms, array_flip( $taxonomies ) );
			$replace = self::CATEGORY_FIELD === $field && $has_paths;

			$out[ $field ] = [
				'tree'   => $tree && ! $replace ? [ 'depth' => $depth, 'parents' => $this->category_parents( $own ) ] : null,
				'hidden' => $tree && $replace,
				'sort'   => $sort,
				'order'  => $shop ? $this->category_order( $own, false ) : [],
			];
		}

		if ( $has_paths ) {
			$out[ self::CATEGORY_PATHS_FIELD ] = [
				// Each path holds its parent, so this tree needs no map.
				'tree'   => $tree ? [ 'depth' => $depth, 'paths' => true ] : null,
				'hidden' => ! $tree && $has_names,
				'sort'   => $sort,
				'order'  => $shop ? $this->category_order( $terms, true ) : [],
			];
		}

		return $out;
	}

	/**
	 * Each category taxonomy's terms in the language of the current request,
	 * in the order the shop sorted them: WooCommerce keeps the order its
	 * categories were dragged into as term meta, and reads it for
	 * `menu_order`. A taxonomy WooCommerce does not sort comes by name.
	 *
	 * @return array<string,array<int,WP_Term>>
	 */
	private function category_terms(): array {
		$out = [];

		foreach ( self::CATEGORY_TAXONOMIES as $taxonomy ) {
			$terms = taxonomy_exists( $taxonomy ) ? get_terms( [ 'taxonomy' => $taxonomy, 'orderby' => 'menu_order', 'hide_empty' => false, 'update_term_meta_cache' => false ] ) : [];

			if ( is_array( $terms ) ) {
				$out[ $taxonomy ] = array_values( array_filter( $terms, static fn ( mixed $term ): bool => $term instanceof WP_Term ) );
			}
		}

		return $out;
	}

	/**
	 * The categories as the shop lists them: a main category, then the
	 * categories under it in their order, then the next main one, so a list
	 * and a tree read alike. WooCommerce numbers siblings from 0 under each
	 * parent, which a list of every level sorted by that number alone would
	 * interleave. A name is listed where it first appears.
	 *
	 * @param  array<string,array<int,WP_Term>>  $taxonomies  From {@see self::category_terms()}.
	 * @return array<int,string> Paths, or names.
	 */
	private function category_order( array $taxonomies, bool $paths ): array {
		$order = [];

		foreach ( $taxonomies as $terms ) {
			$values   = $paths ? Term_Paths::of_terms( $terms ) : [];
			$children = [];
			$roots    = [];
			$seen     = [];

			foreach ( $terms as $term ) {
				$values[ $term->term_id ] ??= Term_Names::decode( $term->name );
			}

			foreach ( $terms as $term ) {
				if ( isset( $values[ $term->parent ] ) && $term->parent !== $term->term_id ) {
					$children[ $term->parent ][] = $term;
				} else {
					$roots[] = $term;
				}
			}

			$walk = static function ( WP_Term $term ) use ( &$walk, &$order, &$seen, $children, $values ): void {
				// A parent loop, which only a broken database has, ends the walk.
				if ( isset( $seen[ $term->term_id ] ) ) {
					return;
				}

				$seen[ $term->term_id ] = true;
				$order[]                = $values[ $term->term_id ];

				foreach ( $children[ $term->term_id ] ?? [] as $child ) {
					$walk( $child );
				}
			};

			foreach ( $roots as $root ) {
				$walk( $root );
			}
		}

		return array_values( array_unique( array_filter( $order, static fn ( string $value ): bool => '' !== $value ) ) );
	}

	/**
	 * Category name => the name of its parent. A search answers with names, so
	 * two categories of one name are one value: it is a main category if
	 * either is, and under the first parent otherwise.
	 *
	 * @param  array<string,array<int,WP_Term>>  $taxonomies  From {@see self::category_terms()}.
	 * @return array<string,string>
	 */
	private function category_parents( array $taxonomies ): array {
		$parents = [];
		$roots   = [];

		foreach ( $taxonomies as $terms ) {
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
