<?php
/**
 * What a swatches plugin or a theme made of a WooCommerce attribute.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use WP_Term;
use Webhead\WP\SearchCloud\DTO\Attribute_Swatches;
use Webhead\WP\SearchCloud\Enums\Facet_Display;

defined( 'ABSPATH' ) || exit;

/**
 * Reads the colour, image or short label each term of an attribute was given
 * where the plugin or theme that drew it keeps them. Every key below was read
 * from that plugin's or theme's own source:
 *
 * - "Variation Swatches for WooCommerce" by GetWooPlugins, its Pro, and the one
 *   by RadiusTheme, which took its keys: `product_attribute_color` and
 *   `product_attribute_image`; a term of two colours adds `is_dual_color` and
 *   `secondary_color`.
 * - "Variation Swatches for WooCommerce" by CartFlows: `cfvsw_color`, `cfvsw_image`.
 * - "WPC Variation Swatches": `wpcvs_color`, `wpcvs_image`, `wpcvs_button`.
 * - "Variation Swatches and Photos" of WooCommerce.com: `{taxonomy}_swatches_id_type`,
 *   `_color` and `_photo`.
 * - Kadence Shop Kit: `_kt_woo_extras_swatch_type`, `_color` and `_image`, or
 *   the option `kt_woo_extras_tax_swatch_type` older releases kept them in.
 * - "Choosly - Product Variations Swatches" by VillaTheme: `vi_wpvs_terms_params`.
 * - Flatsome: `ux_color` ("#000000" or "#000000,#ffffff"), `ux_image`, `ux_label`.
 * - On an attribute of a swatch type only, since the names are plain or mean
 *   something else by type: `color`, `image` and `label` of "Variation Swatches
 *   for WooCommerce" by Woosuite; `swatches_color`, `swatches_image` and
 *   `swatches_label` of "WCBoost - Variation Swatches"; `color_value`,
 *   `image_value` and `label_value` of Porto; `product_{taxonomy}` of
 *   ThemeHigh's; `_yith_wccl_value` of YITH's.
 * - WoodMart, whose swatches take no attribute type of their own, while it is
 *   the theme: `color` and `image`.
 *
 * An image is an attachment's id or an address, held as one or in an array.
 *
 * @since 1.3.2
 */
final class Swatch_Reader {
	/** The attribute types these plugins and themes add, and what each draws. */
	private const TYPES = [
		'color'       => 'color',
		'colorpicker' => 'color',
		'ux_color'    => 'color',
		'image'       => 'image',
		'ux_image'    => 'image',
		'label'       => 'label',
		'button'      => 'label',
		'ux_label'    => 'label',
	];

	/** YITH's keeps every value under one key, and releases before 2.0 under the taxonomy's name before it. */
	private const YITH_KEY = '_yith_wccl_value';

	/** Kadence Shop Kit kept the swatches of every term in one option before term meta. */
	private const KADENCE_OPTION = 'kt_woo_extras_tax_swatch_type';

	/** @var array<int|string,mixed>|null */
	private ?array $kadence = null;

	/**
	 * How an attribute is drawn and the swatch of each of its terms, keyed by the
	 * name the index holds, in the language of the current request, so the
	 * storefront can match them to the values a search answers with.
	 *
	 * The type of the attribute says which of a term's values counts: a plugin
	 * keeps what was set before the type changed. An attribute of no swatch type
	 * shows colours when it has any and images otherwise.
	 *
	 * Where the shop asked for swatches, by the attribute's type or by a swatch
	 * type a plugin keeps per term, the attribute is drawn as colours or images
	 * even where a value has none yet, as its product page draws it. Otherwise
	 * the storefront draws them only when every value has one.
	 */
	public function read( string $taxonomy ): Attribute_Swatches {
		if ( ! taxonomy_exists( $taxonomy ) ) {
			return new Attribute_Swatches();
		}

		$terms = get_terms( [ 'taxonomy' => $taxonomy, 'hide_empty' => true ] );

		if ( ! is_array( $terms ) ) {
			return new Attribute_Swatches();
		}

		$type   = $this->attribute_type( $taxonomy );
		$kind   = self::TYPES[ $type ] ?? '';
		$values = [
			'color'  => [],
			'second' => [],
			'image'  => [],
			'label'  => [],
		];
		$asked  = '' !== $kind || 'woodmart' === get_template();

		foreach ( $terms as $term ) {
			if ( ! $term instanceof WP_Term ) {
				continue;
			}

			$name = Term_Names::decode( $term->name );

			$swatch = $this->term( $term->term_id, $taxonomy, $type, $kind );
			$asked  = $asked || $swatch['asked'];

			unset( $swatch['asked'] );

			foreach ( $swatch as $key => $value ) {
				if ( '' !== $value ) {
					$values[ $key ][ $name ] = $value;
				}
			}
		}

		$colors = 'image' === $kind ? [] : $values['color'];
		$images = 'color' === $kind || [] !== $colors ? [] : $values['image'];

		$display = Facet_Display::Auto;

		if ( 'label' === $kind ) {
			$display = Facet_Display::Tiles;
		} elseif ( $asked && [] !== $colors ) {
			$display = Facet_Display::Color;
		} elseif ( $asked && [] !== $images ) {
			$display = Facet_Display::Image;
		}

		return new Attribute_Swatches(
			$display,
			$colors,
			[] === $colors ? [] : array_intersect_key( $values['second'], $colors ),
			$images,
			$values['label']
		);
	}

