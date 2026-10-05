<?php
/**
 * Sync REST endpoint integration tests.
 *
 * Verifies the `webhead-search-cloud/v1/sync/*` routes are registered with the
 * right namespace, enforce the VIEW / RUN_SYNC capability split, and return the
 * documented success and 409 error payloads. Runs against the real REST server.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Endpoint_Test extends Integration_Test_Case {
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

	public function test_sync_routes_are_registered_under_the_plugin_namespace(): void {
		$routes = $this->server->get_routes();

		$this->assertArrayHasKey( '/webhead-search-cloud/v1/sync/status', $routes );
		$this->assertArrayHasKey( '/webhead-search-cloud/v1/sync/start', $routes );
		$this->assertArrayHasKey( '/webhead-search-cloud/v1/sync/pause', $routes );
		$this->assertArrayHasKey( '/webhead-search-cloud/v1/sync/cancel', $routes );
	}

	public function test_status_requires_the_view_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/sync/status' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_status_returns_the_expected_shape_for_a_viewer(): void {
		$this->login_operator();

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/sync/status' ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertArrayHasKey( 'configured', $data );
		$this->assertArrayHasKey( 'indexable', $data );
		$this->assertArrayHasKey( 'active', $data );
		$this->assertNull( $data['active'] );
	}

	public function test_start_requires_the_run_sync_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/sync/start' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_start_returns_409_when_not_configured(): void {
		$this->login_operator();

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/sync/start' ) );

		$this->assertSame( 409, $response->get_status() );
		$this->assertFalse( $response->get_data()['ok'] );
	}

	public function test_start_then_status_reports_the_active_run(): void {
		$this->login_operator();
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$start = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/sync/start' ) );
		$this->assertSame( 200, $start->get_status() );
		$this->assertTrue( $start->get_data()['ok'] );

		$status = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/sync/status' ) );
		$active = $status->get_data()['active'];

		$this->assertNotNull( $active );
		$this->assertSame( Sync_Status::Running->value, $active['status'] );
	}

	public function test_cancel_of_a_stuck_run_succeeds_over_rest(): void {
		$this->login_operator();
		$id = $this->make_running_run();
		$this->clear_tick();

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/sync/cancel' );
		$request->set_param( 'id', $id );
		$response = $this->server->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );
		$this->assertSame( Sync_Status::Cancelled->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_control_action_returns_409_when_no_run_is_active(): void {
		$this->login_operator();

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/sync/pause' ) );

		$this->assertSame( 409, $response->get_status() );
	}

	/**
	 * A cast is not a check: `(string)` on `order_by[]=id` is the word "Array"
	 * and a PHP warning. The routes declare the type of what they take, and
	 * WordPress refuses a value of another shape before the method runs.
	 *
	 * @dataProvider wrongly_shaped_values
	 *
	 * @param  array<string,mixed>  $params
	 */
	public function test_a_value_of_the_wrong_shape_is_refused_before_the_method_runs( string $method, string $route, array $params ): void {
		$this->login_operator();

		$request = new WP_REST_Request( $method, '/webhead-search-cloud/v1' . $route );

		foreach ( $params as $name => $value ) {
			$request->set_param( $name, $value );
		}

		$response = $this->server->dispatch( $request );

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'rest_invalid_param', $response->get_data()['code'] );
		$this->assertSame( array_keys( $params ), array_keys( $response->get_data()['data']['params'] ) );
	}

	/**
	 * @return array<string,array{0:string,1:string,2:array<string,mixed>}>
	 */
	public static function wrongly_shaped_values(): array {
		return [
			'a list for the sort column'  => [ 'GET', '/sync/history', [ 'order_by' => [ 'id' ] ] ],
			'a list for the status'       => [ 'GET', '/sync/history', [ 'status' => [ 'completed' ] ] ],
			'a word for the page'         => [ 'GET', '/sync/history', [ 'page' => 'two' ] ],
			'a word for the page size'    => [ 'GET', '/sync/history', [ 'per_page' => 'all' ] ],
			'a word for the force switch' => [ 'POST', '/sync/start', [ 'force' => 'please' ] ],
			'a word for the run to pause' => [ 'POST', '/sync/pause', [ 'id' => 'latest' ] ],
		];
	}

	public function test_the_history_still_answers_what_the_table_sends(): void {
		$this->login_operator();

		$request = new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/sync/history' );
		$request->set_query_params(
			[
				'page'     => '1',
				'per_page' => '20',
				'order_by' => 'created_at',
				'order'    => 'asc',
				'status'   => Sync_Status::Completed->value,
			]
		);

		$response = $this->server->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertArrayHasKey( 'items', $response->get_data() );
		$this->assertArrayHasKey( 'total', $response->get_data() );
	}

	private function login_operator(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}
}
