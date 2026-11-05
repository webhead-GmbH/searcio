<?php
/**
 * Verify REST endpoint integration tests (`search-cloud/v1/verify/<code>`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Verify_Endpoint_Test extends Integration_Test_Case {
	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		do_action( 'rest_api_init' );
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	public function test_verify_is_registered_under_the_search_cloud_namespace_not_the_plugin_one(): void {
		$this->assertArrayHasKey( '/search-cloud/v1/verify/(?P<code>[A-Za-z0-9]{32})', $this->server->get_routes() );
	}

	/**
	 * Searcio's ping signs in as nobody: what lets it in is the code this site
	 * sent it, not a user.
	 */
	public function test_searcio_gets_only_the_write_key_with_the_code_it_was_sent(): void {
		wp_set_current_user( 0 );
		$this->connect_client();
		$code = $this->state()->open_verification_window();

		$response = $this->server->dispatch( $this->verify_request( $code ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( [ 'write_key' => 'test-write-key' ], $data );
	}

	/**
	 * The token is an HMAC over Searcio's own application key, which the
	 * plugin cannot check, so a token with any other code gets nothing.
	 */
	public function test_any_other_code_is_told_the_route_does_not_exist(): void {
		wp_set_current_user( 0 );
		$this->connect_client();
		$code = $this->state()->open_verification_window();

		foreach ( [ str_repeat( 'a', 32 ), strtoupper( $code ) === $code ? strtolower( $code ) : strtoupper( $code ) ] as $wrong ) {
			$response = $this->server->dispatch( $this->verify_request( $wrong ) );

			$this->assertSame( 404, $response->get_status(), $wrong );
			$this->assertArrayNotHasKey( 'write_key', (array) $response->get_data() );
		}

		$this->assertSame( 404, $this->server->dispatch( new WP_REST_Request( 'GET', '/search-cloud/v1/verify' ) )->get_status(), 'The old route without a code is gone.' );
	}

	public function test_the_code_answers_once(): void {
		wp_set_current_user( 0 );
		$this->connect_client();
		$code = $this->state()->open_verification_window();

		$this->assertSame( 200, $this->server->dispatch( $this->verify_request( $code ) )->get_status() );
		$this->assertSame( 404, $this->server->dispatch( $this->verify_request( $code ) )->get_status() );
	}

	public function test_the_code_expires_with_the_connection_attempt(): void {
		wp_set_current_user( 0 );
		$this->connect_client();
		$code = $this->state()->open_verification_window();
		$this->settings()->set( Plugin_Settings::VERIFICATION_OPENED_AT, time() - ( 2 * HOUR_IN_SECONDS ) );

		$response = $this->server->dispatch( $this->verify_request( $code ) );

		$this->assertSame( 404, $response->get_status() );
		$this->assertArrayNotHasKey( 'write_key', (array) $response->get_data() );
	}

	/** A retried connect may be answered with the first attempt's `verify_url`. */
	public function test_a_retry_within_the_window_keeps_the_code(): void {
		$first = $this->state()->open_verification_window();

		$this->assertMatchesRegularExpression( '/^[A-Za-z0-9]{32}$/', $first );
		$this->assertSame( $first, $this->state()->open_verification_window() );

		$this->settings()->set( Plugin_Settings::VERIFICATION_OPENED_AT, time() - ( 2 * HOUR_IN_SECONDS ) );

		$this->assertNotSame( $first, $this->state()->open_verification_window(), 'A new attempt after the window gets a new code.' );
	}

	public function test_verify_returns_404_when_not_connected(): void {
		wp_set_current_user( 0 );
		$code = $this->state()->open_verification_window();

		$this->assertSame( 404, $this->server->dispatch( $this->verify_request( $code ) )->get_status() );
	}

	private function state(): \Webhead\WP\SearchCloud\Connection\Connection_State {
		return $this->service( 'connection_state' );
	}

	private function verify_request( string $code ): WP_REST_Request {
		$request = new WP_REST_Request( 'GET', '/search-cloud/v1/verify/' . $code );
		$request->set_param( 'token', 'signed-token-from-search-cloud' );

		return $request;
	}
}