	/**
	 * The first colour, image and label a source gives the term, in the order
	 * of the class's list. A second colour goes with the colour it came with.
	 * `asked` says a plugin keeps a swatch type for this term.
	 *
	 * @return array{color:string,second:string,image:string,label:string,asked:bool}
	 */
	private function term( int $id, string $taxonomy, string $type, string $kind ): array {
		$meta  = static fn ( string $key ): mixed => get_term_meta( $id, $key, true );
		$found = [
			'color'  => '',
			'second' => '',
			'image'  => '',
			'label'  => '',
			'asked'  => false,
		];

		$color = function ( mixed $first, mixed $second = '' ) use ( &$found ): void {
			$first = $this->hex( $first );

			if ( '' === $found['color'] && '' !== $first ) {
				$found['color']  = $first;
				$found['second'] = $this->hex( $second );
			}
		};
		$image = function ( mixed $value ) use ( &$found ): void {
			if ( '' === $found['image'] ) {
				$found['image'] = $this->image_url( $value );
			}
		};
		$label = function ( mixed $value ) use ( &$found ): void {
			if ( '' === $found['label'] && is_scalar( $value ) ) {
				$found['label'] = trim( wp_strip_all_tags( (string) $value ) );
			}
		};

		// GetWooPlugins, its Pro and RadiusTheme.
		$color( $meta( 'product_attribute_color' ), 'yes' === $meta( 'is_dual_color' ) ? $meta( 'secondary_color' ) : '' );
		$image( $meta( 'product_attribute_image' ) );

		// CartFlows.
		$color( $meta( 'cfvsw_color' ) );
		$image( $meta( 'cfvsw_image' ) );

		// WPC.
		$color( $meta( 'wpcvs_color' ) );
		$image( $meta( 'wpcvs_image' ) );
		$label( $meta( 'wpcvs_button' ) );

		// WooCommerce.com's Variation Swatches and Photos.
		$photos = (string) $meta( $taxonomy . '_swatches_id_type' );

		$found['asked'] = in_array( $photos, [ 'color', 'photo' ], true );

		if ( 'color' === $photos ) {
			$color( $meta( $taxonomy . '_swatches_id_color' ) );
		} elseif ( 'photo' === $photos ) {
			$image( $meta( $taxonomy . '_swatches_id_photo' ) );
		}

		// Kadence Shop Kit.
		$kadence        = $this->kadence_swatch( $id, $meta );
		$found['asked'] = $found['asked'] || '' !== $kadence['type'];

		if ( 'image' === $kadence['type'] ) {
			$image( $kadence['image'] );
		} else {
			$color( $kadence['color'] );
		}

		// Choosly.
		$choosly        = $meta( 'vi_wpvs_terms_params' );
		$found['asked'] = $found['asked'] || ( is_array( $choosly ) && in_array( $choosly['type'] ?? '', [ 'color', 'image' ], true ) );

		if ( is_array( $choosly ) && 'color' === ( $choosly['type'] ?? '' ) && is_array( $choosly['color'] ?? null ) ) {
			$color( $choosly['color'][0] ?? '', $choosly['color'][1] ?? '' );
		} elseif ( is_array( $choosly ) && 'image' === ( $choosly['type'] ?? '' ) ) {
			$image( $choosly['img_id'] ?? '' );
		}

		// Flatsome.
		$flatsome = explode( ',', is_string( $meta( 'ux_color' ) ) ? $meta( 'ux_color' ) : '' );
		$color( $flatsome[0], $flatsome[1] ?? '' );
		$image( $meta( 'ux_image' ) );
		$label( $meta( 'ux_label' ) );

		if ( '' !== $kind ) {
			// Woosuite.
			$color( $meta( 'color' ) );
			$image( $meta( 'image' ) );
			$label( $meta( 'label' ) );

			// WCBoost.
			$color( $meta( 'swatches_color' ) );
			$image( $meta( 'swatches_image' ) );
			$label( $meta( 'swatches_label' ) );

			// Porto.
			$color( $meta( 'color_value' ) );
			$image( $meta( 'image_value' ) );
			$label( $meta( 'label_value' ) );

			// ThemeHigh's, and YITH's, whose one value means what the type says.
			foreach ( [ $meta( 'product_' . $taxonomy ), $this->yith_value( $id, $taxonomy ) ] as $value ) {
				if ( 'color' === $kind ) {
					$colors = is_array( $value ) ? array_values( $value ) : explode( ',', (string) $value );
					$color( $colors[0] ?? '', $colors[1] ?? '' );
				} elseif ( 'image' === $kind ) {
					$image( $value );
				} else {
					$label( $value );
				}
			}
		}

		// WoodMart.
		if ( 'woodmart' === get_template() ) {
			$color( $meta( 'color' ) );
			$image( $meta( 'image' ) );
		}

		return $found;
	}

