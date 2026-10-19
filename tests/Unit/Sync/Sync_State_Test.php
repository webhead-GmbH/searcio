<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Sync;

use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Webhead\WP\SearchCloud\Sync\Sync_State;

/**
 * `Sync_State::present()` is the only method on this class with no database
 * dependency at all, so it's the only one covered here - everything else
 * (`create()`, `save()`, `finish()`, `apply_retention()`, ...) is a thin
 * pass-through to `Sync_Runs_Table` and belongs in wp-env integration tests.
 * `Sync_Runs_Table` is `final`, so it can't be mocked or subclassed - build
 * `Sync_State` via reflection instead of a real/fake table collaborator,
 * since `present()` never touches `$this->table`.
 */
final class Sync_State_Test extends TestCase {
	private function state(): Sync_State {
		return ( new ReflectionClass( Sync_State::class ) )->newInstanceWithoutConstructor();
	}

	public function test_present_casts_counters_and_renames_trigger_type_to_trigger(): void {
		$row = [
			'id'              => '12',
			'status'          => 'running',
			'trigger_type'    => 'scheduled',
			'triggered_by'    => '5',
			'is_force'        => '1',
			'phase'           => 'product',
			'cursor_state'    => '{"offset":40}',
			'total_estimated' => '100',
			'processed'       => '40',
			'pushed'          => '38',
			'skipped'         => '2',
			'language_skipped' => '1',
			'deleted'         => '0',
			'failed_count'    => '0',
			'started_at'      => '2026-01-01 10:00:00',
			'finished_at'     => null,
			'last_error'      => '',
			'created_at'      => '2026-01-01 10:00:00',
			'updated_at'      => '2026-01-01 10:00:05',
		];

		$presented = $this->state()->present( $row );

		$this->assertSame( 12, $presented['id'] );
		$this->assertSame( 'scheduled', $presented['trigger'] );
		$this->assertArrayNotHasKey( 'trigger_type', $presented );
		$this->assertSame( 5, $presented['triggered_by'] );
		$this->assertTrue( $presented['force'] );
		$this->assertSame( [ 'offset' => 40 ], $presented['cursor'] );
		$this->assertSame( 100, $presented['total_estimated'] );
		$this->assertSame( 40, $presented['processed'] );
		$this->assertSame( 1, $presented['language_skipped'] );
		$this->assertNull( $presented['finished_at'] );
		$this->assertNull( $presented['last_error'] );
		$this->assertSame( '2026-01-01T10:00:00+00:00', $presented['started_at'] );
	}

	public function test_present_defaults_missing_fields_to_falsy_values(): void {
		$presented = $this->state()->present( [] );

		$this->assertSame( 0, $presented['id'] );
		$this->assertSame( '', $presented['status'] );
		$this->assertSame( '', $presented['trigger'] );
		$this->assertNull( $presented['triggered_by'] );
		$this->assertFalse( $presented['force'] );
		$this->assertNull( $presented['phase'] );
		$this->assertNull( $presented['cursor'] );
		$this->assertNull( $presented['started_at'] );
		$this->assertNull( $presented['last_error'] );
	}

	public function test_present_treats_a_non_json_cursor_state_as_null(): void {
		$presented = $this->state()->present( [ 'cursor_state' => 'not json' ] );

		$this->assertNull( $presented['cursor'] );
	}

	public function test_present_treats_a_zero_datetime_as_null(): void {
		$presented = $this->state()->present( [ 'started_at' => '0000-00-00 00:00:00' ] );

		$this->assertNull( $presented['started_at'] );
	}

	public function test_present_treats_an_empty_last_error_string_as_null_but_keeps_a_real_message(): void {
		$empty = $this->state()->present( [ 'last_error' => '' ] );
		$real  = $this->state()->present( [ 'last_error' => 'Connection timed out.' ] );

		$this->assertNull( $empty['last_error'] );
		$this->assertSame( 'Connection timed out.', $real['last_error'] );
	}
}
