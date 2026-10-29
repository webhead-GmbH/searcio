<?php
/**
 * The selectors of the search icon or field of themes and builders that draw
 * their own, for the Placement tab to suggest.
 *
 * Each was read from the theme's own markup on 2026-10-29: the code of the
 * version named for the themes on wordpress.org, the public demo of the
 * others. A suggestion is only ever shown; an admin applies it.
 *
 * - Enfold: `#menu-item-search > a`, the menu's magnifier (kriesi.at demo, and
 *   a live Enfold shop with a child theme).
 * - Flatsome: `.header-search > a`, the header's magnifier, and
 *   `.header-search-form .search-field`, its search bar (flatsome3 demo).
 * - Astra 4.14.2: `.astra-search-icon`, the header builder's search icon.
 * - Kadence 1.5.2: `.search-toggle-open`, the header's search toggle.
 * - Blocksy 2.1.60: `.ct-header-search`, the header builder's search button.
 * - GeneratePress 3.6.1: `.search-item > a`, the navigation search, and
 *   `[data-gpmodal-trigger="gp-search"]`, the search modal's button.
 * - OceanWP 4.2.8: `.site-search-toggle`, the menu's search icon.
 * - Storefront 4.6.2: `.site-search .search-field`, the product search field
 *   in its header (which Searcio's form takeover also covers).
 * - Divi: `#et_search_icon`, the header's magnifier (elegantthemes demo).
 * - Woodmart: `.wd-header-search-form .s` and `.wd-header-search-form-mobile .s`,
 *   the header search field on a desktop and on a phone (xtemos demo).
 * - Avada: `.fusion-search-form .s`, the Avada Builder search field
 *   (avada.website demo).
 * - The7: `.mini-search .search-icon`, the header's magnifier (the7.io demo).
 * - Salient: `#search-btn a` and `a.mobile-search`, the header's magnifier on
 *   a desktop and on a phone (themenectar demo).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Theme_Presets {
	/**
	 * By the folder name of the theme (the parent's, for a child theme), in
	 * lower case.
	 *
	 * @var array<string,array{name:string,selectors:string[]}>
	 */
	private const THEMES = [
		'enfold'        => [
			'name'      => 'Enfold',
			'selectors' => [ '#menu-item-search > a' ],
		],
		'flatsome'      => [
			'name'      => 'Flatsome',
			'selectors' => [ '.header-search > a', '.header-search-form .search-field' ],
		],
		'astra'         => [
			'name'      => 'Astra',
			'selectors' => [ '.astra-search-icon' ],
		],
		'kadence'       => [
			'name'      => 'Kadence',
			'selectors' => [ '.search-toggle-open' ],
		],
		'blocksy'       => [
			'name'      => 'Blocksy',
			'selectors' => [ '.ct-header-search' ],
		],
		'generatepress' => [
			'name'      => 'GeneratePress',
			'selectors' => [ '.search-item > a', '[data-gpmodal-trigger="gp-search"]' ],
		],
		'oceanwp'       => [
			'name'      => 'OceanWP',
			'selectors' => [ '.site-search-toggle' ],
		],
		'storefront'    => [
			'name'      => 'Storefront',
			'selectors' => [ '.site-search .search-field' ],
		],
		'divi'          => [
			'name'      => 'Divi',
			'selectors' => [ '#et_search_icon' ],
		],
		'woodmart'      => [
			'name'      => 'Woodmart',
			'selectors' => [ '.wd-header-search-form .s', '.wd-header-search-form-mobile .s' ],
		],
		'avada'         => [
			'name'      => 'Avada',
			'selectors' => [ '.fusion-search-form .s' ],
		],
		'dt-the7'       => [
			'name'      => 'The7',
			'selectors' => [ '.mini-search .search-icon' ],
		],
		'salient'       => [
			'name'      => 'Salient',
			'selectors' => [ '#search-btn a', 'a.mobile-search' ],
		],
	];

	/**
	 * What a page builder or a plugin draws in any theme: Elementor Pro's
	 * search form field and its full-screen toggle (read from Elementor Pro
	 * 4.3.2's `search-form` widget), and the field of Elementor's own Search
	 * widget.
	 *
	 * @var array<string,array{name:string,selectors:string[]}>
	 */
	private const BUILDERS = [
		'elementor-pro' => [
			'name'      => 'Elementor Pro',
			'selectors' => [ '.elementor-search-form__input', '.elementor-search-form__toggle', '.e-search-input' ],
		],
	];

	/**
	 * The preset of the theme with this folder name, or of its parent.
	 *
	 * @return array{key:string,name:string,selectors:string[]}|null
	 */
	public static function for_theme( string $template, string $stylesheet = '' ): ?array {
		foreach ( [ $template, $stylesheet ] as $slug ) {
			$slug = strtolower( trim( $slug ) );

			if ( isset( self::THEMES[ $slug ] ) ) {
				return [ 'key' => $slug ] + self::THEMES[ $slug ];
			}
		}

		return null;
	}

	/**
	 * @return array{key:string,name:string,selectors:string[]}|null
	 */
	public static function for_builder( string $key ): ?array {
		return isset( self::BUILDERS[ $key ] ) ? [ 'key' => $key ] + self::BUILDERS[ $key ] : null;
	}

	/**
	 * Every theme the plugin knows, by folder name.
	 *
	 * @return string[]
	 */
	public static function themes(): array {
		return array_keys( self::THEMES );
	}
}