	/** The type WooCommerce keeps for an attribute: `select`, or one a swatches plugin or a theme added. */
	private function attribute_type( string $taxonomy ): string {
		if ( ! function_exists( 'wc_attribute_taxonomy_id_by_name' ) || ! function_exists( 'wc_get_attribute' ) ) {
			return '';
		}

		$attribute = wc_get_attribute( wc_attribute_taxonomy_id_by_name( $taxonomy ) );

		return is_object( $attribute ) ? (string) ( $attribute->type ?? '' ) : '';
	}

	private function yith_value( int $id, string $taxonomy ): mixed {
		$value = get_term_meta( $id, self::YITH_KEY, true );

		return '' === $value || false === $value ? get_term_meta( $id, $taxonomy . self::YITH_KEY, true ) : $value;
	}

	/**
	 * @param  callable(string):mixed  $meta
	 * @return array{type:string,color:mixed,image:mixed}
	 */
	private function kadence_swatch( int $id, callable $meta ): array {
		$swatch = [
			'type'  => (string) $meta( '_kt_woo_extras_swatch_type' ),
			'color' => $meta( '_kt_woo_extras_swatch_color' ),
			'image' => $meta( '_kt_woo_extras_swatch_image' ),
		];

		if ( '' !== $swatch['type'] || '' !== $swatch['color'] ) {
			return $swatch;
		}

		$this->kadence ??= (array) get_option( self::KADENCE_OPTION, [] );
		$kept            = is_array( $this->kadence[ $id ] ?? null ) ? $this->kadence[ $id ] : [];

		return [
			'type'  => (string) ( $kept['kt_woo_extras_swatch_type'] ?? '' ),
			'color' => $kept['kt_woo_extras_swatch_color'] ?? '',
			'image' => $kept['kt_woo_extras_swatch_image'] ?? '',
		];
	}

	private function hex( mixed $value ): string {
		$color = is_string( $value ) ? sanitize_hex_color( trim( $value ) ) : null;

		return is_string( $color ) ? $color : '';
	}

	/** An attachment's id or an address, alone or in an array as `id`, `url` or its first item. */
	private function image_url( mixed $value ): string {
		if ( is_array( $value ) ) {
			$value = $value['id'] ?? $value['url'] ?? ( $value[0] ?? '' );
		}

		if ( is_numeric( $value ) ) {
			$url = (int) $value > 0 ? wp_get_attachment_image_url( (int) $value, 'thumbnail' ) : false;

			return is_string( $url ) ? $url : '';
		}

		return is_string( $value ) && 1 === preg_match( '#^https?://#i', trim( $value ) ) ? esc_url_raw( trim( $value ) ) : '';
	}
}
