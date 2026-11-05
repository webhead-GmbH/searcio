<?php
/**
 * Syncing for an account Searcio does not serve.
 *
 * Searcio refuses indexing for an account without an active plan (`402`) and
 * for a suspended one (`403`), each with a `reason`. Neither passes by
 * itself, and the service says never to retry them. A full sync used to wait
 * and send the refused batch again for an hour, saying "Searcio returned an
 * error (HTTP 402)" all the while, and the drain tried every minute for ever.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Account_Refusal;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Account_Refusal_Sync_Test extends Integration_Test_Case {

	/** What the index refuses: writes, deletes, or both. */
	private ?Account_Refusal $refuse_writes = null;

	private ?Account_Refusal $refuse_deletes = null;

	/**
	 * Every request the index was sent, as "METHOD path".
	 *
	 * @var array<int,string>
	 */
	private array $requests = [];

	/**
	 * @dataProvider refusals
	 */
	public function test_a_sync_the_account_is_refused_for_ends_at_once_and_says_why( Account_Refusal $refusal ): void {
		$this->refuse_writes = $refusal;
		$id                  = $this->start_a_sync_of( 2 );

		$this->sync_service()->tick();

		$run = $this->sync_state()->find( $id );

		$this->assertSame( Sync_Status::Failed->value, $run['status'], 'Waiting does not change a refused account.' );
		$this->assertSame( $refusal->message(), $run['last_error'] );
		$this->assertNotEmpty( $run['finished_at'] );
		$this->assertNull( $this->sync_state()->active(), 'The next scheduled sync must find the slot free.' );
		$this->assertFalse( $this->tick_is_scheduled(), 'Nothing is tried again.' );
		$this->assertSame( [ 'POST /documents' ], $this->requests );
	}

	/**
	 * @return array<string,array{0:Account_Refusal}>
	 */
	public static function refusals(): array {
		return [
			'no active plan'  => [ Account_Refusal::NoActivePlan ],
			'payment overdue' => [ Account_Refusal::PaymentOverdue ],
			'suspended'       => [ Account_Refusal::Suspended ],
		];
	}

	/** A 403 without a reason is a disabled site, which the run still waits out. */
	public function test_a_disabled_site_is_still_waited_out(): void {
		$id = $this->start_a_sync_of( 1 );
		$this->fake_http( fn(): array => $this->http_ok( [ 'message' => 'This site is disabled.' ], 403 ) );

		$this->sync_service()->tick();

		$this->assertSame( Sync_Status::Running->value, $this->sync_state()->find( $id )['status'] );
		$this->assertTrue( $this->tick_is_scheduled() );
	}

	/**
	 * A delete the account is refused for stops the prune: each one after it
	 * would be refused the same way. None of them failed, and the next full
	 * sync finds them all again.
	 */
	public function test_a_prune_the_account_is_refused_for_ends_the_run_and_sends_nothing_more(): void {
		$this->refuse_deletes = Account_Refusal::Suspended;
		update_option( Sync_Keys::OPTION_SNAPSHOT, [ 'post-990001', 'post-990002', 'post-990003' ], false );

		$id = $this->start_a_sync_of( 1 );

		for ( $ticks = 0; $ticks < 10 && null !== $this->sync_state()->active(); $ticks++ ) {
			$this->sync_service()->tick();
		}

		$run     = $this->sync_state()->find( $id );
		$deletes = array_values( array_filter( $this->requests, static fn( string $request ): bool => str_starts_with( $request, 'DELETE ' ) ) );

		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertSame( Account_Refusal::Suspended->message(), $run['last_error'] );
		$this->assertSame( 1, (int) $run['pushed'], 'The post was indexed before the account was refused.' );
		$this->assertCount( 1, $deletes, 'One refused delete says it of them all.' );
		$this->assertSame( 0, (int) $run['failed_count'] );
		$this->assertSame( 0, (int) $run['deleted'] );
		$this->assertSame( [], $this->service( 'failed_deletes' )->ids(), 'Not refused for what they are: the snapshot still names them.' );
		$this->assertSame( [ 'post-990001', 'post-990002', 'post-990003' ], get_option( Sync_Keys::OPTION_SNAPSHOT ) );
		$this->assertFalse( $this->tick_is_scheduled() );
	}

	/**
	 * Waiting a minute does not change a refused account. The change stays
	 * queued for when it is served again: the next change starts a drain, and
	 * the scheduled sync sends everything that is out of date meanwhile.
	 *
	 * @dataProvider refusals
	 */
	public function test_the_drain_keeps_a_refused_change_queued_and_does_not_try_it_again( Account_Refusal $refusal ): void {
		$this->refuse_writes = $refusal;
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );
		wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );

		$this->service( 'incremental_service' )->drain();

		$run = $this->sync_state()->history( [ 'per_page' => 1 ] )['items'][0] ?? null;

		$this->assertSame( 1, $this->service( 'change_queue_table' )->pending_count(), 'What was refused is still to be sent.' );
		$this->assertFalse( wp_next_scheduled( Sync_Keys::HOOK_DRAIN ), 'A refused account is not tried again every minute.' );
		$this->assertNotNull( $run );
		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertSame( $refusal->message(), $run['last_error'] );
		$this->assertSame( [ 'POST /documents' ], $this->requests );
	}

	/**
	 * The drain stops deleting at the first refusal. Every delete it did not
	 * get to goes to the full sync's prune phase, as a refused one does.
	 */
	public function test_the_drain_stops_at_the_first_refused_delete_and_hands_the_rest_to_the_full_sync(): void {
		$this->refuse_deletes = Account_Refusal::NoActivePlan;
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();

		$queue = $this->service( 'change_queue_table' );
		$queue->enqueue( 990011, 'post', Change_Action::Delete );
		$queue->enqueue( 990012, 'post', Change_Action::Delete );
		$queue->enqueue( 990013, 'post', Change_Action::Delete );
		wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );

		$this->service( 'incremental_service' )->drain();

		$run = $this->sync_state()->history( [ 'per_page' => 1 ] )['items'][0] ?? null;

		$this->assertSame( [ 'DELETE /documents/post-990011' ], $this->requests );
		$this->assertEqualsCanonicalizing( [ 'post-990011', 'post-990012', 'post-990013' ], $this->service( 'failed_deletes' )->ids() );
		$this->assertSame( 0, $queue->pending_count() );
		$this->assertSame( 3, (int) $run['failed_count'] );
		$this->assertSame( Account_Refusal::NoActivePlan->message(), $run['last_error'] );
		$this->assertFalse( wp_next_scheduled( Sync_Keys::HOOK_DRAIN ) );
	}

	/* --------------------------------------------------------------------- */
	/* Helpers                                                               */
	/* --------------------------------------------------------------------- */

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
	 * Stand in for the index, refusing what {@see self::$refuse_writes} and
	 * {@see self::$refuse_deletes} say as the service refuses it.
	 */
	private function fake_index(): void {
		$this->fake_http(
			function ( string $url, array $args ): array {
				// The sync nudges WP-Cron with a request of its own.
				if ( ! str_contains( $url, '/api/v1/' ) ) {
					return $this->http_ok();
				}

				$method           = (string) ( $args['method'] ?? 'GET' );
				$path             = (string) preg_replace( '#^.*/api/v1#', '', (string) wp_parse_url( $url, PHP_URL_PATH ) );
				$this->requests[] = $method . ' ' . $path;
				$refusal          = 'DELETE' === $method ? $this->refuse_deletes : $this->refuse_writes;

				if ( null === $refusal ) {
					return $this->http_ok( [ 'accepted' => true ], 'DELETE' === $method ? 200 : 202 );
				}

				return $this->http_ok(
					[ 'message' => 'Not served.', 'reason' => $refusal->value ],
					Account_Refusal::Suspended === $refusal ? 403 : 402
				);
			}
		);
	}
}
