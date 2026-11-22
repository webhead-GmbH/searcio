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

	/**
	 * Searcio answers in the language of `Accept-Language`, and in German
	 * without it: an English screen was answered in German. Every request, the
	 * save of the search configuration included, says the language of the
	 * screen.
	 */
	public function test_every_request_says_the_language_of_the_screen(): void {
		$this->connect_client();
		$languages = [];

		$this->fake_http(
			function ( string $url, array $args ) use ( &$languages ): array {
				$languages[] = $args['headers']['Accept-Language'] ?? null;

				return $this->http_ok( [ 'ok' => true ] );
			}
		);

		$locale = static fn (): string => 'de_DE';

		$this->client()->update_search_config( [ 'weights' => [ 'title' => 8 ] ] );
		add_filter( 'locale', $locale );
		$this->client()->update_search_config( [ 'weights' => [ 'title' => 9 ] ] );
		remove_filter( 'locale', $locale );

		$this->assertSame( [ 'en-US', 'de-DE' ], $languages );
	}

	/**
	 * Searcio's sync history made a row of every request, a post type and 200
	 * documents at a time. Requests that name the same run are one row.
	 */
	public function test_batches_of_one_run_name_it(): void {
		$this->connect_client();
		$sent = [];

		$this->fake_http(
			function ( string $url, array $args ) use ( &$sent ): array {
				$sent[] = json_decode( (string) ( $args['body'] ?? '' ), true );

				return $this->http_ok( [ 'status' => 'queued' ], 202 );
			}
		);

		$this->client()->bulk_upsert( [ [ 'id' => 'post-1' ] ], false, '0b6c5a52-6f0b-4c9e-8d84-3d1f2f2c9a11' );
		$this->client()->bulk_upsert( [ [ 'id' => 'post-2' ] ], false, 'a reference with spaces and more than sixty-four characters is no reference at all' );
		$this->client()->bulk_upsert( [ [ 'id' => 'post-3' ] ] );

		$this->assertSame( '0b6c5a52-6f0b-4c9e-8d84-3d1f2f2c9a11', $sent[0]['run_reference'] );
		$this->assertArrayNotHasKey( 'run_reference', $sent[1], 'A reference Searcio would refuse is not sent: it refuses the batch with it.' );
		$this->assertArrayNotHasKey( 'run_reference', $sent[2], 'A request without one is a run of its own, as before.' );
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

	/**
	 * Searcio that does not answer used to hold a screen of the plugin for three
	 * tries and the waits between them, longer than the time limit of many
	 * hosts, so the screen showed a server error. Somebody waiting asks once;
	 * a task in the background asks again.
	 */
	public function test_a_request_somebody_waits_for_asks_once_and_a_background_task_asks_again(): void {
		$this->connect_client();
		$calls = 0;
		$this->fake_http( function () use ( &$calls ): array {
			++$calls;

			// An answer that says to ask again at once, so that the tries do not wait.
			return array_merge( $this->http_ok( [ 'message' => 'Unavailable' ], 503 ), [ 'headers' => [ 'retry-after' => '0' ] ] );
		} );

		$this->client()->get_search_config( true );
		$background = $calls;

		$calls = 0;
		add_filter( 'wp_doing_ajax', '__return_true' );
		$this->client()->get_search_config( true );
		remove_filter( 'wp_doing_ajax', '__return_true' );

		$this->assertGreaterThan( 1, $background, 'A task in the background asks again.' );
		$this->assertSame( 1, $calls, 'A request somebody waits for asks once.' );
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
	 * A secret corrected under the same write key read what the right pair
	 * had answered before, as a wrong one did: the kept answers are named
	 * after the pair.
	 */
	public function test_a_secret_entered_anew_reads_afresh(): void {
		$this->connect_client();
		$calls = $this->count_requests( [ 'site' => [ 'id' => 7 ] ] );

		$this->client()->health();
		$this->settings()->set( \Webhead\WP\SearchCloud\Settings\Plugin_Settings::WRITE_SECRET, \Webhead\WP\SearchCloud\Settings\Plugin_Settings::encrypt_secret( 'another-write-secret' ) );
		$this->client()->health();

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

	/**
	 * Searcio's sync history called every batch a "Full sync", the drain's
	 * three changed documents too.
	 */
	public function test_a_batch_says_whether_it_is_part_of_a_full_or_an_incremental_sync(): void {
		$this->connect_client();

		$sent = [];
		$this->fake_http( function ( string $url, array $args ) use ( &$sent ): array {
			$sent[] = json_decode( (string) ( $args['body'] ?? '' ), true );

			return $this->http_ok( [ 'status' => 'queued' ], 202 );
		} );

		$this->client()->bulk_upsert( [ [ 'id' => 'post-1', 'title' => 'A' ] ] );
		$this->client()->bulk_upsert( [ [ 'id' => 'post-2', 'title' => 'B' ] ], true );

		$this->assertSame( 'full', $sent[0]['sync_type'] );
		$this->assertSame( [ [ 'id' => 'post-1', 'title' => 'A' ] ], $sent[0]['documents'] );
		$this->assertSame( 'incremental', $sent[1]['sync_type'] );
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
	 * The certificate is verified on every request. A local service with a
	 * certificate of its own authority is the development site's to allow.
	 */
	public function test_every_request_verifies_the_certificate(): void {
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
