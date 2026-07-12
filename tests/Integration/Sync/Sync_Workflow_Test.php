<?php
/**
 * End-to-end sync workflow integration tests.
 *
 * Exercises the resumable tick engine against a real database and posts with
 * the Search Cloud HTTP layer faked out: a full run indexes the catalogue and
 * completes, and a running tick honours pause/cancel signals at the batch
 * boundary. Complements the control-surface tests in {@see Sync_Control_Test}.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Sync_Control;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Workflow_Test extends Integration_Test_Case {

	public function test_start_is_refused_without_credentials(): void {
		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertFalse( $result['ok'] );
		$this->assertNull( $this->sync_state()->active() );
	}

	public function test_start_is_refused_when_no_post_types_are_indexable(): void {
		$this->connect_client();

		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertFalse( $result['ok'] );
	}

	public function test_start_creates_a_running_run_and_schedules_a_tick(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( Sync_Status::Running->value, $result['run']['status'] );
		$this->assertTrue( $this->tick_is_scheduled() );
	}

	public function test_a_full_run_indexes_every_post_and_completes(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$post_ids = self::factory()->post->create_many( 3, [ 'post_status' => 'publish' ] );

		$upserted = [];
		$this->fake_http(
			function ( string $url, array $args ) use ( &$upserted ): array {
				if ( str_contains( $url, '/documents' ) ) {
					$body = json_decode( (string) ( $args['body'] ?? '{}' ), true );
					$docs = is_array( $body ) && isset( $body['documents'] ) ? $body['documents'] : [];
					$upserted = array_merge( $upserted, is_array( $docs ) ? $docs : [] );
				}

				return $this->http_ok( [ 'ok' => true ] );
			}
		);

		$start = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );
		$this->assertTrue( $start['ok'] );
		$id = (int) $start['run']['id'];

		// Drive the engine deterministically instead of waiting for WP-Cron.
		$this->drain_ticks();

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Completed->value, $run['status'] );
		$this->assertSame( count( $post_ids ), (int) $run['pushed'] );
		$this->assertNull( $this->sync_state()->active() );
		$this->assertCount( count( $post_ids ), $upserted );
	}

	public function test_a_second_unforced_run_skips_unchanged_posts(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok( [ 'ok' => true ] ) );

		$first = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->drain_ticks();
		$this->assertSame( 2, (int) $this->sync_state()->find( $first )['pushed'] );

		$second = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->drain_ticks();
		$second_run = $this->sync_state()->find( $second );

		$this->assertSame( Sync_Status::Completed->value, $second_run['status'] );
		$this->assertSame( 0, (int) $second_run['pushed'], 'Unchanged posts must be skipped via the dirty tracker.' );
		$this->assertSame( 2, (int) $second_run['skipped'] );
	}

	public function test_a_running_tick_honours_a_cancel_signal(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok() );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_state()->request_control( $id, Sync_Control::Cancel );

		$this->sync_service()->tick();

		$this->assertSame( Sync_Status::Cancelled->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_a_running_tick_honours_a_pause_signal_and_can_resume(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok() );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_state()->request_control( $id, Sync_Control::Pause );

		$this->sync_service()->tick();
		$this->assertSame( Sync_Status::Paused->value, $this->sync_state()->find( $id )['status'] );

		$this->assertTrue( $this->sync_service()->resume( $id ) );
		$this->drain_ticks();
		$this->assertSame( Sync_Status::Completed->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_a_plan_limit_response_fails_the_run(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create( [ 'post_status' => 'publish' ] );
		// A plan limit is a 429 carrying a `metric` (and is not retried).
		$this->fake_http( fn(): array => $this->http_ok( [ 'metric' => 'documents', 'limit' => 100 ], 429 ) );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_service()->tick();

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertNotEmpty( $run['last_error'] );
	}

	/**
	 * Run ticks until the active run finishes, guarding against an accidental
	 * infinite loop if a fix ever regresses the terminal conditions.
	 */
	private function drain_ticks( int $max = 50 ): void {
		for ( $i = 0; $i < $max; $i++ ) {
			if ( null === $this->sync_state()->active() ) {
				return;
			}

			$this->sync_service()->tick();
		}

		$this->fail( 'Sync did not finish within the tick budget.' );
	}
}
