<?php
/**
 * Sync control (pause / resume / cancel) integration tests.
 *
 * These pin the fix for the "stuck in Running" bug: when the tick worker is
 * dead — WP-Cron not firing, or a fatal killed the tick so no future tick is
 * scheduled — pausing or cancelling used to only park a between-batch signal
 * that no live tick would ever read, leaving the run Running forever and
 * blocking every future sync. Cancel/pause must now act directly in that case
 * while still deferring to a genuinely live tick for a clean batch-boundary stop.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Sync_Control;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Control_Test extends Integration_Test_Case {

	/** A running run with a live tick pauses via the control signal, not directly. */
	public function test_pause_with_a_live_tick_signals_and_keeps_running(): void {
		$id = $this->make_running_run();
		$this->schedule_tick( 5 );

		$this->assertTrue( $this->sync_service()->pause( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Running->value, $run['status'], 'A live run must stay running until the tick honours the pause.' );
		$this->assertSame( Sync_Control::Pause->value, $run['control'] );
	}

	/** With no tick scheduled the run is paused directly so the click takes effect. */
	public function test_pause_with_a_dead_worker_pauses_directly(): void {
		$id = $this->make_running_run();
		$this->clear_tick();

		$this->assertTrue( $this->sync_service()->pause( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Paused->value, $run['status'] );
	}

	/** A running run with a live tick defers cancellation to the worker. */
	public function test_cancel_with_a_live_tick_signals_and_stays_active(): void {
		$id = $this->make_running_run();
		$this->schedule_tick( 5 );

		$this->assertTrue( $this->sync_service()->cancel( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Running->value, $run['status'] );
		$this->assertSame( Sync_Control::Cancel->value, $run['control'] );
	}

	/** The core bug: a running run with a dead worker is cancelled immediately. */
	public function test_cancel_with_a_dead_worker_finishes_immediately(): void {
		$id = $this->make_running_run();
		$this->clear_tick();

		$this->assertTrue( $this->sync_service()->cancel( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Cancelled->value, $run['status'] );
		$this->assertNotEmpty( $run['finished_at'] );
		$this->assertNull( $this->sync_state()->active(), 'Cancelling a stuck run must free the active slot.' );
	}

	/**
	 * A tick scheduled far in the past means WP-Cron is not firing, which is the
	 * most common real cause of a stuck run. It must be treated as a dead worker.
	 */
	public function test_cancel_treats_a_badly_overdue_tick_as_a_dead_worker(): void {
		$id = $this->make_running_run();
		wp_clear_scheduled_hook( \Webhead\WP\SearchCloud\Sync\Sync_Keys::HOOK_TICK );
		wp_schedule_single_event( time() - 3600, \Webhead\WP\SearchCloud\Sync\Sync_Keys::HOOK_TICK );

		$this->assertTrue( $this->sync_service()->cancel( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Cancelled->value, $run['status'] );
		$this->assertFalse( $this->tick_is_scheduled(), 'The stray overdue tick must be cleared on a direct cancel.' );
	}

	/** A paused run has no tick in flight, so cancel finishes it directly. */
	public function test_cancel_of_a_paused_run_finishes_directly(): void {
		$id = $this->make_running_run();
		$this->clear_tick();
		$this->sync_state()->set_status( $id, Sync_Status::Paused );

		$this->assertTrue( $this->sync_service()->cancel( $id ) );

		$this->assertSame( Sync_Status::Cancelled->value, $this->sync_state()->find( $id )['status'] );
	}

	/** After a stuck run is cancelled, a brand-new run can be started. */
	public function test_a_new_run_can_start_after_a_stuck_run_is_cancelled(): void {
		$stuck = $this->make_running_run();
		$this->clear_tick();

		// The slot is occupied: a second start is refused.
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$blocked = $this->sync_service()->start( \Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual, 1, false );
		$this->assertFalse( $blocked['ok'] );

		// Cancel the stuck run, then a new run starts cleanly.
		$this->assertTrue( $this->sync_service()->cancel( $stuck ) );

		$started = $this->sync_service()->start( \Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual, 1, false );
		$this->assertTrue( $started['ok'] );
		$this->assertNotSame( $stuck, (int) $started['run']['id'] );
	}

	/** Resuming a directly-paused run puts it back to running and re-arms a tick. */
	public function test_resume_after_a_direct_pause_reschedules_the_tick(): void {
		$id = $this->make_running_run();
		$this->clear_tick();
		$this->sync_service()->pause( $id );
		$this->assertSame( Sync_Status::Paused->value, $this->sync_state()->find( $id )['status'] );

		$this->assertTrue( $this->sync_service()->resume( $id ) );

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Running->value, $run['status'] );
		$this->assertTrue( $this->tick_is_scheduled(), 'Resume must schedule a fresh tick.' );
	}

	/** Control actions are rejected for a run that is not active. */
	public function test_control_actions_reject_a_finished_run(): void {
		$id = $this->make_running_run();
		$this->sync_state()->finish( $id, Sync_Status::Completed );

		$this->assertFalse( $this->sync_service()->pause( $id ) );
		$this->assertFalse( $this->sync_service()->cancel( $id ) );
		$this->assertFalse( $this->sync_service()->resume( $id ) );
	}
}
