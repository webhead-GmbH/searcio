<?php
/**
 * Domain-ownership verification callback for the zero-friction connect flow.
 *
 * `Connection_Endpoint::connect()` sends this route's URL as `verify_url` on
 * `POST /connect`, with a one-time code in its path. After a new-account
 * connect, Searcio pings `GET {verify_url}?token=<hmac>` in the background
 * and expects `{"write_key": "<the write key you were issued>"}` back - see
 * docs/api/building-a-plugin.md "Domain ownership verification (informational)".
 *
 * The `token` is an HMAC over Searcio's own application key, which this
 * plugin cannot recompute, so it protects nothing here. The code does: this
 * site sent it to Searcio alone, over HTTPS, and the route answers only a
 * request that carries it, only while the connection attempt that sent it can
 * still be answered ({@see Connection_State::open_verification_window()}),
 * and only once. Any other request is told the route does not exist. It is in
 * the path because Searcio replaces the query string of `verify_url` with its
 * own. The route only ever answers with the write key already stored locally
 * and never exposes the write secret.
 *
 * Deliberately registered under `search-cloud/v1`, not this plugin's own
 * `searcio/v1` namespace, so the URL sent as `verify_url` stays
 * stable even if this plugin's slug ever changes.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Verify_Endpoint extends Rest_API {
	public function __construct(
		private Search_Cloud_Client $client,
		private Connection_State $connection_state
	) {}

	protected function get_rest_namespace(): string {
		return 'search-cloud/v1';
	}

	#[Route( '/verify/(?P<code>[A-Za-z0-9]{32})', methods: 'GET', permission_callback: 'is_searcio', args: [ 'token' => [ 'type' => 'string' ] ] )]
	public function verify( WP_REST_Request $request ): WP_REST_Response {
		if ( ! $this->client->is_configured() ) {
			return new WP_REST_Response( [ 'message' => __( 'Not connected.', 'searcio' ) ], 404 );
		}

		$this->connection_state->close_verification_window();

		return new WP_REST_Response( [ 'write_key' => $this->client->write_key() ] );
	}

	/**
	 * Whether the request is Searcio's ownership ping: it carries the code
	 * this site sent with its last connection attempt, while that attempt can
	 * still be answered. No user is signed in for it, so the code is what is
	 * checked. Anything else is told the route does not exist.
	 */
	public function is_searcio( WP_REST_Request $request ): bool|WP_Error {
		if ( $this->connection_state->verification_code_matches( (string) $request->get_param( 'code' ) ) ) {
			return true;
		}

		return new WP_Error( 'rest_no_route', __( 'No verification is in progress.', 'searcio' ), [ 'status' => 404 ] );
	}
}
