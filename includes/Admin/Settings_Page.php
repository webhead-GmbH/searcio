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
		return 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJ1dWlkLTA0OTg1YjU5LWI1Y2QtNDU4Ni1iNjNlLWM2YWQzY2YyNjYwOSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNTkyLjUgNzY5LjAzIj48ZGVmcz48c3R5bGU+LnV1aWQtNGNiNTQ1ODMtNjEzOC00OGIzLWE2MzEtNGQ4MWQ5NDY0Mzcye2ZpbGw6I2NlY2VjZDt9LnV1aWQtMTg5MDA3ZmEtZGI3OC00MmU0LThjN2UtMTc0Yjg4ZjMwMDVke2ZpbGw6I2U1ZTVlNDt9LnV1aWQtMWE0NzVkZmEtOGQzNi00ODY0LTllMDAtNTM5NjgwODZjMDIxe2ZpbGw6IzBhYmRkMjt9PC9zdHlsZT48L2RlZnM+PHBhdGggaWQ9InV1aWQtNTdhMzRmYzYtNjM0Mi00NDVmLWIzNzAtNzg4ODE4MzQ2NTU4IiBjbGFzcz0idXVpZC0xODkwMDdmYS1kYjc4LTQyZTQtOGM3ZS0xNzRiODhmMzAwNWQiIGQ9Ik01NTUuMDgsMzc5LjkxYzAsMTQxLjY2LTExNC44NCwyNTYuNS0yNTYuNSwyNTYuNVM0Mi4wNyw1MjEuNTgsNDIuMDcsMzc5LjkxLDE1Ni45MiwxMjMuNDEsMjk4LjU4LDEyMy40MXMyNTYuNSwxMTQuODQsMjU2LjUsMjU2LjUiLz48cGF0aCBpZD0idXVpZC02MDMwNjRkYS05OWFhLTQ2MTctODA4OC0zY2VkNmVjNjQzZjciIGQ9Ik00ODkuNzQsMjg3LjExYzAsNjkuNTctODcuMjMsMTI1Ljk3LTE5NC44MiwxMjUuOTdzLTE5NC44Mi01Ni40LTE5NC44Mi0xMjUuOTcsODcuMjMtMTI1Ljk3LDE5NC44Mi0xMjUuOTcsMTk0LjgyLDU2LjQsMTk0LjgyLDEyNS45NyIvPjxwYXRoIGlkPSJ1dWlkLTEzNWJjNWYzLTVjYmEtNDcwYi05Njg3LTM4MjhjNWE3M2IwMiIgY2xhc3M9InV1aWQtMWE0NzVkZmEtOGQzNi00ODY0LTllMDAtNTM5NjgwODZjMDIxIiBkPSJNMjU4LjI5LDI3OC4zMmMwLDguMDktNi41NiwxNC42NS0xNC42NSwxNC42NXMtMTQuNjUtNi41Ni0xNC42NS0xNC42NSw2LjU2LTE0LjY1LDE0LjY1LTE0LjY1LDE0LjY1LDYuNTYsMTQuNjUsMTQuNjUiLz48cGF0aCBpZD0idXVpZC1hYWQzZGZiNi0zZjllLTRiNmEtOWQxNS1iZWM3MmY0ZmQ0MjgiIGNsYXNzPSJ1dWlkLTFhNDc1ZGZhLThkMzYtNDg2NC05ZTAwLTUzOTY4MDg2YzAyMSIgZD0iTTM2Ni42OSwyNzguMzJjMCw4LjA5LTYuNTYsMTQuNjUtMTQuNjUsMTQuNjVzLTE0LjY1LTYuNTYtMTQuNjUtMTQuNjUsNi41Ni0xNC42NSwxNC42NS0xNC42NSwxNC42NSw2LjU2LDE0LjY1LDE0LjY1Ii8+PHBhdGggaWQ9InV1aWQtNGRhNDBjYTktYmQ3Ny00NjZhLWI0NzEtZTFmYjg4MjlhYWU5IiBjbGFzcz0idXVpZC00Y2I1NDU4My02MTM4LTQ4YjMtYTYzMS00ZDgxZDk0NjQzNzIiIGQ9Ik0zNDkuMTEsNDkuOGMwLDI3LjUxLTIyLjMsNDkuOC00OS44LDQ5LjhzLTQ5LjgtMjIuMy00OS44LTQ5LjhTMjcxLjgsMCwyOTkuMzEsMHM0OS44LDIyLjMsNDkuOCw0OS44Ii8+PHBhdGggaWQ9InV1aWQtNGNmMzY5YjEtOTA2OS00NTVhLWJiYWYtMDc0MjVkOGNmNjgxIiBjbGFzcz0idXVpZC00Y2I1NDU4My02MTM4LTQ4YjMtYTYzMS00ZDgxZDk0NjQzNzIiIGQ9Ik0xMzQuNiw0NjUuMDhjMzIuMzYsNTYuMDUsMzQuMTcsMTE1LjU5LDQuMDQsMTMyLjk4cy04MC43OC0xMy45NC0xMTMuMTQtNjkuOTljLTMyLjM2LTU2LjA1LTM0LjE3LTExNS41OS00LjA0LTEzMi45OCwzMC4xMy0xNy4zOSw4MC43OCwxMy45NCwxMTMuMTQsNjkuOTkiLz48cGF0aCBpZD0idXVpZC05MTM5ZTU5NC0zMjAwLTQ2ZTQtYjNjYi1lNWE2M2Q1NTQ3ZjMiIGNsYXNzPSJ1dWlkLTRjYjU0NTgzLTYxMzgtNDhiMy1hNjMxLTRkODFkOTQ2NDM3MiIgZD0iTTQ1Ny45LDQ2NS40MmMtMzIuMzYsNTYuMDUtMzQuMTcsMTE1LjU5LTQuMDQsMTMyLjk4czgwLjc4LTEzLjk0LDExMy4xNC02OS45OWMzMi4zNi01Ni4wNSwzNC4xNy0xMTUuNTksNC4wNC0xMzIuOTgtMzAuMTMtMTcuMzktODAuNzgsMTMuOTQtMTEzLjE0LDY5Ljk5Ii8+PHBhdGggaWQ9InV1aWQtNzA5ODljNWEtOThkZS00N2M4LTkyNjEtNGU4YzhmOGViNGMxIiBkPSJNNDcxLjE2LDcyNi41NWMwLDIzLjQ2LTc2LjczLDQyLjQ4LTE3MS4zOSw0Mi40OHMtMTcxLjM4LTE5LjAyLTE3MS4zOC00Mi40OCw3Ni43My00Mi40OCwxNzEuMzgtNDIuNDgsMTcxLjM5LDE5LjAyLDE3MS4zOSw0Mi40OCIvPjwvc3ZnPg==';
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
