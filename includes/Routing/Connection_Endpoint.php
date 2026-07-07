<?php
/**
 * Connection endpoint.
 *
 * Exposes the "test connection" action used by the admin UI. It is an action
 * endpoint, not a settings store: it reads connection credentials through the
 * framework Settings_Manager and calls the Search Cloud health endpoint
 * server-side so the write secret never reaches the browser.
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
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Connection_Endpoint extends Rest_API {
	public function __construct(
		private Search_Cloud_Client $client
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/connection/test', methods: 'POST', permission_callback: 'can_view' )]
	public function test_connection( WP_REST_Request $request ): WP_REST_Response {
		$response = $this->client->health();

		return new WP_REST_Response( $this->present( $response ) );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
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

		$languages = is_array( $body['plan']['languages'] ?? null ) ? $body['plan']['languages'] : [];

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
		];
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
