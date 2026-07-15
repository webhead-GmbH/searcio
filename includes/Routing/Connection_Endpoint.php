<?php
/**
 * Connection endpoint.
 *
 * Backs the Connection tab's three actions: the "test connection" health
 * check, the zero-friction `/connect` flow (docs/api/building-a-plugin.md
 * "Zero-friction connect"), and disconnect. It is an action endpoint, not a
 * settings store: write credentials are read/written through the framework
 * Settings_Manager (via {@see Search_Cloud_Client} and {@see Connection_State})
 * so the write secret never round-trips through the browser in clear text.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Connection\Api_Response;
use Webhead\WP\SearchCloud\Connection\Connect_Request;
use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Connection_Endpoint extends Rest_API {
	public function __construct(
		private Search_Cloud_Client $client,
		private Connection_State $connection_state,
		private Woo $woo
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/connection/test', methods: 'POST', permission_callback: 'can_view' )]
	public function test_connection( WP_REST_Request $request ): WP_REST_Response {
		$response = $this->client->health();

		return new WP_REST_Response( $this->present( $response ) );
	}

	/**
	 * Fetched by the Connection tab itself (not localized eagerly on page
	 * load - see Settings_Page::get_localize_script_data()) so an unreachable
	 * Search Cloud never delays opening any other settings tab.
	 */
	#[Route( '/connection/legal', methods: 'GET', permission_callback: 'can_view' )]
	public function legal(): WP_REST_Response {
		return new WP_REST_Response( $this->client->legal_links() );
	}

	/**
	 * `email`, `admin_name`, and `site_name` are optional overrides of the site
	 * admin email / current user / blog name defaults; `terms_privacy` and
	 * `dpa` are the two consent checkboxes.
	 */
	#[Route( '/connection/connect', methods: 'POST', permission_callback: 'can_manage_settings' )]
	public function connect( WP_REST_Request $request ): WP_REST_Response {
		$terms_privacy = (bool) $request->get_param( 'terms_privacy' );
		$dpa           = (bool) $request->get_param( 'dpa' );

		// Enforced client-side too, but checked again here so an unaccepted
		// required consent never burns a call against /connect's much tighter
		// rate limit (20/hour per IP).
		if ( ! $terms_privacy ) {
			return new WP_REST_Response(
				[
					'ok'      => false,
					'flow'    => 'error',
					'status'  => 422,
					'message' => __( 'You must accept the Terms of Service and Privacy Policy to connect.', 'webhead-search-cloud' ),
				],
				422
			);
		}

		$email      = trim( (string) $request->get_param( 'email' ) );
		$admin_name = trim( (string) $request->get_param( 'admin_name' ) );
		$site_name  = trim( (string) $request->get_param( 'site_name' ) );

		$connect_request = Connect_Request::create(
			platform: $this->woo->is_active() ? 'woocommerce' : 'wordpress',
			site_name: '' !== $site_name ? $site_name : (string) get_bloginfo( 'name' ),
			site_url: home_url(),
			// Points Search Cloud's async domain-ownership ping straight at our
			// own Verify_Endpoint instead of it having to guess a WordPress path.
			verify_url: rest_url( 'search-cloud/v1/verify' ),
			admin_email: '' !== $email ? $email : (string) get_option( 'admin_email' ),
			admin_name: '' !== $admin_name ? $admin_name : (string) wp_get_current_user()->display_name,
			idempotency_key: $this->connection_state->idempotency_key(),
			terms_privacy: $terms_privacy,
			dpa: $dpa
		);

		$response = $this->client->connect( $connect_request->to_payload() );

		return new WP_REST_Response(
			$this->present_connect( $response, $connect_request->admin_email ),
			$this->connect_status_code( $response )
		);
	}

	/**
	 * Mirrors `/connect` (docs/api/building-a-plugin.md "Disconnecting"):
	 * `DELETE /disconnect` permanently deletes the site and its index on
	 * Search Cloud's side, so it's called first. Local credentials are only
	 * cleared once that has actually happened - either it succeeded, or the
	 * `401`/`404` response means there was never anything valid server-side to
	 * begin with. Any other failure (network, `429`, `5xx`) keeps the local
	 * credentials so the admin can retry instead of ending up with an orphaned
	 * server-side site and no way to reach it.
	 */
	#[Route( '/connection/disconnect', methods: 'POST', permission_callback: 'can_manage_settings' )]
	public function disconnect(): WP_REST_Response {
		if ( $this->client->is_configured() ) {
			$response = $this->client->disconnect();

			if ( $response->transport_error ) {
				return new WP_REST_Response(
					[ 'ok' => false, 'message' => __( 'Could not reach Search Cloud. Try again.', 'webhead-search-cloud' ) ],
					502
				);
			}

			if ( ! $response->ok() && ! in_array( $response->status, [ 401, 404 ], true ) ) {
				return new WP_REST_Response(
					[ 'ok' => false, 'message' => __( 'Could not disconnect from Search Cloud. Try again.', 'webhead-search-cloud' ) ],
					502
				);
			}
		}

		$this->connection_state->disconnect();

		return new WP_REST_Response( [ 'ok' => true ] );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function present( Api_Response $response ): array {
		if ( $response->transport_error ) {
			return [
				'ok'      => false,
				'status'  => 0,
				'message' => __( 'Could not reach Search Cloud.', 'webhead-search-cloud' ),
			];
		}

		if ( ! $response->ok() ) {
			return [
				'ok'      => false,
				'status'  => $response->status,
				'message' => $this->error_message( $response->status ),
			];
		}

		$body      = $response->body();
		$documents = is_array( $body['usage']['documents'] ?? null ) ? $body['usage']['documents'] : [];

		$plan      = is_array( $body['plan'] ?? null ) ? $body['plan'] : [];
		$languages = is_array( $plan['languages'] ?? null ) ? $plan['languages'] : [];

		return [
			'ok'               => true,
			'status'           => $response->status,
			// Site id is resolved server-side from the write key/secret; there's no Site ID field in the connection UI.
			'site_id'          => isset( $body['site']['id'] ) ? (int) $body['site']['id'] : null,
			'site_status'      => isset( $body['site']['status'] ) ? (string) $body['site']['status'] : '',
			'last_synced_at'   => $body['site']['last_synced_at'] ?? null,
			'engine_reachable' => (bool) ( $body['engine']['reachable'] ?? false ),
			'documents'        => [
				'used'       => isset( $documents['used'] ) ? (int) $documents['used'] : null,
				'limit'      => isset( $documents['limit'] ) ? ( null === $documents['limit'] ? null : (int) $documents['limit'] ) : null,
				'percent'    => isset( $documents['percent'] ) ? (int) $documents['percent'] : null,
				'near_limit' => (bool) ( $documents['near_limit'] ?? false ),
			],
			// Language entitlement, needed before the admin UI can offer a language picker at all.
			'languages'        => [
				'limit'   => isset( $languages['limit'] ) ? ( null === $languages['limit'] ? null : (int) $languages['limit'] ) : null,
				'allowed' => is_array( $languages['allowed'] ?? null ) ? array_values( $languages['allowed'] ) : [],
			],
			// Plan tier, so the admin header can surface an "Upgrade plan" CTA on
			// Free accounts (docs/api/health.md `plan.is_free` / `plan.upgrade_url`).
			'plan'             => [
				'is_free'     => (bool) ( $plan['is_free'] ?? false ),
				'name'        => isset( $plan['name'] ) ? (string) $plan['name'] : '',
				'upgrade_url' => isset( $plan['upgrade_url'] ) && is_string( $plan['upgrade_url'] ) ? esc_url_raw( $plan['upgrade_url'] ) : '',
			],
		];
	}

	/**
	 * @return array<string,mixed>
	 */
	private function present_connect( Api_Response $response, string $email ): array {
		if ( $response->transport_error ) {
			return [
				'ok'      => false,
				'flow'    => 'error',
				'status'  => 0,
				'message' => __( 'Could not reach Search Cloud.', 'webhead-search-cloud' ),
			];
		}

		if ( ! $response->ok() ) {
			return [
				'ok'                  => false,
				'flow'                => 'error',
				'status'              => $response->status,
				'message'             => $this->connect_error_message( $response ),
				'reveal_manual_entry' => 409 === $response->status,
			];
		}

		$body = $response->body();

		if ( 'pending_claim' === ( $body['status'] ?? '' ) ) {
			$this->connection_state->set_pending_claim( $email );

			return [
				'ok'    => true,
				'flow'  => 'pending_claim',
				'email' => $email,
			];
		}

		$this->connection_state->save_credentials(
			(string) ( $body['write_key'] ?? '' ),
			(string) ( $body['write_secret'] ?? '' ),
			(string) ( $body['search_key'] ?? '' )
		);

		return array_merge(
			[ 'flow' => 'connected' ],
			$this->present( $this->client->health() )
		);
	}

	private function connect_status_code( Api_Response $response ): int {
		if ( $response->transport_error ) {
			return 502;
		}

		// A `pending_claim` 201 and a new-account 201 both keep their original
		// 2xx status; only surface the API's own error status otherwise.
		return $response->status;
	}

	private function connect_error_message( Api_Response $response ): string {
		if ( 409 === $response->status ) {
			return __( 'This domain is already connected. Log into the Search Cloud dashboard to retrieve your keys and paste them below.', 'webhead-search-cloud' );
		}

		if ( 429 === $response->status ) {
			return __( 'Too many connect attempts. Wait a while and try again.', 'webhead-search-cloud' );
		}

		if ( 503 === $response->status ) {
			return __( 'Search Cloud cannot provision new accounts right now. Try again later.', 'webhead-search-cloud' );
		}

		$body    = $response->body();
		$message = $body['message'] ?? null;

		return is_string( $message ) && '' !== $message
			? $message
			: __( 'Connection failed.', 'webhead-search-cloud' );
	}

	private function error_message( int $status ): string {
		return match ( $status ) {
			401     => __( 'Invalid write credentials. Check the write key and secret.', 'webhead-search-cloud' ),
			403     => __( 'Site is disabled in Search Cloud.', 'webhead-search-cloud' ),
			404     => __( 'No site found for these credentials.', 'webhead-search-cloud' ),
			default => __( 'Connection failed.', 'webhead-search-cloud' ),
		};
	}
}
