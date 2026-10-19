<?php
/**
 * Search configuration REST endpoint integration tests.
 *
 * The endpoint is a proxy: Searcio owns the configuration and this route
 * only forwards. That is exactly what makes it worth pinning - a section the
 * API adds (redirects, a new feature switch, merchandising's category trigger)
 * has to reach the admin UI without any change here, and a section the admin UI
 * sends has to arrive unaltered. A proxy that quietly drops a key it does not
 * recognise would be indistinguishable from the feature not existing.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Search_Config_Endpoint_Test extends Integration_Test_Case {
	private const ROUTE = '/webhead-search-cloud/v1/search-config';

	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		do_action( 'rest_api_init' );

		$this->connect_client();
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	public function test_route_is_registered(): void {
		$this->assertArrayHasKey( self::ROUTE, $this->server->get_routes() );
	}

	/** A logged-out request is 401 (not who you are yet); a logged-in one without the capability is 403. */
	public function test_reading_requires_a_logged_in_user_with_the_view_capability(): void {
		wp_set_current_user( 0 );

		$this->assertSame( 401, $this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$this->assertSame( 403, $this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) )->get_status() );
	}

	public function test_writing_requires_more_than_the_view_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'PUT', self::ROUTE ) );

		$this->assertSame( 403, $response->get_status() );
	}

	/**
	 * Every section reaches the admin UI, including the ones added to the API
	 * after this endpoint was written.
	 */
	public function test_get_passes_the_whole_configuration_through(): void {
		$this->as_admin();
		$this->fake_http(
			fn () => $this->http_ok(
				[
					'searchable_fields' => [ [ 'field' => 'title', 'weight' => 5 ] ],
					'facet_fields'      => [ 'brand' ],
					'languages'         => [ 'de', 'en' ],
					'merchandising'     => [
						[
							'query'        => 'winter',
							'filter_field' => 'category',
							'filter_value' => 'shoes',
							'pinned'       => [ 'p-100' ],
							'hidden'       => [],
							'banner'       => 'Shoe sale',
						],
					],
					'redirects'         => [ [ 'query' => 'black friday', 'url' => 'https://example.com/bf' ] ],
					'features'          => [
						'ai_search'      => [ 'available' => true, 'enabled' => true, 'status' => 'ready' ],
						'visual_search'  => [ 'available' => true, 'enabled' => false ],
						'visual_tagging' => [ 'available' => true, 'enabled' => false ],
					],
				]
			)
		);

		$data = $this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) )->get_data();

		$this->assertSame( [ [ 'query' => 'black friday', 'url' => 'https://example.com/bf' ] ], $data['redirects'] );
		$this->assertSame( 'category', $data['merchandising'][0]['filter_field'] );
		$this->assertSame( 'shoes', $data['merchandising'][0]['filter_value'] );
		$this->assertFalse( $data['features']['visual_search']['enabled'] );
		$this->assertTrue( $data['features']['visual_search']['available'] );
	}

	/**
	 * The API decides what a valid rule is; the plugin must not second-guess it
	 * by filtering the payload on the way out.
	 */
	public function test_put_sends_the_admin_payload_on_unaltered(): void {
		$this->as_admin();
		$sent = null;

		$this->fake_http(
			function ( string $url, array $args ) use ( &$sent ) {
				$sent = json_decode( (string) ( $args['body'] ?? '' ), true );

				return $this->http_ok( [ 'languages' => [] ] );
			}
		);

		$request = new WP_REST_Request( 'PUT', self::ROUTE );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body(
			(string) wp_json_encode(
				[
					'redirects' => [ [ 'query' => 'black friday', 'url' => '/bf' ] ],
					'features'  => [ 'visual_search' => [ 'enabled' => true ] ],
				]
			)
		);

		$this->server->dispatch( $request );

		$this->assertSame( [ [ 'query' => 'black friday', 'url' => '/bf' ] ], $sent['redirects'] );
		$this->assertTrue( $sent['features']['visual_search']['enabled'] );
	}

	/**
	 * A 422 carries the field-level errors the form marks its inputs with, so it
	 * has to arrive with its status and envelope intact rather than as a
	 * flattened "save failed".
	 */
	public function test_a_validation_failure_reaches_the_admin_ui_with_its_field_errors(): void {
		$this->as_admin();
		$this->fake_http(
			fn () => $this->http_ok(
				[
					'message' => 'The redirects.0.url field must be a valid URL.',
					'errors'  => [ 'redirects.0.url' => [ 'The redirects.0.url field must be a valid URL.' ] ],
				],
				422
			)
		);

		$request = new WP_REST_Request( 'PUT', self::ROUTE );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( (string) wp_json_encode( [ 'redirects' => [ [ 'query' => 'bf', 'url' => 'nope' ] ] ] ) );

		$response = $this->server->dispatch( $request );

		$this->assertSame( 422, $response->get_status() );
		$this->assertArrayHasKey( 'redirects.0.url', $response->get_data()['errors'] );
	}

	/**
	 * `languages` is mirrored locally on every successful read so the sync and
	 * the front end do not need a live round trip - but only on success, or a
	 * failed save would wipe the mirror.
	 */
	public function test_a_successful_read_mirrors_the_languages_locally(): void {
		$this->as_admin();
		$this->fake_http( fn () => $this->http_ok( [ 'languages' => [ 'de', 'en' ] ] ) );

		$this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) );

		$this->assertSame( [ 'de', 'en' ], $this->service( 'language_config' )->enabled_languages() );
	}

	public function test_an_unreachable_service_answers_502_rather_than_an_empty_configuration(): void {
		$this->as_admin();
		$this->fake_http( static fn () => new \WP_Error( 'http_request_failed', 'timed out' ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) );

		$this->assertSame( 502, $response->get_status() );
	}

	private function as_admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}
}
