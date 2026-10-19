<?php
/**
 * Domain-ownership verification callback for the zero-friction connect flow.
 *
 * `Connection_Endpoint::connect()` sends this route's URL as `verify_url` on
 * `POST /connect`. After a new-account connect, Search Cloud pings
 * `GET {verify_url}?token=<hmac>` in the background and expects
 * `{"write_key": "<the write key you were issued>"}` back - see
 * docs/api/building-a-plugin.md "Domain ownership verification (informational)".
 * The `token` proves itself on Search Cloud's side when it compares our
 * response against its own record of the write key it issued; this plugin
 * has no way to recompute it (it's derived from Search Cloud's own secret)
 * and doesn't need to try - which is also why its presence protects nothing:
 * `?token=x` passes that check. What keeps the write key from a scanner is the
 * verification window {@see Connection_State::open_verification_window()}
 * opens when this site starts a connection; outside it the route answers 404.
 * This route only ever echoes the write key already stored locally and never
 * exposes the write secret.
 *
 * Deliberately registered under `search-cloud/v1`, not this plugin's own
 * `webhead-search-cloud/v1` namespace, so the URL sent as `verify_url` stays
 * stable even if this plugin's slug ever changes.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

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

	#[Route( '/verify', methods: 'GET', permission_callback: 'is_public', args: [ 'token' => [ 'type' => 'string' ] ] )]
	public function verify( WP_REST_Request $request ): WP_REST_Response {
		/*
		 * The only legitimate caller is Search Cloud's domain-ownership ping,
		 * which carries `?token=<hmac>`. That HMAC is computed over the
		 * service's own application key, so no plugin can ever recompute it -
		 * requiring the parameter proves nothing about who is asking, and on
		 * its own it handed the write key to anyone who appended `?token=x`.
		 *
		 * What can be checked is timing. The ping is dispatched once, minutes
		 * after this site asked to be connected, and is never repeated - so the
		 * route answers only while a connection attempt this site started is
		 * still expecting it, and is closed the rest of the time.
		 */
		if ( '' === trim( (string) $request->get_param( 'token' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Missing verification token.', 'searcio' ) ], 400 );
		}

		if ( ! $this->connection_state->verification_window_is_open() ) {
			return new WP_REST_Response(
				[ 'message' => __( 'No verification is in progress.', 'searcio' ) ],
				404
			);
		}

		if ( ! $this->client->is_configured() ) {
			return new WP_REST_Response( [ 'message' => __( 'Not connected.', 'searcio' ) ], 404 );
		}

		return new WP_REST_Response( [ 'write_key' => $this->client->write_key() ] );
	}

	public function is_public(): bool {
		return true;
	}
}
