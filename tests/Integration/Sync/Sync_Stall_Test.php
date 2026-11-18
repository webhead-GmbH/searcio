<?php
/**
 * A sync whose worker WP-Cron does not run.
 *
 * A scheduled sync stood at "0 of 539" for twenty minutes on a site nobody
 * visited, and nothing said so: the nightly sync did not run either. The
 * screen now says it after ten minutes, a click runs the next step, and Site
 * Health lists a task WP-Cron has not started.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use WP_REST_Request;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Stall_Test extends Integration_Test_Case {

	public function test_a_run_whose_worker_is_overdue_and_has_not_moved_is_stalled(): void {
		$id = $this->make_running_run();
		$this->schedule_tick( -3600 );
		$this->idle_for( $id, 1200 );

		$stalled = $this->sync_service()->stalled();

		$this->assertGreaterThanOrEqual( 1200, $stalled );
		$this->assertSame( $stalled, $this->sync_service()->status()['stalled']['seconds'] );
	}

	public function test_a_run_whose_worker_is_scheduled_is_not_stalled_however_long_it_waits(): void {
		$id = $this->make_running_run();
		$this->schedule_tick( 5 );
		$this->idle_for( $id, 1200 );

		$this->assertNull( $this->sync_service()->stalled() );
		$this->assertNull( $this->sync_service()->status()['stalled'] );
	}

	public function test_a_run_that_moved_a_moment_ago_is_not_stalled_whatever_its_worker_does(): void {
		$id = $this->make_running_run();
		$this->schedule_tick( -3600 );
		$this->idle_for( $id, 30 );

		$this->assertNull( $this->sync_service()->stalled() );
	}

	public function test_a_paused_run_is_not_stalled(): void {
		$id = $this->make_running_run();
		$this->clear_tick();
		$this->idle_for( $id, 1200 );
		$this->sync_state()->set_status( $id, Sync_Status::Paused );

		$this->assertNull( $this->sync_service()->stalled() );
	}

	public function test_nothing_is_stalled_without_a_run(): void {
		$this->assertNull( $this->sync_service()->stalled() );
	}

	/**
	 * The next step, in the request of the person who asked: the run moves
	 * on without WP-Cron.
	 */
	public function test_the_next_step_can_be_run_by_hand(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn (): array => $this->http_ok( [ 'ok' => true ] ) );

		$id = (int) $this->sync_service()->start( \Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual, 1, false )['run']['id'];

		$this->assertSame( 0, (int) $this->sync_state()->find( $id )['processed'] );
		$this->assertTrue( $this->sync_service()->nudge() );
		$this->assertGreaterThan( 0, (int) $this->sync_state()->find( $id )['processed'], 'The step was not run.' );
	}

	public function test_there_is_no_step_to_run_without_a_running_sync(): void {
		$this->assertFalse( $this->sync_service()->nudge() );

		$id = $this->make_running_run();
		$this->sync_state()->set_status( $id, Sync_Status::Paused );

		$this->assertFalse( $this->sync_service()->nudge(), 'A paused run is moved on by Resume.' );
	}

	public function test_the_route_answers_a_step_for_those_who_may_run_a_sync_and_refuses_the_rest(): void {
		global $wp_rest_server;
		$wp_rest_server = new \WP_REST_Server();
		do_action( 'rest_api_init' );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$this->assertContains( $wp_rest_server->dispatch( new WP_REST_Request( 'POST', '/searcio/v1/sync/nudge' ) )->get_status(), [ 401, 403 ] );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$this->assertSame( 409, $wp_rest_server->dispatch( new WP_REST_Request( 'POST', '/searcio/v1/sync/nudge' ) )->get_status(), 'No sync is running.' );

		$wp_rest_server = null;
	}

	/** Site Health lists a task WP-Cron has not started for a quarter of an hour. */
	public function test_site_health_says_when_the_plugins_tasks_are_overdue(): void {
		$test = $this->background_tasks_test();

		wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );
		wp_schedule_single_event( time() + 10, Sync_Keys::HOOK_DRAIN );
		$this->assertSame( 'good', $test()['status'] );

		wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );
		wp_schedule_single_event( time() - 2400, Sync_Keys::HOOK_DRAIN );
		$result = $test();

		$this->assertSame( 'recommended', $result['status'] );
		$this->assertStringContainsString( '40 minutes', $result['description'] );
		$this->assertStringContainsString( 'wp cron event run --due-now', $result['description'] );

		wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );
	}

	private function background_tasks_test(): callable {
		$tests = new \Webhead\WP\SearchCloud\Health\Health_Tests(
			new \Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Site_Health_Manager( 'searcio' ),
			$this->service( 'search_cloud_client' ),
			$this->service( 'index_config' ),
			$this->service( 'sync_state' )
		);
		$method = new \ReflectionMethod( $tests, 'background_tasks' );

		return static fn (): array => $method->invoke( $tests );
	}

	/** Pretend the run last moved this many seconds ago. */
	private function idle_for( int $id, int $seconds ): void {
		global $wpdb;

		$wpdb->update( $wpdb->prefix . 'searcio_sync_runs', [ 'updated_at' => gmdate( 'Y-m-d H:i:s', time() - $seconds ) ], [ 'id' => $id ] );
	}
}
