<?php
/**
 * `wp webhead-search-cloud sync run` against a failing index.
 *
 * The command drives a sync itself, tick after tick, which is what makes it
 * fit a system cron entry. Nothing else runs the tick a run schedules for its
 * next try, so the command has to wait that long and tick again; and a cron
 * entry reads the exit status, so a sync that was given up must not end the
 * way a completed one does. It used to print "Sync completed." for both.
 *
 * The wait is handed to the command, so no test sleeps.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\WP_CLI;

use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;
use Webhead\WP\SearchCloud\WP_CLI\Sync_Command;

final class Sync_Command_Test extends Integration_Test_Case {

	/**
	 * What the index answers with. A 400 is not one of the answers the client
	 * itself waits and tries again for, so a failing request does not sleep.
	 */
	private int $index_status = 400;

	/**
	 * After how many waits the index answers again.
	 */
	private int $answers_after = PHP_INT_MAX;

	/**
	 * How long the command waited each time, in seconds.
	 *
	 * @var array<int,int>
	 */
	private array $waits = [];

	private int $run_id = 0;

	public function set_up(): void {
		parent::set_up();

		require_once __DIR__ . '/wp-cli-double.php';

		if ( ! property_exists( \WP_CLI::class, 'said' ) ) {
			$this->markTestSkipped( 'WP-CLI itself is loaded, and what it prints cannot be read back.' );
		}

		\WP_CLI::$said = [];

		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_http( fn (): array => $this->http_ok( [ 'message' => 'Not now.' ], $this->index_status ) );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );

		$start = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );
		$this->assertTrue( $start['ok'], (string) ( $start['message'] ?? '' ) );

		$this->run_id = (int) $start['run']['id'];
	}

	public function test_a_sync_that_completes_is_reported_as_completed_without_waiting(): void {
		$this->index_status = 200;

		$this->command()->run( [], [] );

		$this->assertSame( [], $this->waits );
		$this->assertSame( [ [ 'success', 'Sync completed.' ] ], \WP_CLI::$said );
		$this->assertSame( Sync_Status::Completed->value, $this->the_run()['status'] );
	}

	public function test_it_waits_for_each_next_try_and_carries_on_when_the_index_answers(): void {
		$this->answers_after = 2;

		$this->command()->run( [], [] );

		$this->assertCount( 2, $this->waits, 'One wait for each batch the index did not take.' );
		$this->assertGreaterThanOrEqual( 50, $this->waits[0], 'It waits as long as the run does, not a token second.' );
		$this->assertGreaterThan( $this->waits[0], $this->waits[1] );

		$this->assertSame( [ 'warning', 'warning', 'success' ], array_column( \WP_CLI::$said, 0 ) );
		$this->assertStringContainsString( 'tries again', \WP_CLI::$said[0][1], 'Whoever reads the cron log is told why nothing moves.' );

		$run = $this->the_run();

		$this->assertSame( Sync_Status::Completed->value, $run['status'] );
		$this->assertSame( 2, (int) $run['pushed'] );
	}

	public function test_a_sync_that_is_given_up_ends_the_command_with_an_error(): void {
		$ended = null;

		try {
			$this->command()->run( [], [] );
		} catch ( \WP_CLI_Double_Exit $exit ) {
			$ended = $exit->getMessage();
		}

		$this->assertNotNull( $ended, 'A sync that failed was reported the way a completed one is.' );
		$this->assertStringContainsString( 'this sync was stopped', $ended );
		$this->assertStringContainsString( '400', $ended );
		$this->assertNotContains( 'success', array_column( \WP_CLI::$said, 0 ) );

		$this->assertCount( 6, $this->waits, 'Every try the run allows itself is made.' );

		for ( $wait = 1; $wait < 6; $wait++ ) {
			$this->assertGreaterThan( $this->waits[ $wait - 1 ], $this->waits[ $wait ] );
		}

		$this->assertSame( Sync_Status::Failed->value, $this->the_run()['status'] );
		$this->assertNull( $this->sync_state()->active() );
	}

	/**
	 * The command as the plugin builds it, but waiting by taking note.
	 */
	private function command(): Sync_Command {
		return new Sync_Command(
			$this->sync_service(),
			$this->sync_state(),
			function ( int $seconds ): void {
				$this->waits[] = $seconds;

				if ( count( $this->waits ) >= $this->answers_after ) {
					$this->index_status = 200;
				}
			}
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private function the_run(): array {
		$run = $this->sync_state()->find( $this->run_id );

		$this->assertIsArray( $run );

		return $run;
	}
}
