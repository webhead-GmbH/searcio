<?php
/**
 * Connection REST endpoint integration tests: `/connection/test`,
 * `/connection/connect` (the zero-friction flow), and `/connection/disconnect`.
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

final class Connection_Endpoint_Test extends Integration_Test_Case {
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

	public function test_test_connection_requires_the_view_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_connect_requires_the_manage_settings_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_test_connection_surfaces_the_plan_tier_and_upgrade_url(): void {
		$this->login_admin();
		$this->fake_http( fn (): array => $this->http_ok(
			[
				'site'  => [ 'id' => 4821, 'status' => 'connected', 'last_synced_at' => null ],
				'usage' => [ 'documents' => [ 'used' => 10, 'limit' => 1000 ] ],
				'plan'  => [
					'id'          => 1,
					'slug'        => 'free',
					'name'        => 'Free',
					'is_free'     => true,
					'upgrade_url' => 'https://search.example.com/acme/billing',
					'languages'   => [ 'limit' => 1, 'allowed' => [] ],
				],
			]
		) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['plan']['is_free'] );
		$this->assertSame( 'Free', $data['plan']['name'] );
		$this->assertSame( 'https://search.example.com/acme/billing', $data['plan']['upgrade_url'] );
	}

	/**
	 * The storefront decides on the searcio logo from the tier and asks
	 * nobody, so it is kept whenever an admin screen checks the connection.
	 */
	public function test_test_connection_keeps_the_plan_tier_for_the_storefront(): void {
		$this->login_admin();
		$this->fake_http( fn (): array => $this->http_ok( [ 'plan' => [ 'is_free' => true, 'name' => 'Free' ] ] ) );

		$this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );

		$this->assertSame( 'free', $this->settings()->get( Plugin_Settings::PLAN_TIER ) );
	}

	public function test_test_connection_keeps_the_tier_it_had_when_the_answer_names_none(): void {
		$this->login_admin();
		$this->settings()->set( Plugin_Settings::PLAN_TIER, 'free' );
		$this->fake_http( fn (): array => $this->http_ok( [ 'site' => [ 'id' => 1, 'status' => 'connected' ] ] ) );

		$this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );

		$this->assertSame( 'free', $this->settings()->get( Plugin_Settings::PLAN_TIER ) );
	}

	public function test_test_connection_surfaces_every_metered_allowance_not_just_documents(): void {
		$this->login_admin();
		$this->fake_http( fn (): array => $this->http_ok(
			[
				'site'  => [ 'id' => 4821, 'status' => 'connected' ],
				'usage' => [
					'documents'  => [ 'used' => 10, 'limit' => 1000, 'percent' => 1, 'exceeded' => false, 'near_limit' => false ],
					'searches'   => [ 'used' => 9500, 'limit' => 10000, 'percent' => 95, 'exceeded' => false, 'near_limit' => true ],
					'sites'      => [ 'used' => 1, 'limit' => 1, 'percent' => 100, 'exceeded' => false, 'near_limit' => true ],
					// An allowance the plan does not meter at all.
					'ai_messages' => [ 'used' => 3, 'limit' => null, 'percent' => null, 'exceeded' => false, 'near_limit' => false ],
				],
			]
		) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 9500, $data['usage']['searches']['used'] );
		$this->assertSame( 10000, $data['usage']['searches']['limit'] );
		$this->assertTrue( $data['usage']['searches']['near_limit'] );
		$this->assertFalse( $data['usage']['searches']['exceeded'] );
		// An unmetered allowance keeps a null limit rather than being cast to 0,
		// which the admin would render as a spent allowance.
		$this->assertNull( $data['usage']['ai_messages']['limit'] );
		// Account-scoped metrics still come through; the admin decides what to
		// show rather than the response deciding what exists.
		$this->assertArrayHasKey( 'sites', $data['usage'] );
		// The documents figure the sync screens already relied on is unchanged.
		$this->assertSame( 1000, $data['documents']['limit'] );
	}

	public function test_test_connection_defaults_plan_to_not_free_when_absent(): void {
		$this->login_admin();
		$this->fake_http( fn (): array => $this->http_ok(
			[
				'site'  => [ 'id' => 1, 'status' => 'connected' ],
				'usage' => [ 'documents' => [ 'used' => 0, 'limit' => 1000 ] ],
			]
		) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/test' ) );
		$data     = $response->get_data();

		$this->assertFalse( $data['plan']['is_free'] );
		$this->assertSame( '', $data['plan']['upgrade_url'] );
	}

	public function test_connect_rejects_a_missing_terms_privacy_consent_without_calling_the_api(): void {
		$this->login_admin();

		// No fake_http() registered - a real outbound call here would fail
		// the test with a timeout/transport error rather than a clean 422,
		// proving the consent check short-circuits before any request.
		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
		$request->set_param( 'terms_privacy', false );

		$response = $this->server->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 422, $response->get_status() );
		$this->assertFalse( $data['ok'] );
	}

	public function test_connect_saves_credentials_and_runs_a_health_check_on_a_new_account(): void {
		$this->login_admin();
		$this->fake_http( function ( string $url, array $args ): array {
			if ( str_contains( $url, '/connect' ) ) {
				return $this->http_ok(
					[
						'site_id'      => 4821,
						'write_key'    => 'wk_test_123',
						'write_secret' => 'secret_123',
						'search_key'   => 'sk_test_123',
						'plan'         => 'Free',
						'status'       => 'provisioning',
					],
					201
				);
			}

			return $this->http_ok(
				[
					'site'  => [ 'id' => 4821, 'status' => 'connected', 'last_synced_at' => null ],
					'usage' => [ 'documents' => [ 'used' => 0, 'limit' => 1000 ] ],
				]
			);
		} );

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
		$request->set_param( 'terms_privacy', true );
		$request->set_param( 'dpa', false );

		$response = $this->server->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'connected', $data['flow'] );
		$this->assertTrue( $data['ok'] );
		$this->assertSame( 4821, $data['site_id'] );

		$this->assertSame( 'wk_test_123', Plugin_Settings::decrypt_secret( (string) $this->settings()->get( Plugin_Settings::WRITE_KEY ) ) );
		$this->assertSame( 'secret_123', Plugin_Settings::decrypt_secret( (string) $this->settings()->get( Plugin_Settings::WRITE_SECRET ) ) );
		$this->assertSame( 'sk_test_123', $this->settings()->get( Plugin_Settings::SEARCH_KEY ) );
	}

	public function test_connect_persists_a_pending_claim_notice_when_the_email_is_already_registered(): void {
		$this->login_admin();
		$this->fake_http( fn ( string $url ): array => $this->http_ok( [ 'status' => 'pending_claim' ], 201 ) );

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
		$request->set_param( 'terms_privacy', true );
		$request->set_param( 'email', 'owner@example.com' );

		$response = $this->server->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'pending_claim', $data['flow'] );
		$this->assertSame( 'owner@example.com', $data['email'] );

		$this->assertTrue( (bool) $this->settings()->get( Plugin_Settings::CONNECT_PENDING_CLAIM ) );
		$this->assertSame( 'owner@example.com', $this->settings()->get( Plugin_Settings::CONNECT_PENDING_EMAIL ) );
	}

	public function test_connect_surfaces_a_409_and_asks_the_client_to_reveal_manual_entry(): void {
		$this->login_admin();
		$this->fake_http( fn ( string $url ): array => $this->http_ok( [ 'message' => 'Already connected.' ], 409 ) );

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
		$request->set_param( 'terms_privacy', true );

		$response = $this->server->dispatch( $request );
		$data     = $response->get_data();

		$this->assertSame( 409, $response->get_status() );
		$this->assertFalse( $data['ok'] );
		$this->assertTrue( $data['reveal_manual_entry'] );
	}

	public function test_connect_replays_the_same_idempotency_key_across_attempts(): void {
		$this->login_admin();

		$seen = [];
		$this->fake_http( function ( string $url, array $args ) use ( &$seen ): array {
			$body    = json_decode( (string) ( $args['body'] ?? '{}' ), true );
			$seen[] = $body['idempotency_key'] ?? null;

			return $this->http_ok( [ 'message' => 'Already connected.' ], 409 );
		} );

		$make_request = function (): void {
			$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
			$request->set_param( 'terms_privacy', true );
			$this->server->dispatch( $request );
		};

		$make_request();
		$make_request();

		$this->assertCount( 2, $seen );
		$this->assertNotEmpty( $seen[0] );
		$this->assertSame( $seen[0], $seen[1] );
	}

	public function test_connect_sends_verify_url_pointing_at_our_own_verify_endpoint(): void {
		$this->login_admin();

		$sent_verify_url = null;
		$this->fake_http( function ( string $url, array $args ) use ( &$sent_verify_url ): array {
			$body            = json_decode( (string) ( $args['body'] ?? '{}' ), true );
			$sent_verify_url = $body['verify_url'] ?? null;

			return $this->http_ok( [ 'message' => 'Already connected.' ], 409 );
		} );

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/connect' );
		$request->set_param( 'terms_privacy', true );
		$this->server->dispatch( $request );

		$this->assertNotEmpty( $sent_verify_url );
		$this->assertStringContainsString( 'search-cloud/v1/verify', $sent_verify_url );
	}

	public function test_disconnect_requires_the_manage_settings_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/disconnect' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_disconnect_calls_the_real_api_first_and_clears_local_state_on_success(): void {
		$this->login_admin();
		$this->connect_client();
		$this->settings()->set( Plugin_Settings::SEARCH_KEY, 'sk_test' );
		$this->settings()->set( Plugin_Settings::CONNECT_PENDING_CLAIM, true );
		$this->settings()->set( Plugin_Settings::CONNECT_PENDING_EMAIL, 'owner@example.com' );
		$this->settings()->set( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY, 'existing-key' );

		$calls = [];
		$this->fake_http( function ( string $url, array $args ) use ( &$calls ): array {
			$calls[] = [ $args['method'] ?? '', $url ];

			return $this->http_ok( [ 'status' => 'disconnected' ] );
		} );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/disconnect' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );

		$this->assertCount( 1, $calls );
		$this->assertSame( 'DELETE', $calls[0][0] );
		$this->assertStringContainsString( '/disconnect', $calls[0][1] );

		$this->assertSame( '', $this->settings()->get( Plugin_Settings::WRITE_KEY ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::WRITE_SECRET ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::SEARCH_KEY ) );
		$this->assertFalse( (bool) $this->settings()->get( Plugin_Settings::CONNECT_PENDING_CLAIM ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::CONNECT_PENDING_EMAIL ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY ) );
	}

	public function test_disconnect_skips_the_api_call_when_no_credentials_are_stored(): void {
		$this->login_admin();

		$called = false;
		$this->fake_http( function () use ( &$called ) {
			$called = true;

			return $this->http_ok( [] );
		} );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/disconnect' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertFalse( $called );
	}

	public function test_disconnect_clears_local_state_when_the_api_reports_invalid_or_missing_credentials(): void {
		$this->login_admin();
		$this->connect_client();
		$this->fake_http( fn (): array => $this->http_ok( [ 'message' => 'Invalid credentials.' ], 401 ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/disconnect' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::WRITE_KEY ) );
	}

	public function test_disconnect_keeps_local_state_when_the_api_call_fails(): void {
		$this->login_admin();
		$this->connect_client();
		$this->fake_http( fn (): array => $this->http_ok( [ 'message' => 'Server error.' ], 500 ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/connection/disconnect' ) );

		$this->assertSame( 502, $response->get_status() );
		$this->assertFalse( $response->get_data()['ok'] );
		$this->assertNotSame( '', $this->settings()->get( Plugin_Settings::WRITE_KEY ) );
	}

	public function test_legal_requires_the_view_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/connection/legal' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_legal_returns_the_links_from_get_connect(): void {
		$this->login_admin();
		$this->fake_http( fn (): array => $this->http_ok(
			[ 'legal' => [ 'terms' => 'https://sc.test/terms', 'privacy' => 'https://sc.test/privacy', 'dpa' => null ] ]
		) );

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/connection/legal' ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'https://sc.test/terms', $data['terms'] );
		$this->assertSame( 'https://sc.test/privacy', $data['privacy'] );
		$this->assertSame( \Webhead\WP\SearchCloud\LEGAL_DPA_URL, $data['dpa'] );
	}

	public function test_legal_falls_back_to_the_placeholder_constants_when_search_cloud_is_unreachable(): void {
		$this->login_admin();
		add_filter( 'pre_http_request', static fn () => new \WP_Error( 'http_request_failed', 'timed out' ), 10, 3 );

		$response = $this->server->dispatch( new WP_REST_Request( 'GET', '/webhead-search-cloud/v1/connection/legal' ) );
		$data     = $response->get_data();

		$this->assertSame( \Webhead\WP\SearchCloud\LEGAL_TERMS_URL, $data['terms'] );
		$this->assertSame( \Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL, $data['privacy'] );
		$this->assertSame( \Webhead\WP\SearchCloud\LEGAL_DPA_URL, $data['dpa'] );
	}

	private function login_admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}
}
