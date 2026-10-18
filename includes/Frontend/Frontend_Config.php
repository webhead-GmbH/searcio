<?php
/**
 * What the storefront bundle is told about the site it runs on.
 *
 * The bundle itself is the webpack entry {@see self::ENTRY}, printed through
 * the plugin's asset registry by whatever draws a surface: a block's
 * `render.php` and the two Elementor widgets. The registry registers it the
 * first time one of them asks, and only then calls {@see self::to_array()} -
 * so a page with no surface on it reads no setting and translates no string.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\Enums\Plan_Tier;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Language;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Frontend_Config {
	/** The webpack entry every storefront surface of this plugin is drawn by. */
	public const ENTRY = 'bundle.search';

	/** The global the entry's script reads this configuration from. */
	public const OBJECT_NAME = 'webheadSearchCloudFrontend';

	public function __construct(
		private Settings_Manager $settings,
		private Index_Config $index_config,
		private Language $language,
		private Language_Config $language_config
	) {}

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

	/**
	 * The searcio logo the search window shows in its bottom corner, linked to
	 * searcio.com, or null when it shows none. A Free plan always shows it;
	 * on any other plan, or before the plan is known, Support Searcio decides,
	 * and it is on until the shop turns it off.
	 *
	 * @return array{url:string}|null
	 */
	private function credit(): ?array {
		$tier = Plan_Tier::tryFrom( (string) $this->settings->get( Plugin_Settings::PLAN_TIER ) );

		if ( Plan_Tier::Free !== $tier && ! (bool) $this->settings->get( Plugin_Settings::SUPPORT_SEARCIO ) ) {
			return null;
		}

		return [ 'url' => 'https://searcio.com/' ];
	}

	private function price_suffix(): string {
		$suffix = (string) get_option( 'woocommerce_price_display_suffix', '' );

		return str_contains( $suffix, '{' ) ? '' : $suffix;
	}

	/**
	 * Called by the asset registry when it registers the entry, which is the
	 * first time a surface on the page asks for it.
	 *
	 * @return array<string,mixed>
	 */
	public function to_array(): array {
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
			'credit'          => $this->credit(),
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
				/* translators: %s: the name of the search service, "searcio". */
				'credit'          => sprintf( __( 'Search by %s (opens in a new tab)', 'webhead-search-cloud' ), 'searcio' ),
			],
		];
	}
}
