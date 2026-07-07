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
	public function __construct(
		private Sync_Service $service,
		private Sync_State $state
	) {}

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
				\WP_CLI::error( (string) ( $result['message'] ?? __( 'Could not start the sync.', 'webhead-search-cloud' ) ) );
			}
		} elseif ( Sync_Status::Paused->value === (string) $run['status'] ) {
			$this->service->resume( (int) $run['id'] );
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
		} while ( null !== $active && $guard < 100000 );

		\WP_CLI::success( __( 'Sync completed.', 'webhead-search-cloud' ) );
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
			\WP_CLI::error( (string) ( $result['message'] ?? __( 'Could not start the sync.', 'webhead-search-cloud' ) ) );
		}

		\WP_CLI::success( __( 'Sync started.', 'webhead-search-cloud' ) );
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
		$this->act( fn( int $id ): bool => $this->service->pause( $id ), __( 'Sync paused.', 'webhead-search-cloud' ) );
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
		$this->act( fn( int $id ): bool => $this->service->resume( $id ), __( 'Sync resumed.', 'webhead-search-cloud' ) );
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
		$this->act( fn( int $id ): bool => $this->service->cancel( $id ), __( 'Sync cancelled.', 'webhead-search-cloud' ) );
	}

	private function act( callable $callback, string $success ): void {
		$active = $this->state->active();

		if ( null === $active ) {
			\WP_CLI::error( __( 'There is no active sync.', 'webhead-search-cloud' ) );
		}

		if ( ! $callback( (int) $active['id'] ) ) {
			\WP_CLI::error( __( 'That action is not available for the current run state.', 'webhead-search-cloud' ) );
		}

		\WP_CLI::success( $success );
	}
}
