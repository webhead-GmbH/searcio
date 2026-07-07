<?php
/**
 * Front-end search asset registration.
 *
 * Registers (does not auto-enqueue) the React-based front-end search bundle
 * and localizes the public runtime config it needs. The block's `render.php`
 * and the Elementor widget both call {@see self::enqueue()} so the bundle
 * only loads on pages where a trigger is actually placed. The bundle depends
 * on `@wordpress/components`, so its style handle is enqueued alongside ours.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Admin\Asset_Manifest;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Language;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Frontend_Assets {
	public const HANDLE = 'webhead-search-cloud-frontend-search';
	private const ENTRY  = 'bundle.search';

	public function __construct(
		private Settings_Manager $settings,
		private Index_Config $index_config,
		private Language $language,
		private Language_Config $language_config
	) {}

	#[Action( 'init' )]
	public function register(): void {
		$manifest = Asset_Manifest::from_entry(
			\Webhead\WP\SearchCloud\PLUGIN_DIR . 'public',
			\Webhead\WP\SearchCloud\PLUGIN_URL . 'public',
			self::ENTRY
		);

		if ( ! $manifest->script_exists() ) {
			return;
		}

		wp_register_script( self::HANDLE, $manifest->script_url(), $manifest->script_dependencies(), $manifest->version(), true );
		wp_set_script_translations( self::HANDLE, 'webhead-search-cloud', \Webhead\WP\SearchCloud\PLUGIN_DIR . 'languages' );

		$style_asset = $this->resolve_style_asset();

		if ( null !== $style_asset ) {
			// `filemtime()`, not `$manifest->version()`: the manifest's version
			// hash comes from webpack's DependencyExtractionWebpackPlugin, which
			// only hashes this entry's JS content. A rebuild that only touches
			// this entry's SCSS leaves that hash unchanged, so the stylesheet's
			// `?ver=` querystring would stay identical across a CSS-only update
			// and browsers keep serving the stale cached file indefinitely —
			// most visibly in the Elementor editor's preview iframe, which
			// otherwise reflects style changes immediately.
			wp_register_style( self::HANDLE, $style_asset['url'], [ 'wp-components' ], (string) filemtime( $style_asset['path'] ) );
		}

		wp_localize_script( self::HANDLE, 'webheadSearchCloudFrontend', $this->localize_data() );
	}

	/**
	 * Called by the block render callback and the Elementor widget — the only
	 * two places a trigger can be placed on the front-end. Static because both
	 * call sites run outside the service container (block `render.php` is
	 * required directly by WordPress core; the Elementor widget is instantiated
	 * by Elementor's own registry) and enqueueing only needs the handle that
	 * {@see self::register()} already registered on `init`.
	 */
	public static function enqueue(): void {
		if ( ! wp_script_is( self::HANDLE, 'registered' ) ) {
			return;
		}

		wp_enqueue_script( self::HANDLE );

		if ( wp_style_is( self::HANDLE, 'registered' ) ) {
			wp_enqueue_style( self::HANDLE );
		}
	}

	/**
	 * `Asset_Manifest` assumes a plain `{entry}.css` output, but this entry's
	 * only synchronous style import (no other JS shares its chunk) makes
	 * webpack's MiniCssExtractPlugin name the chunk `style-{entry}.css`
	 * instead. `Asset_Manifest` is not RTL-aware either way, so resolve the
	 * stylesheet ourselves: prefer the RTL-suffixed file when `is_rtl()`, and
	 * check both the plain and `style-` prefixed basenames webpack can emit.
	 * A prior version checked `$manifest->style_exists()` first, which is
	 * always true here (the LTR `style-` file always exists) and so silently
	 * skipped the RTL lookup below on every request.
	 */
	/**
	 * @return array{url:string,path:string}|null
	 */
	private function resolve_style_asset(): ?array {
		$suffix = is_rtl() ? '-rtl' : '';

		$asset = $this->find_style_asset( self::ENTRY . $suffix );

		if ( null !== $asset ) {
			return $asset;
		}

		// RTL build output missing for some reason: better to ship the LTR
		// stylesheet than none at all.
		return '' === $suffix ? null : $this->find_style_asset( self::ENTRY );
	}

	/**
	 * @return array{url:string,path:string}|null
	 */
	private function find_style_asset( string $entry ): ?array {
		$base_path = rtrim( \Webhead\WP\SearchCloud\PLUGIN_DIR . 'public', '/\\' );
		$base_url  = rtrim( \Webhead\WP\SearchCloud\PLUGIN_URL . 'public', '/' );

		foreach ( [ $entry, 'style-' . $entry ] as $candidate ) {
			$path = $base_path . '/' . $candidate . '.css';

			if ( is_file( $path ) ) {
				return [ 'url' => $base_url . '/' . $candidate . '.css', 'path' => $path ];
			}
		}

		return null;
	}

	/**
	 * Currency symbol, position and decimal count, sourced from WooCommerce so
	 * result-card prices (returned by the Search Cloud API as bare numbers) are
	 * formatted client-side to match the store. Falls back to no symbol when
	 * WooCommerce is inactive.
	 *
	 * @return array<string,mixed>
	 */
	private function currency_config(): array {
		if ( ! function_exists( 'get_woocommerce_currency_symbol' ) ) {
			return [ 'symbol' => '', 'position' => 'left', 'decimals' => 2, 'decimalSep' => '.', 'thousandSep' => ',', 'suffix' => '' ];
		}

		return [
			'symbol'      => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ),
			'position'    => (string) get_option( 'woocommerce_currency_pos', 'left' ),
			'decimals'    => function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2,
			'decimalSep'  => function_exists( 'wc_get_price_decimal_separator' ) ? wc_get_price_decimal_separator() : '.',
			'thousandSep' => function_exists( 'wc_get_price_thousand_separator' ) ? wc_get_price_thousand_separator() : ',',
			// The store's price suffix, e.g. "inkl. MwSt. zzgl. Versandkosten".
			// Only used when it is plain text (no {price_*} placeholders, which
			// need a computed per-product value we don't have client-side).
			'suffix'      => $this->price_suffix(),
		];
	}

	private function price_suffix(): string {
		$suffix = (string) get_option( 'woocommerce_price_display_suffix', '' );

		return str_contains( $suffix, '{' ) ? '' : $suffix;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function localize_data(): array {
		$host = defined( 'Webhead\WP\SearchCloud\SERVICE_URL' ) ? \Webhead\WP\SearchCloud\SERVICE_URL : '';

		return [
			// Key-relative: the search key alone resolves the site server-side
			// (see docs/api/README.md "Key-relative endpoints"), so no site id
			// needs to be baked into the endpoint URL.
			'endpoint'        => rtrim( (string) $host, '/' ) . '/api/v1',
			'searchKey'       => (string) $this->settings->get( Plugin_Settings::SEARCH_KEY ),
			'siteHome'        => home_url( '/' ),
			'popularSearches' => array_values( (array) $this->settings->get( Plugin_Settings::POPULAR_SEARCHES ) ),
			'typeLabels'      => $this->index_config->indexable_post_type_labels(),
			'currency'        => $this->currency_config(),
			// Both gated by is_multilingual(), not just currentLang: Language_Config's
			// mirror only refreshes when an admin opens/saves Search Config, so a site
			// that deactivated WPML/Polylang after restricting languages would
			// otherwise keep serving a stale enabledLanguages with no currentLang to
			// ever match it — sending every visitor to native-search fallback.
			'currentLang'     => $this->language->is_multilingual() ? $this->language->current_language() : '',
			'enabledLanguages' => $this->language->is_multilingual() ? $this->language_config->enabled_languages() : [],
			'i18n'            => [
				'placeholder'     => __( 'Search…', 'webhead-search-cloud' ),
				'noResults'       => __( 'No results found.', 'webhead-search-cloud' ),
				'searching'       => __( 'Searching…', 'webhead-search-cloud' ),
				/* translators: shown before a variable product's lowest price, e.g. "from €42". */
				'priceFrom'       => _x( 'from', 'variable product price prefix', 'webhead-search-cloud' ),
				'onSale'          => __( 'Sale', 'webhead-search-cloud' ),
				'error'           => __( 'Search is unavailable right now.', 'webhead-search-cloud' ),
				'recentSearches'  => __( 'Recent searches', 'webhead-search-cloud' ),
				'popularSearches' => __( 'Popular searches', 'webhead-search-cloud' ),
				'clear'           => __( 'Clear', 'webhead-search-cloud' ),
				'close'           => __( 'Close search', 'webhead-search-cloud' ),
				'voiceSearch'     => __( 'Search by voice', 'webhead-search-cloud' ),
				'allTypes'        => __( 'All', 'webhead-search-cloud' ),
			],
		];
	}
}
