<?php
/**
 * The times of a sync run are all in UTC.
 *
 * `created_at` was already; `updated_at` was left to the column's
 * `ON UPDATE CURRENT_TIMESTAMP`, which is the database server's local time,
 * so the history answered a run that ended at 09:23:17 as updated at 10:23:17.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Run_Times_Test extends Integration_Test_Case {

	protected function tearDown(): void {
		global $wpdb;

		$wpdb->query( "SET time_zone = 'SYSTEM'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

		parent::tearDown();
	}

	public function test_a_run_is_updated_in_utc_whatever_the_time_zone_of_the_database(): void {
		global $wpdb;

		// A server five hours ahead of UTC: the column's own default would say so.
		$wpdb->query( "SET time_zone = '+05:00'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

		$id = $this->make_running_run();
		$this->sync_state()->save( $id, [ 'processed' => 3 ] );

		$this->assert_updated_just_now( $id, 'Saving a run' );

		$this->sync_state()->finish( $id, Sync_Status::Completed );

		$this->assert_updated_just_now( $id, 'Finishing a run' );
	}

	public function test_a_finished_run_is_presented_as_updated_when_it_ended(): void {
		global $wpdb;

		$wpdb->query( "SET time_zone = '+05:00'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

		$id = $this->make_running_run();
		$this->sync_state()->finish( $id, Sync_Status::Completed );

		$run = $this->sync_state()->present( $this->sync_state()->find( $id ) );

		$this->assertLessThanOrEqual( 2, abs( strtotime( (string) $run['updated_at'] ) - strtotime( (string) $run['finished_at'] ) ) );
	}

	private function assert_updated_just_now( int $id, string $what ): void {
		$row = $this->sync_state()->find( $id );

		$this->assertLessThanOrEqual(
			5,
			abs( strtotime( $row['updated_at'] . ' UTC' ) - time() ),
			$what . ' must stamp it in UTC.'
		);
	}
}
