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

use Webhead\WP\SearchCloud\DTO\Storefront_Facet;
use Webhead\WP\SearchCloud\Enums\Facet_Display;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Facet_Config {
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
	 * drawn and, for an attribute a swatches plugin colours, the colour of each
	 * value in the language of the current request.
	 *
	 * How a field is drawn is the storefront's to decide (`auto`) unless a shop
	 * says otherwise through `webhead_search_cloud/storefront/facet_display`,
	 * which is given `auto` and the field and answers `list`, `tiles`, `color`
	 * or `range`. The colours can be given or corrected through
	 * `webhead_search_cloud/storefront/facet_colors`, which is given the value
	 * => hex map, the field and its taxonomy (empty when it has none).
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
			$display  = Facet_Display::from_storage(
				apply_filters( 'webhead_search_cloud/storefront/facet_display', Facet_Display::Auto->value, $field )
			);
			$colors   = apply_filters(
				'webhead_search_cloud/storefront/facet_colors',
				'' === $taxonomy ? [] : $this->woo->attribute_colors( $taxonomy ),
				$field,
				$taxonomy
			);

			$facets[] = new Storefront_Facet( $field, $order, $display, $this->colors( $colors ) );
		}

		return $facets;
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
}
