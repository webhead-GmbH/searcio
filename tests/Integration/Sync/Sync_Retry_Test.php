<?php
/**
 * A sync that meets a failing index.
 *
 * These pin the fix for the sync that stopped for good at the first failure.
 * A batch the index did not take set the run to Paused and scheduled a tick
 * "to retry", but a tick only advances a running run: the retry did nothing,
 * and the run stayed paused until somebody pressed Resume. A run holds the one
 * active slot while it is paused, so nothing else ran either. The daily
 * scheduled sync found the slot taken and left, and the incremental drain,
 * which yields to a full sync, yielded for ever: stock and prices changed in
 * the shop and never reached the index.
 *
 * A failure now leaves the run running. It waits, longer after each failure,
 * tries the same batch again, and gives up after about an hour, which frees
 * the slot. And a run that is paused, by an earlier version or by hand, is
 * picked up again by the next scheduled sync.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Retry_Test extends Integration_Test_Case {

	/**
	 * What the index answers a write with. A 400 is not one of the answers the
	 * client itself waits and tries again for, so a failing test does not sleep.
	 */
	private int $index_status = 400;

	/**
	 * Titles of the documents the index took, in request order.
	 *
	 * @var array<int,string>
	 */
	private array $taken = [];

	public function test_a_batch_the_index_did_not_take_leaves_the_run_running(): void {
		$id = $this->start_a_sync_of( 2 );

		$this->sync_service()->tick();

		$run = $this->sync_state()->find( $id );

		$this->assertSame( Sync_Status::Running->value, $run['status'], 'A failure is waited out, not paused on: nothing resumes a pause.' );
		$this->assertStringContainsString( '400', (string) $run['last_error'] );
		$this->assertSame( 0, (int) $run['pushed'] );
		$this->assertSame( 0, (int) $run['processed'], 'A batch that is sent again is not counted before it is taken.' );
		$this->assertSame( 0, (int) $run['failed_count'], 'Nothing has failed while the run is still trying.' );
		$this->assertGreaterThanOrEqual( 50, $this->seconds_to_the_next_tick(), 'The next try is not at once.' );
		$this->assertSame( $id, (int) $this->sync_state()->active()['id'] );
		$this->assertSame( 1, $this->sync_service()->status()['active']['cursor']['retries'], 'The Sync tab tells a wait from an error by this.' );
	}

	public function test_the_run_carries_on_from_the_same_batch_when_the_index_answers_again(): void {
		$id = $this->start_a_sync_of( 3 );

		$this->sync_service()->tick();
		$this->sync_service()->tick();
		$this->assertSame( [], $this->taken );

		$this->index_status = 200;
		$this->run_ticks();

		$run = $this->sync_state()->find( $id );

		$this->assertSame( Sync_Status::Completed->value, $run['status'] );
		$this->assertSame( 3, (int) $run['pushed'] );
		$this->assertSame( 3, (int) $run['processed'], 'Two tries that failed and one that did not are still three posts.' );
		$this->assertSame( 0, (int) $run['failed_count'], 'What was sent in the end did not fail.' );
		$this->assertCount( 3, $this->taken, 'The batch that failed is the batch that is sent again, whole.' );
		$this->assertNull( $run['last_error'], 'A failure the run got past is not what the finished run says about itself.' );
	}

	public function test_each_failure_waits_longer_than_the_one_before(): void {
		$this->start_a_sync_of( 1 );

		$waits = [];

		for ( $failure = 0; $failure < 4; $failure++ ) {
			$this->sync_service()->tick();
			$waits[] = $this->seconds_to_the_next_tick();
		}

		$this->assertGreaterThanOrEqual( 50, $waits[0] );

		for ( $failure = 1; $failure < 4; $failure++ ) {
			$this->assertGreaterThan( $waits[ $failure - 1 ], $waits[ $failure ] );
		}
	}

	public function test_a_run_the_index_keeps_refusing_is_given_up(): void {
		$id = $this->start_a_sync_of( 2 );

		$ticks = $this->run_ticks( 20 );
		$run   = $this->sync_state()->find( $id );

		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertSame( 2, (int) $run['failed_count'], 'The two posts failed once, however often they were sent.' );
		$this->assertSame( 0, (int) $run['processed'] );
		$this->assertNotEmpty( $run['finished_at'] );
		$this->assertStringContainsString( '400', (string) $run['last_error'] );
		$this->assertNull( $this->sync_state()->active(), 'A run that is given up must free the slot.' );
		$this->assertFalse( $this->tick_is_scheduled() );
		$this->assertGreaterThan( 3, $ticks, 'It is tried more than a couple of times first.' );
		$this->assertLessThan( 15, $ticks, 'And not for ever.' );
	}

	/**
	 * What a merchant saw: a price changed in the shop and not in the search.
	 * The drain that sends such a change yields to a full sync, and the full
	 * sync that had met one failure never ended.
	 */
	public function test_changes_reach_the_index_again_after_a_sync_that_failed(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish', 'post_title' => 'Boots, 99 EUR' ] );

		// The index is down while a full sync runs.
		$this->assertTrue( $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['ok'] );
		$this->run_ticks( 20 );

		// It is back, and the price has changed meanwhile.
		$this->index_status = 200;
		wp_update_post( [ 'ID' => $post_id, 'post_title' => 'Boots, 79 EUR' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );

		$this->service( 'incremental_service' )->drain();

		$this->assertSame( [ 'Boots, 79 EUR' ], $this->taken, 'The change has to be sent: no sync is in its way any more.' );
		$this->assertSame( 0, $this->service( 'change_queue_table' )->pending_count() );
	}

	/** Until the full sync gives up it still owns the index, as it did before. */
	public function test_the_drain_still_yields_to_a_sync_that_is_waiting_to_try_again(): void {
		$this->start_a_sync_of( 1 );
		$this->sync_service()->tick();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );
		$this->index_status = 200;
		$queued             = $this->service( 'change_queue_table' )->pending_count();

		$this->service( 'incremental_service' )->drain();

		$this->assertSame( [], $this->taken );
		$this->assertGreaterThan( 0, $queued );
		$this->assertSame( $queued, $this->service( 'change_queue_table' )->pending_count(), 'What is queued stays queued until the sync has ended.' );
	}

	/**
	 * A site that updates to this version may hold a run an earlier one left
	 * paused, with no tick scheduled and nobody to press Resume.
	 */
	public function test_the_scheduled_sync_picks_up_a_run_an_earlier_version_left_paused(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->index_status = 200;
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );

		$id = $this->make_running_run();
		$this->clear_tick();
		$this->sync_state()->save( $id, [ 'last_error' => 'Could not reach Search Cloud. The sync is paused and will retry.' ] );
		$this->sync_state()->set_status( $id, Sync_Status::Paused );

		$this->sync_service()->run_scheduled();

		$run = $this->sync_state()->find( $id );

		$this->assertSame( Sync_Status::Running->value, $run['status'] );
		$this->assertNull( $run['last_error'] );
		$this->assertTrue( $this->tick_is_scheduled() );
		$this->assertSame( $id, (int) $this->sync_state()->active()['id'], 'It is the same run, from where it stopped, and not a second one beside it.' );

		$this->run_ticks();

		$this->assertSame( Sync_Status::Completed->value, $this->sync_state()->find( $id )['status'] );
		$this->assertCount( 2, $this->taken );
	}

	/** A pause somebody pressed is for a while too: the scheduled sync ends it. */
	public function test_the_scheduled_sync_picks_up_a_run_paused_by_hand(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$id = $this->make_running_run();
		$this->clear_tick();
		$this->assertTrue( $this->sync_service()->pause( $id ) );
		$this->assertSame( Sync_Status::Paused->value, $this->sync_state()->find( $id )['status'] );

		$this->sync_service()->run_scheduled();

		$this->assertSame( Sync_Status::Running->value, $this->sync_state()->find( $id )['status'] );
		$this->assertTrue( $this->tick_is_scheduled() );
	}

	/**
	 * A run that is waiting to try again has no tick at work to read a signal:
	 * the next one may be half an hour away.
	 */
	public function test_pausing_a_run_that_waits_to_try_again_takes_effect_at_once(): void {
		$id = $this->start_a_sync_of( 1 );
		$this->sync_service()->tick();

		$this->assertTrue( $this->sync_service()->pause( $id ) );

		$this->assertSame( Sync_Status::Paused->value, $this->sync_state()->find( $id )['status'] );
		$this->assertFalse( $this->tick_is_scheduled(), 'A paused run tries nothing again by itself.' );
	}

	public function test_cancelling_a_run_that_waits_to_try_again_takes_effect_at_once(): void {
		$id = $this->start_a_sync_of( 1 );
		$this->sync_service()->tick();

		$this->assertTrue( $this->sync_service()->cancel( $id ) );

		$this->assertSame( Sync_Status::Cancelled->value, $this->sync_state()->find( $id )['status'] );
		$this->assertNull( $this->sync_state()->active() );
		$this->assertFalse( $this->tick_is_scheduled() );
	}

	/** `wp webhead-search-cloud sync run` drives the run itself, and waits by this. */
	public function test_a_caller_that_drives_the_run_is_told_how_long_to_wait(): void {
		$id = $this->start_a_sync_of( 1 );

		$this->assertSame( 0, $this->sync_service()->seconds_until_retry(), 'A run that has not failed is not waiting.' );

		$this->sync_service()->tick();

		$wait = $this->sync_service()->seconds_until_retry();

		$this->assertGreaterThanOrEqual( 50, $wait );
		$this->assertLessThanOrEqual( 60, $wait );

		$this->index_status = 200;
		$this->sync_service()->tick();

		$this->assertSame( 0, $this->sync_service()->seconds_until_retry() );
		$this->assertSame( Sync_Status::Completed->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_resuming_by_hand_starts_the_tries_afresh(): void {
		$id = $this->start_a_sync_of( 1 );

		$this->sync_service()->tick();
		$this->sync_service()->tick();
		$this->sync_service()->tick();
		$late = $this->seconds_to_the_next_tick();

		$this->sync_service()->pause( $id );
		$this->assertTrue( $this->sync_service()->resume( $id ) );

		$this->assertNull( $this->sync_state()->find( $id )['last_error'] );
		$this->assertLessThan( 50, $this->seconds_to_the_next_tick(), 'Somebody asked for it: it goes on now.' );

		$this->sync_service()->tick();

		$this->assertLessThan( $late, $this->seconds_to_the_next_tick(), 'And the waits start from the shortest again.' );
		$this->assertSame( Sync_Status::Running->value, $this->sync_state()->find( $id )['status'] );
	}

	/* --------------------------------------------------------------------- */
	/* Helpers                                                               */
	/* --------------------------------------------------------------------- */

	/**
	 * A connected site with `$posts` published posts and a full sync started
	 * against an index that answers {@see self::$index_status}.
	 */
	private function start_a_sync_of( int $posts ): int {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		self::factory()->post->create_many( $posts, [ 'post_status' => 'publish' ] );

		$start = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );
		$this->assertTrue( $start['ok'], (string) ( $start['message'] ?? '' ) );

		return (int) $start['run']['id'];
	}

	/**
	 * Stand in for the index: a write is answered with {@see self::$index_status}
	 * and, when that is a success, its documents are noted in {@see self::$taken}.
	 */
	private function fake_index(): void {
		$this->fake_http(
			function ( string $url, array $args ): array {
				if ( 'DELETE' === ( $args['method'] ?? '' ) ) {
					return $this->http_ok();
				}

				if ( 200 === $this->index_status ) {
					$body = json_decode( (string) ( $args['body'] ?? '{}' ), true );

					foreach ( is_array( $body ) && isset( $body['documents'] ) && is_array( $body['documents'] ) ? $body['documents'] : [] as $document ) {
						$this->taken[] = (string) ( $document['title'] ?? '' );
					}
				}

				return $this->http_ok( [ 'message' => 'Not now.' ], $this->index_status );
			}
		);
	}

	/**
	 * Run ticks, as WP-Cron would one after the other, until no run is active.
	 * Returns how many it took.
	 */
	private function run_ticks( int $max = 50 ): int {
		for ( $ticks = 0; $ticks < $max; $ticks++ ) {
			if ( null === $this->sync_state()->active() ) {
				return $ticks;
			}

			$this->sync_service()->tick();
		}

		$this->fail( 'The sync was still active after ' . $max . ' ticks.' );
	}

	private function seconds_to_the_next_tick(): int {
		$next = wp_next_scheduled( Sync_Keys::HOOK_TICK );

		$this->assertNotFalse( $next, 'No tick is scheduled.' );

		return (int) $next - time();
	}
}
