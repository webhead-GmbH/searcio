<?php
/**
 * Verify REST endpoint integration tests (`search-cloud/v1/verify`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
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
		$routes = $this->server->get_routes();

		$this->assertArrayHasKey( '/search-cloud/v1/verify', $routes );
	}

	public function test_verify_is_public_and_requires_no_authentication(): void {
		wp_set_current_user( 0 );

		$response = $this->server->dispatch( $this->verify_request() );

		$this->assertNotSame( 401, $response->get_status() );
		$this->assertNotSame( 403, $response->get_status() );
	}

	public function test_verify_rejects_a_request_without_a_token(): void {
		wp_set_current_user( 0 );
		$this->connect_client();

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/search-cloud/v1/verify' ) );
		$data     = $response->get_data();

		$this->assertSame( 400, $response->get_status() );
		$this->assertArrayNotHasKey( 'write_key', $data );
	}

	public function test_verify_returns_404_when_not_connected(): void {
		wp_set_current_user( 0 );

		$response = $this->server->dispatch( $this->verify_request() );

		$this->assertSame( 404, $response->get_status() );
	}

	public function test_verify_returns_only_the_write_key_when_connected(): void {
		wp_set_current_user( 0 );
		$this->connect_client();

		$response = $this->server->dispatch( $this->verify_request() );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'test-write-key', $data['write_key'] );
		$this->assertArrayNotHasKey( 'write_secret', $data );
	}

	private function verify_request(): WP_REST_Request {
		$request = new WP_REST_Request( 'GET', '/search-cloud/v1/verify' );
		$request->set_param( 'token', 'signed-token-from-search-cloud' );

		return $request;
	}
}
