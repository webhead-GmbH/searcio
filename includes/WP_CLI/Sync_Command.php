<?php
/**
 * `wp webhead-search-cloud sync` WP-CLI command.
 *
 * Real system cron is more reliable than WP-Cron (which depends on traffic), so
 * the plugin ships a CLI surface to drive and inspect syncs directly. `run`
 * executes a full sync synchronously to completion (ideal for a cron entry);
 * the others mirror the dashboard controls.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\WP_CLI;

use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Sync\Sync_State;

defined( 'ABSPATH' ) || exit;

/**
 * Manage webhead Search Cloud syncs.
 *
 * @since 1.0.0
 */
final class Sync_Command {
	/**
	 * How `run` waits for a run's next try, given the seconds.
	 *
	 * @var \Closure(int):void
	 */
	private \Closure $wait;

	/**
	 * @param  (\Closure(int):void)|null  $wait  Stands in for sleep(): the integration suite has no hour to wait.
	 */
	public function __construct(
		private Sync_Service $service,
		private Sync_State $state,
		?\Closure $wait = null
	) {
		$this->wait = $wait ?? static function ( int $seconds ): void {
			sleep( $seconds );
		};
	}

	/**
	 * Show the current sync status.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : Output format. table or json.
	 * ---
	 * default: table
	 * options:
	 *   - table
	 *   - json
	 * ---
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function status( array $args, array $assoc_args ): void {
		$status = $this->service->status();
		$format = (string) ( $assoc_args['format'] ?? 'table' );

		if ( 'json' === $format ) {
			\WP_CLI::line( (string) wp_json_encode( $status ) );

			return;
		}

		$active = $status['active'];

		\WP_CLI::line( 'Configured: ' . ( $status['configured'] ? 'yes' : 'no' ) );
		\WP_CLI::line( 'Indexable types: ' . ( [] === $status['indexable'] ? '(none)' : implode( ', ', $status['indexable'] ) ) );

		if ( null === $active ) {
			\WP_CLI::line( 'Active run: none' );

			return;
		}

		\WP_CLI::line( sprintf( 'Active run #%d - %s (%s)', $active['id'], $active['status'], $active['trigger'] ) );
		\WP_CLI::line( sprintf( 'Processed %d / ~%d · pushed %d · skipped %d · deleted %d · failed %d', $active['processed'], $active['total_estimated'], $active['pushed'], $active['skipped'], $active['deleted'], $active['failed_count'] ) );

		if ( null !== $active['last_error'] ) {
			\WP_CLI::warning( $active['last_error'] );
		}
	}

	/**
	 * Run a full sync synchronously to completion.
	 *
	 * Best for a real system-cron entry. If a run is already active it is resumed.
	 * When Search Cloud does not take a batch the command waits and sends it
	 * again, as the background sync does, for a little over an hour in all; it
	 * exits with an error when the sync does not complete.
	 *
	 * ## OPTIONS
	 *
	 * [--force]
	 * : Re-send every document, ignoring dirty-tracking hashes.
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function run( array $args, array $assoc_args ): void {
		$force = isset( $assoc_args['force'] );
		$run   = $this->state->active();

		if ( null === $run ) {
			$result = $this->service->start( Sync_Trigger::Manual, null, $force );

			if ( empty( $result['ok'] ) ) {
				\WP_CLI::error( (string) ( $result['message'] ?? __( 'Could not start the sync.', 'searcio' ) ) );
			}

			$id = (int) ( $result['run']['id'] ?? 0 );
		} else {
			$id = (int) $run['id'];

			if ( Sync_Status::Paused->value === (string) $run['status'] ) {
				$this->service->resume( $id );
			}
		}

		$guard = 0;

		do {
			$this->service->tick();
			$active = $this->state->active();
			$guard++;

			if ( null !== $active && Sync_Status::Running->value !== (string) $active['status'] ) {
				\WP_CLI::warning( sprintf( 'Run #%d stopped in state "%s".', (int) $active['id'], (string) $active['status'] ) );

				if ( ! empty( $active['last_error'] ) ) {
					\WP_CLI::warning( (string) $active['last_error'] );
				}

				return;
			}

			// Search Cloud did not take a batch. The run has scheduled its next
			// try; nothing but this loop runs it here, so the wait is ours.
			$wait = null === $active ? 0 : $this->service->seconds_until_retry();

			if ( $wait > 0 ) {
				\WP_CLI::warning( (string) ( $active['last_error'] ?? '' ) );
				( $this->wait )( $wait );
			}
		} while ( null !== $active && $guard < 100000 );

		// The run is no longer active, which is not the same as done: a plan
		// limit, or a Search Cloud that stayed down, ends it as failed.
		$finished = $this->state->find( $id );
		$status   = (string) ( $finished['status'] ?? '' );
		$error    = (string) ( $finished['last_error'] ?? '' );

		if ( Sync_Status::Completed->value !== $status ) {
			\WP_CLI::error( '' !== $error ? $error : sprintf( 'Run #%d ended in state "%s".', $id, $status ) );
		}

		// A completed run can still say what it could not remove from the index.
		if ( '' !== $error ) {
			\WP_CLI::warning( $error );
		}

		\WP_CLI::success( __( 'Sync completed.', 'searcio' ) );
	}

	/**
	 * Start a full sync in the background (cron-driven ticks).
	 *
	 * ## OPTIONS
	 *
	 * [--force]
	 * : Re-send every document, ignoring dirty-tracking hashes.
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function start( array $args, array $assoc_args ): void {
		$result = $this->service->start( Sync_Trigger::Manual, null, isset( $assoc_args['force'] ) );

		if ( empty( $result['ok'] ) ) {
			\WP_CLI::error( (string) ( $result['message'] ?? __( 'Could not start the sync.', 'searcio' ) ) );
		}

		\WP_CLI::success( __( 'Sync started.', 'searcio' ) );
	}

	/**
	 * Pause the active sync.
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function pause( array $args, array $assoc_args ): void {
		$this->act( fn( int $id ): bool => $this->service->pause( $id ), __( 'Sync paused.', 'searcio' ) );
	}

	/**
	 * Resume the paused sync.
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function resume( array $args, array $assoc_args ): void {
		$this->act( fn( int $id ): bool => $this->service->resume( $id ), __( 'Sync resumed.', 'searcio' ) );
	}

	/**
	 * Cancel the active sync.
	 *
	 * @when after_wp_load
	 *
	 * @param array<int,string>    $args
	 * @param array<string,string> $assoc_args
	 */
	public function cancel( array $args, array $assoc_args ): void {
		$this->act( fn( int $id ): bool => $this->service->cancel( $id ), __( 'Sync cancelled.', 'searcio' ) );
	}

	private function act( callable $callback, string $success ): void {
		$active = $this->state->active();

		if ( null === $active ) {
			\WP_CLI::error( __( 'There is no active sync.', 'searcio' ) );
		}

		if ( ! $callback( (int) $active['id'] ) ) {
			\WP_CLI::error( __( 'That action is not available for the current run state.', 'searcio' ) );
		}

		\WP_CLI::success( $success );
	}
}
