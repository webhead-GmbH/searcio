<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Connection;

use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Search_Cloud_Client_Test extends Integration_Test_Case {
	private function client(): Search_Cloud_Client {
		return $this->service( 'search_cloud_client' );
	}

	public function test_legal_links_are_cached_across_calls_within_the_ttl(): void {
		$calls = 0;
		$this->fake_http( function () use ( &$calls ): array {
			$calls++;

			return $this->http_ok( [ 'legal' => [ 'terms' => 'https://sc.test/terms', 'privacy' => null, 'dpa' => null ] ] );
		} );

		$first  = $this->client()->legal_links();
		$second = $this->client()->legal_links();

		$this->assertSame( 1, $calls );
		$this->assertSame( $first, $second );
		$this->assertSame( 'https://sc.test/terms', $first['terms'] );
	}

	/**
	 * The settings screen's reads are kept, so a tab opens without a round
	 * trip to Searcio; a change the plugin makes forgets what it changed.
	 */
	public function test_the_search_configuration_is_read_once_until_it_is_changed(): void {
		$this->connect_client();
		$calls = $this->count_requests( [ 'weights' => [ 'title' => 5 ] ] );

		$this->assertSame( [ 'title' => 5 ], $this->client()->get_search_config()->body()['weights'] );
		$this->assertSame( [ 'title' => 5 ], $this->client()->get_search_config()->body()['weights'] );
		$this->assertSame( 1, $calls->get );

		$this->client()->update_search_config( [ 'weights' => [ 'title' => 8 ] ] );
		$this->client()->get_search_config();

		$this->assertSame( 2, $calls->get );
	}

	public function test_the_quizzes_are_read_once_until_one_is_made_changed_or_deleted(): void {
		$this->connect_client();
		$calls = $this->count_requests( [ 'quizzes' => [] ] );

		$this->client()->list_quizzes();
		$this->client()->list_quizzes();
		$this->assertSame( 1, $calls->get );

		foreach ( [ fn () => $this->client()->create_quiz( [ 'name' => 'Gift finder' ] ), fn () => $this->client()->update_quiz( 3, [ 'status' => 'draft' ] ), fn () => $this->client()->delete_quiz( 3 ) ] as $index => $change ) {
			$change();
			$this->client()->list_quizzes();
			$this->assertSame( 2 + $index, $calls->get );
		}
	}

	/**
	 * Site Health, the daily sync and "Test connection" ask Searcio now.
	 */
	public function test_the_health_check_is_kept_but_can_be_asked_afresh(): void {
		$this->connect_client();
		$calls = $this->count_requests( [ 'site' => [ 'id' => 26 ] ] );

		$this->client()->health();
		$this->client()->health();
		$this->assertSame( 1, $calls->get );

		$this->client()->health( true );
		$this->assertSame( 2, $calls->get );
	}

	public function test_a_failed_read_is_not_kept(): void {
		$this->connect_client();
		$calls = 0;
		$this->fake_http( function () use ( &$calls ): array {
			++$calls;

			return $this->http_ok( [ 'message' => 'Unavailable' ], 503 );
		} );

		$this->client()->quiz_facet_values();
		$after_first = $calls;
		$this->client()->quiz_facet_values();

		$this->assertGreaterThan( $after_first, $calls );
	}

	public function test_keys_entered_anew_read_afresh(): void {
		$this->connect_client();
		$calls = $this->count_requests( [ 'weights' => [] ] );

		$this->client()->get_search_config();
		$this->settings()->set( \Webhead\WP\SearchCloud\Settings\Plugin_Settings::WRITE_KEY, \Webhead\WP\SearchCloud\Settings\Plugin_Settings::encrypt_secret( 'another-write-key' ) );
		$this->client()->get_search_config();

		$this->assertSame( 2, $calls->get );
	}

	/**
	 * Answers every request with `$body` and counts the GETs.
	 *
	 * @param  array<string,mixed>  $body
	 */
	private function count_requests( array $body ): object {
		$calls = (object) [ 'get' => 0 ];

		$this->fake_http( function ( string $url, array $args ) use ( $calls, $body ): array {
			if ( 'GET' === ( $args['method'] ?? 'GET' ) ) {
				++$calls->get;
			}

			return $this->http_ok( $body );
		} );

		return $calls;
	}

	public function test_disconnect_sends_a_delete_request_with_the_write_credentials(): void {
		$this->connect_client();

		$captured = null;
		$this->fake_http( function ( string $url, array $args ) use ( &$captured ): array {
			$captured = $args;

			return $this->http_ok( [ 'status' => 'disconnected' ] );
		} );

		$response = $this->client()->disconnect();

		$this->assertTrue( $response->ok() );
		$this->assertSame( 'DELETE', $captured['method'] );
		$this->assertSame( 'test-write-key', $captured['headers']['X-Write-Key'] );
	}

	/**
	 * The certificate is verified on every request, with the development
	 * constant that once turned that off defined as well. A local service with
	 * a certificate of its own authority is the development site's to allow.
	 */
	public function test_every_request_verifies_the_certificate(): void {
		if ( ! defined( 'WEBHEAD_SEARCH_CLOUD_DEVELOPMENT' ) ) {
			define( 'WEBHEAD_SEARCH_CLOUD_DEVELOPMENT', true );
		}

		$this->connect_client();

		$verify = [];
		$this->fake_http( function ( string $url, array $args ) use ( &$verify ): array {
			$verify[] = $args['sslverify'];

			return $this->http_ok( [ 'status' => 'ok' ] );
		} );

		$this->client()->health();
		$this->client()->disconnect();

		$this->assertSame( [ true, true ], $verify );
	}
}
