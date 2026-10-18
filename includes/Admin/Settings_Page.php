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
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Admin\Page;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Settings_Page extends Page {
	/**
	 * The searcio mark in one colour: its green field with the "s" cut out.
	 * WordPress paints every `fill` of a base64 SVG menu icon in the colour of
	 * the admin scheme (wp-admin/js/svg-painter.js), so the mark's shape has to
	 * come from the cut-out and not from a second colour, which would be painted
	 * over. ASCII only: the painter decodes it with `atob()`.
	 */
	private const MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="26 31 88 88"><path fill="#000" fill-rule="evenodd" d="M44 42h52a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14H44a14 14 0 0 1-14-14V56a14 14 0 0 1 14-14ZM70.31 97.08q-8.83 0-13.86-3.68-5.02-3.67-5.35-10.29h10.83q.27 2.02 2.37 3.57t6.24 1.54q3.21 0 5.31-1.08t2.1-3.15q0-1.83-1.61-2.95-1.62-1.12-5.7-1.52l-3.27-.34q-7.49-.78-11.25-4.17-3.76-3.4-3.76-8.73 0-4.45 2.2-7.4 2.2-2.94 6.1-4.45 3.9-1.5 8.91-1.5 8.04 0 12.98 3.52t5.2 10.2H76.94q-.25-2.02-2.1-3.45-1.86-1.42-5.37-1.42-2.83 0-4.5 1.06-1.66 1.06-1.66 2.87 0 1.77 1.45 2.68 1.44.91 4.67 1.29l3.27.34q7.67.8 11.94 4.24t4.27 9.16q0 4.2-2.28 7.26-2.28 3.07-6.46 4.74-4.17 1.66-9.85 1.66"/></svg>';

	public function __construct(
		private Search_Cloud_Client $client,
		private Connection_State $connection_state
	) {}
	protected function get_menu_slug(): string {
		return 'webhead-search-cloud';
	}

	protected function get_menu_parent(): ?string {
		return null;
	}

	protected function get_menu_title(): string {
		return __( 'Search Cloud', 'webhead-search-cloud' );
	}

	protected function get_page_title(): string {
		return __( 'webhead Search Cloud', 'webhead-search-cloud' );
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
		return 'webhead-search-cloud-root';
	}

	protected function get_asset_key(): ?string {
		return 'bundle.settings';
	}

	protected function get_default_asset_entry(): ?string {
		return 'bundle.default';
	}

	protected function get_icon(): string {
		return 'data:image/svg+xml;base64,' . base64_encode( self::MENU_ICON );
	}

	protected function get_position(): ?int {
		return 90;
	}

	protected function get_localize_script_object_name(): ?string {
		return 'webhead_search_cloudData';
	}

	protected function get_localize_script_data(): array {
		$current_user = wp_get_current_user();
		$pending      = $this->connection_state->pending_claim();

		return [
			'api' => [
				'settingsPath'        => '/webhead-search-cloud/v1/settings',
				'testConnectionPath'  => '/webhead-search-cloud/v1/connection/test',
				'connectPath'         => '/webhead-search-cloud/v1/connection/connect',
				'disconnectPath'      => '/webhead-search-cloud/v1/connection/disconnect',
				'connectionLegalPath' => '/webhead-search-cloud/v1/connection/legal',
				'indexingConfigPath'  => '/webhead-search-cloud/v1/indexing/config',
				'syncBase'            => '/webhead-search-cloud/v1/sync',
				'cacheClearPath'      => '/webhead-search-cloud/v1/cache/clear',
				'searchConfigPath'    => '/webhead-search-cloud/v1/search-config',
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
			'popularSearchesKeys' => [ 'popular_searches' ],
			'plugin' => [
				'name'        => __( 'webhead Search Cloud', 'webhead-search-cloud' ),
				'description' => __( 'Connect WordPress and WooCommerce to webhead Search Cloud.', 'webhead-search-cloud' ),
			],
			// Drives the Connection tab's default-open behavior and its initial
			// state before the settings/health REST calls resolve.
			'connection' => [
				'isConnected'  => $this->client->is_configured(),
				'pendingClaim' => $pending,
				'defaults'     => [
					'email'     => (string) get_option( 'admin_email' ),
					'adminName' => (string) $current_user->display_name,
					'siteName'  => (string) get_bloginfo( 'name' ),
				],
			],
			// Synchronous, no-network fallback shown until the Connection tab's
			// own GET /connection/legal call resolves with Search Cloud's live
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
