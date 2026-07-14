<?php
/**
 * Domain-ownership verification callback for the zero-friction connect flow.
 *
 * `Connection_Endpoint::connect()` sends this route's URL as `verify_url` on
 * `POST /connect`. After a new-account connect, Search Cloud pings
 * `GET {verify_url}?token=<hmac>` in the background and expects
 * `{"write_key": "<the write key you were issued>"}` back — see
 * docs/api/building-a-plugin.md "Domain ownership verification (informational)".
 * The `token` proves itself on Search Cloud's side when it compares our
 * response against its own record of the write key it issued; this plugin
 * has no way to recompute it (it's derived from Search Cloud's own secret)
 * and doesn't need to try. It is still required to be present, though: a
 * tokenless request is rejected so the write key is never handed to a bare
 * `GET /verify` from a scanner. This route only ever echoes the write key
 * already stored locally and never exposes the write secret.
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
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Verify_Endpoint extends Rest_API {
	public function __construct( private Search_Cloud_Client $client ) {}

	protected function get_rest_namespace(): string {
		return 'search-cloud/v1';
	}

	#[Route( '/verify', methods: 'GET', permission_callback: 'is_public' )]
	public function verify( WP_REST_Request $request ): WP_REST_Response {
		// The legitimate caller is Search Cloud's async domain-ownership ping,
		// which always carries `?token=<hmac>` (see the class docblock). The
		// token can't be validated locally, but requiring its presence keeps the
		// write key out of a bare, tokenless `GET /verify` from a scanner or a
		// curious visitor — the key is treated as a secret everywhere else, so it
		// should not be handed to arbitrary unauthenticated callers.
		if ( '' === trim( (string) $request->get_param( 'token' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Missing verification token.', 'webhead-search-cloud' ) ], 400 );
		}

		if ( ! $this->client->is_configured() ) {
			return new WP_REST_Response( [ 'message' => __( 'Not connected.', 'webhead-search-cloud' ) ], 404 );
		}

		return new WP_REST_Response( [ 'write_key' => $this->client->write_key() ] );
	}

	public function is_public(): bool {
		return true;
	}
}
