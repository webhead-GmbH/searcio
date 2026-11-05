<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Admin;

use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Routing\Connection_Endpoint;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Admin\Page;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Settings_Page extends Page {
	public function __construct(
		private Search_Cloud_Client $client,
		private Connection_State $connection_state
	) {}
	protected function get_menu_slug(): string {
		return \Webhead\WP\SearchCloud\PLUGIN_SLUG;
	}

	protected function get_menu_parent(): ?string {
		return null;
	}

	protected function get_menu_title(): string {
		return __( 'Searcio', 'searcio' );
	}

	protected function get_page_title(): string {
		return __( 'Searcio', 'searcio' );
	}

	public function get_capability(): string {
		return Plugin_Capabilities::VIEW;
	}

	protected function get_assets_base_path(): string {
		return \Webhead\WP\SearchCloud\PLUGIN_DIR . 'public';
	}

	protected function get_assets_base_url(): string {
		return \Webhead\WP\SearchCloud\PLUGIN_URL . 'public';
	}

	protected function get_root_element_id(): string {
		return 'searcio-root';
	}

	protected function get_asset_key(): ?string {
		return 'bundle.settings';
	}

	protected function get_default_asset_entry(): ?string {
		return 'bundle.default';
	}

	/**
	 * The Searcio mark in one colour: its green field with the "s" cut out.
	 * WordPress paints every `fill` of a base64 SVG menu icon in the colour of
	 * the admin scheme (wp-admin/js/svg-painter.js), so the mark's shape has to
	 * come from the cut-out and not from a second colour, which would be painted
	 * over.
	 */
	protected function get_icon(): string {
		return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4OCIgaGVpZ2h0PSI4OCIgdmlld0JveD0iMjYgMzEgODggODgiPjxwYXRoIGZpbGw9IiMwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTQ0IDQyaDUyYTE0IDE0IDAgMCAxIDE0IDE0djM4YTE0IDE0IDAgMCAxLTE0IDE0SDQ0YTE0IDE0IDAgMCAxLTE0LTE0VjU2YTE0IDE0IDAgMCAxIDE0LTE0Wk03MC4zMSA5Ny4wOHEtOC44MyAwLTEzLjg2LTMuNjgtNS4wMi0zLjY3LTUuMzUtMTAuMjloMTAuODNxLjI3IDIuMDIgMi4zNyAzLjU3dDYuMjQgMS41NHEzLjIxIDAgNS4zMS0xLjA4dDIuMS0zLjE1cTAtMS44My0xLjYxLTIuOTUtMS42Mi0xLjEyLTUuNy0xLjUybC0zLjI3LS4zNHEtNy40OS0uNzgtMTEuMjUtNC4xNy0zLjc2LTMuNC0zLjc2LTguNzMgMC00LjQ1IDIuMi03LjQgMi4yLTIuOTQgNi4xLTQuNDUgMy45LTEuNSA4LjkxLTEuNSA4LjA0IDAgMTIuOTggMy41MnQ1LjIgMTAuMkg3Ni45NHEtLjI1LTIuMDItMi4xLTMuNDUtMS44Ni0xLjQyLTUuMzctMS40Mi0yLjgzIDAtNC41IDEuMDYtMS42NiAxLjA2LTEuNjYgMi44NyAwIDEuNzcgMS40NSAyLjY4IDEuNDQuOTEgNC42NyAxLjI5bDMuMjcuMzRxNy42Ny44IDExLjk0IDQuMjR0NC4yNyA5LjE2cTAgNC4yLTIuMjggNy4yNi0yLjI4IDMuMDctNi40NiA0Ljc0LTQuMTcgMS42Ni05Ljg1IDEuNjYiLz48L3N2Zz4=';
	}

	protected function get_position(): ?int {
		return 90;
	}

	protected function get_localize_script_object_name(): ?string {
		return 'searcioData';
	}

	protected function get_localize_script_data(): array {
		$pending = $this->connection_state->pending_claim();

		return [
			'api' => [
				'settingsPath'        => '/searcio/v1/settings',
				'testConnectionPath'  => '/searcio/v1/connection/test',
				'connectPath'         => '/searcio/v1/connection/connect',
				'disconnectPath'      => '/searcio/v1/connection/disconnect',
				'connectionLegalPath' => '/searcio/v1/connection/legal',
				'indexingConfigPath'  => '/searcio/v1/indexing/config',
				'syncBase'            => '/searcio/v1/sync',
				'cacheClearPath'      => '/searcio/v1/cache/clear',
				'searchConfigPath'    => '/searcio/v1/search-config',
				'placementPath'       => '/searcio/v1/placement',
				'nonce'               => wp_create_nonce( 'wp_rest' ),
			],
			'caps' => [
				'view'           => current_user_can( Plugin_Capabilities::VIEW ),
				'runSync'        => current_user_can( Plugin_Capabilities::RUN_SYNC ),
				'manageSettings' => current_user_can( Plugin_Capabilities::MANAGE_SETTINGS ),
			],
			'connectionKeys' => [
				'search_key',
				'write_key',
				'write_secret',
				'connect_pending_claim',
				'connect_pending_email',
			],
			'popularSearchesKeys' => [ 'popular_searches', 'category_filter', 'category_filter_depth' ],
			'plugin' => [
				'name'        => __( 'Searcio', 'searcio' ),
				'description' => __( 'Connect WordPress and WooCommerce to Searcio.', 'searcio' ),
			],
			// Drives the Connection tab's default-open behavior and its initial
			// state before the settings/health REST calls resolve.
			'connection' => [
				// The tier last seen, so the header can offer "Upgrade plan" at
				// once on a Free plan. The page asks Searcio again as it opens.
				'planTier'      => $this->connection_state->plan_tier()?->value ?? '',
				'isConnected'   => $this->client->is_configured(),
				'pendingClaim'  => $pending,
				// The header offers the statistics at once, at the dashboard, and
				// at the site's own page once the health check has named it.
				'statisticsUrl' => $this->client->is_configured() ? Connection_Endpoint::statistics_url( null ) : '',
				'defaults'      => [
					'email' => (string) get_option( 'admin_email' ),
				],
			],
			// Synchronous, no-network fallback shown until the Connection tab's
			// own GET /connection/legal call resolves with Searcio's live
			// links (see Search_Cloud_Client::legal_links()) - kept a plain
			// constant here, like Site Health's reachability test, so opening
			// *any* settings tab never blocks on an outbound HTTP call.
			'legal' => [
				'termsUrl'   => defined( 'Webhead\WP\SearchCloud\LEGAL_TERMS_URL' ) ? \Webhead\WP\SearchCloud\LEGAL_TERMS_URL : '',
				'privacyUrl' => defined( 'Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL' ) ? \Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL : '',
				'dpaUrl'     => defined( 'Webhead\WP\SearchCloud\LEGAL_DPA_URL' ) ? \Webhead\WP\SearchCloud\LEGAL_DPA_URL : '',
			],
		];
	}
}
