<?php
/**
 * The Google fonts the Placement tab offers, and the address that loads them.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * A family a shop picks here that its site does not have is loaded from
 * Google Fonts, where the search is drawn. That sends each visitor's address
 * to Google, so the Placement tab says so beside the picker, and a font the
 * site has installed (its theme's, or one in the Font Library) is always
 * used from the site.
 *
 * @since 1.3.2
 */
final class Google_Fonts {
	/** The families offered, the most used on Google Fonts first. */
	public const FAMILIES = [
		'Roboto',
		'Open Sans',
		'Inter',
		'Montserrat',
		'Lato',
		'Poppins',
		'Roboto Condensed',
		'Noto Sans',
		'Oswald',
		'Raleway',
		'Nunito',
		'Nunito Sans',
		'Rubik',
		'Work Sans',
		'Ubuntu',
		'Roboto Mono',
		'Playfair Display',
		'Merriweather',
		'PT Sans',
		'Kanit',
		'Lora',
		'Mulish',
		'DM Sans',
		'Fira Sans',
		'Quicksand',
		'Barlow',
		'Manrope',
		'IBM Plex Sans',
		'Heebo',
		'Karla',
		'Libre Franklin',
		'Josefin Sans',
		'Plus Jakarta Sans',
		'Outfit',
		'Figtree',
		'Jost',
		'Source Sans 3',
		'Archivo',
		'Space Grotesk',
		'Lexend',
		'Urbanist',
		'Cabin',
		'Titillium Web',
		'Hind',
		'Dosis',
		'Bebas Neue',
		'Libre Baskerville',
		'EB Garamond',
		'Cormorant Garamond',
		'Crimson Text',
		'Fraunces',
		'DM Serif Display',
		'Noto Serif',
		'Vazirmatn',
		'Noto Sans Arabic',
		'Cairo',
		'Tajawal',
	];

	/** What a family is asked for in, besides weights a setting names. */
	private const WEIGHTS = [ 400, 500, 600, 700 ];

	/**
	 * The stylesheet address that loads `$families` in their weights, or ''
	 * for none.
	 *
	 * @param  array<string, array<int, int>>  $families  Family => weights a setting asks for.
	 */
	public static function url( array $families ): string {
		$parts = [];

		foreach ( $families as $family => $weights ) {
			$weights = array_values( array_unique( array_merge( self::WEIGHTS, $weights ) ) );
			sort( $weights );
			$parts[] = 'family=' . str_replace( ' ', '+', $family ) . ':wght@' . implode( ';', $weights );
		}

		return [] === $parts ? '' : 'https://fonts.googleapis.com/css2?' . implode( '&', $parts ) . '&display=swap';
	}

	public static function offers( string $family ): bool {
		return in_array( $family, self::FAMILIES, true );
	}

	/**
	 * The families the site has itself: its theme's, and those installed in
	 * WordPress's Font Library, which `theme.json` lists as custom.
	 *
	 * @return array<int, string>
	 */
	public static function site_families(): array {
		if ( ! function_exists( 'wp_get_global_settings' ) ) {
			return [];
		}

		$names  = [];
		$groups = wp_get_global_settings( [ 'typography', 'fontFamilies' ] );

		foreach ( is_array( $groups ) ? $groups : [] as $origin ) {
			foreach ( is_array( $origin ) ? $origin : [] as $font ) {
				if ( is_array( $font ) && is_string( $font['name'] ?? null ) && '' !== $font['name'] ) {
					$names[] = $font['name'];
				}
			}
		}

		return array_values( array_unique( $names ) );
	}
}
