<?php
/**
 * Tick-worker survival tests.
 *
 * These pin the fix for a sync that "sticks" with no way back: the follow-up
 * tick used to be scheduled only at the very end of `tick()`, so a tick killed
 * mid-work (PHP's max_execution_time, an OOM, the worker being killed) left the
 * run Running with no worker — and because `run_scheduled()` bails whenever a
 * run holds the active slot, every later scheduled sync became a silent no-op.
 * The trigger in the wild was a large prune queue: the API deletes one document
 * per request, so a batch of them can outlast the request on its own.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Worker_Recovery_Test extends Integration_Test_Case {

	/**
	 * The dead man's switch: a tick arms its own successor before doing any
	 * work, so even a tick that dies before its final line leaves one behind.
	 */
	public function test_a_tick_arms_a_successor_before_it_starts_working(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$id = $this->make_running_run();
		$this->clear_tick();

		// Die part-way through the first batch, exactly like a killed worker.
		$this->fake_http(
			static function (): array {
				throw new \RuntimeException( 'worker killed mid-batch' );
			}
		);

		try {
			$this->sync_service()->tick();
		} catch ( \RuntimeException $e ) {
			// The point is what survives the death, not the death itself.
		}

		$this->assertTrue(
			$this->tick_is_scheduled(),
			'A tick that dies mid-work must still leave a scheduled successor.'
		);
		$this->assertSame( Sync_Status::Running->value, $this->sync_state()->find( $id )['status'] );
	}

	/**
	 * `run_scheduled()` starts by applying the history retention policy, so a
	 * broken purge would fire on every scheduled sync in production.
	 */
	public function test_retention_purges_finished_runs_past_the_cutoff(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'webhead_search_cloud_sync_runs';
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (status, trigger_type, control, created_at) VALUES ('completed', 'manual', '', %s)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'2020-01-01 00:00:00'
			)
		);

		$this->settings()->set( \Webhead\WP\SearchCloud\Settings\Plugin_Settings::SYNC_RETENTION_DAYS, 30 );
		$this->sync_service()->apply_retention();

		$this->assertSame(
			'0',
			(string) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE created_at < '2021-01-01 00:00:00'" ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			'Finished runs older than the retention cutoff must be purged.'
		);
	}

	/** The scheduled sync revives a run whose worker died instead of no-opping. */
	public function test_the_scheduled_sync_revives_a_run_with_a_dead_worker(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$id = $this->make_running_run();
		$this->clear_tick();

		$this->sync_service()->run_scheduled();

		$this->assertTrue(
			$this->tick_is_scheduled(),
			'A stuck run must be handed a fresh tick so it resumes from its cursor.'
		);
		$this->assertSame(
			$id,
			(int) $this->sync_state()->active()['id'],
			'Reviving must continue the existing run, not start a second one.'
		);
	}

	/** A badly overdue tick means cron stopped firing — also a dead worker. */
	public function test_the_scheduled_sync_revives_a_run_whose_tick_is_overdue(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->make_running_run();
		$this->schedule_tick( -3600 );

		$this->sync_service()->run_scheduled();

		$next = wp_next_scheduled( Sync_Keys::HOOK_TICK );
		$this->assertGreaterThan( time(), $next, 'The stale tick must be replaced with a live one.' );
	}

	/** A healthy run is left alone — no second worker gets armed on top of it. */
	public function test_the_scheduled_sync_leaves_a_live_run_untouched(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->make_running_run();
		$this->schedule_tick( 5 );
		$before = wp_next_scheduled( Sync_Keys::HOOK_TICK );

		$this->sync_service()->run_scheduled();

		$this->assertSame( $before, wp_next_scheduled( Sync_Keys::HOOK_TICK ) );
	}

	/**
	 * A prune queue is worked through one document per request, so it has to
	 * stop on the clock and resume on the next tick rather than run the whole
	 * slice however long that takes.
	 */
	public function test_pruning_stops_on_the_tick_budget_and_resumes_later(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$queue = [];

		for ( $i = 1; $i <= 40; $i++ ) {
			$queue[] = 'post-' . $i;
		}

		update_option( Sync_Keys::OPTION_PRUNE, $queue, false );

		$id = $this->sync_state()->create(
			\Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual,
			1,
			false,
			40,
			[ 'phase' => 'prune', 'type_index' => 0, 'last_id' => 0 ]
		);

		// A zero budget is "every document is already over time", which is what a
		// slow API looks like without making the test wait for one.
		add_filter( 'webhead_search_cloud/sync/tick_budget', static fn(): int => 0 );

		$this->fake_http( fn(): array => $this->http_ok( [] ) );

		$this->sync_service()->tick();

		$remaining = get_option( Sync_Keys::OPTION_PRUNE );

		$this->assertNotEmpty( $remaining, 'The tick must hand the rest of the queue to its successor.' );
		$this->assertCount(
			39,
			$remaining,
			'Only the document processed before the budget ran out may leave the queue — the rest must survive for the next tick.'
		);
		$this->assertSame(
			'post-2',
			$remaining[0],
			'The queue must resume exactly where it stopped, in order.'
		);
		$this->assertSame( Sync_Status::Running->value, $this->sync_state()->find( $id )['status'] );
		$this->assertTrue( $this->tick_is_scheduled() );
	}

	/**
	 * A delete the API rejects must be counted and explained. It used to be
	 * dropped from the queue silently, so a broken delete endpoint looked
	 * exactly like a healthy prune — hours of "deleted 0" and no error.
	 */
	public function test_a_rejected_delete_is_counted_and_reported(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		update_option( Sync_Keys::OPTION_PRUNE, [ 'product-1', 'product-2' ], false );

		$id = $this->sync_state()->create(
			\Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual,
			1,
			false,
			2,
			[ 'phase' => 'prune', 'type_index' => 0, 'last_id' => 0 ]
		);

		$this->fake_http( fn(): array => $this->http_ok( [ 'message' => 'boom' ], 500 ) );

		$this->sync_service()->tick();

		$run = $this->sync_state()->find( $id );

		$this->assertSame( 0, (int) $run['deleted'], 'A 500 is not a deletion.' );
		$this->assertSame( 2, (int) $run['failed_count'] );
		$this->assertStringContainsString( '500', (string) $run['last_error'] );
		$this->assertSame(
			Sync_Status::Completed->value,
			$run['status'],
			'The run still finishes — one unusable document must not wedge the queue behind it.'
		);
	}
}
