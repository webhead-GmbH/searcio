<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Sync_Status;

final class Sync_StatusTest extends TestCase {
	public function test_is_active_is_true_for_queued_running_and_paused(): void {
		$this->assertTrue( Sync_Status::Queued->is_active() );
		$this->assertTrue( Sync_Status::Running->is_active() );
		$this->assertTrue( Sync_Status::Paused->is_active() );
	}

	public function test_is_active_is_false_for_completed_failed_and_cancelled(): void {
		$this->assertFalse( Sync_Status::Completed->is_active() );
		$this->assertFalse( Sync_Status::Failed->is_active() );
		$this->assertFalse( Sync_Status::Cancelled->is_active() );
	}

	public function test_is_finished_is_the_exact_inverse_of_is_active(): void {
		foreach ( Sync_Status::cases() as $status ) {
			$this->assertSame( ! $status->is_active(), $status->is_finished() );
		}
	}

	public function test_active_values_lists_only_active_statuses(): void {
		$this->assertSame( [ 'queued', 'running', 'paused' ], Sync_Status::active_values() );
	}

	public function test_finished_values_lists_only_finished_statuses(): void {
		$this->assertSame( [ 'completed', 'failed', 'cancelled' ], Sync_Status::finished_values() );
	}

	public function test_active_and_finished_values_together_cover_every_case_exactly_once(): void {
		$all = array_map( static fn( Sync_Status $status ): string => $status->value, Sync_Status::cases() );

		sort( $all );
		$combined = array_merge( Sync_Status::active_values(), Sync_Status::finished_values() );
		sort( $combined );

		$this->assertSame( $all, $combined );
	}
}
