<?php
/**
 * `/placement`: the Placement tab's settings, read and written by those who
 * may, cleaned on the way in.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Placement_Endpoint_Test extends Integration_Test_Case {
	private const ROUTE = '/webhead-search-cloud/v1/placement';

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

	public function test_route_is_registered_in_the_plugins_namespace(): void {
		$this->assertArrayHasKey( self::ROUTE, $this->server->get_routes() );
	}

	public function test_reading_needs_a_user_who_may_view_the_settings(): void {
		$this->acting_as( '' );
		$this->assertSame( 401, $this->dispatch( 'GET' )->get_status() );

		$this->acting_as( 'subscriber' );
		$this->assertSame( 403, $this->dispatch( 'GET' )->get_status() );
	}

	public function test_reading_answers_with_the_settings_and_what_the_tab_needs(): void {
		$this->acting_as();

		$data = $this->dispatch( 'GET' )->get_data();

		$this->assertFalse( $data['placement']['takeover'] );
		$this->assertSame( 'icon', $data['placement']['search']['mode'] );
		$this->assertArrayHasKey( 'name', $data['theme'] );
		$this->assertSame( home_url( '/' ), $data['home'] );
		$this->assertStringContainsString( 'searcio-preview=1', $data['preview']['url'] );
		$this->assertNotSame( '', $data['preview']['nonce'] );
	}

	public function test_the_theme_is_given_its_suggestion(): void {
		$this->acting_as();
		add_filter( 'template', static fn (): string => 'enfold' );

		$this->assertSame( [ '#menu-item-search > a' ], $this->dispatch( 'GET' )->get_data()['theme']['suggestion']['selectors'] );
	}

	public function test_saving_needs_a_user_who_may_manage_the_settings(): void {
		$this->acting_as( 'editor' );

		$this->assertContains( $this->dispatch( 'POST', [ 'placement' => [ 'takeover' => true ] ] )->get_status(), [ 401, 403 ] );
		$this->assertFalse( $this->service( 'placement_config' )->options()->takeover );
	}

	public function test_saving_cleans_and_answers_with_what_was_stored(): void {
		$this->acting_as();

		$response = $this->dispatch(
			'POST',
			[
				'placement' => [
					'takeover'  => true,
					'openers'   => true,
					'selectors' => [ ' #menu-item-search > a ', '', '.x{}' ],
					'floating'  => [ 'enabled' => true, 'offset' => 9999 ],
					'search'    => [ 'mode' => 'banner', 'placeholder' => '<i>Find</i>' ],
				],
			]
		);

		$this->assertSame( 200, $response->get_status() );

		$saved = $response->get_data()['placement'];

		$this->assertTrue( $response->get_data()['saved'] );
		$this->assertSame( [ '#menu-item-search > a', '.x' ], $saved['selectors'] );
		$this->assertSame( 400, $saved['floating']['offset'] );
		$this->assertSame( 'icon', $saved['search']['mode'] );
		$this->assertSame( 'Find', $saved['search']['placeholder'] );
		$this->assertTrue( $this->service( 'placement_config' )->options()->takeover );
	}

	public function test_saving_without_settings_is_refused_with_a_reason(): void {
		$this->acting_as();

		$response = $this->dispatch( 'POST', [ 'something' => 'else' ] );

		$this->assertSame( 400, $response->get_status() );
		$this->assertNotEmpty( $response->get_data()['message'] );
	}

	/**
	 * @param  array<string,mixed>  $body
	 */
	private function dispatch( string $method, array $body = [] ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, self::ROUTE );

		if ( [] !== $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( (string) wp_json_encode( $body ) );
		}

		return $this->server->dispatch( $request );
	}
}
