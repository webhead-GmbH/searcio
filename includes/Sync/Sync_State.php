<?php
/**
 * Sync run state.
 *
 * Thin business layer over {@see Sync_Runs_Table}: it owns the run lifecycle
 * transitions (create → run → progress → finish), the history operations behind
 * the DataViews UI, retention pruning of old rows, and the browser-safe
 * presentation of a row (casting counters, decoding the cursor, exposing
 * `trigger_type` as `trigger`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use Webhead\WP\SearchCloud\Database\Tables\Sync_Runs_Table;
use Webhead\WP\SearchCloud\Enums\Sync_Control;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_State {
	public function __construct(
		private Sync_Runs_Table $table
	) {}

	/**
	 * @param  array<string,mixed>  $cursor
	 */
	public function create( Sync_Trigger $trigger, ?int $user_id, bool $force, int $total_estimated, array $cursor ): int {
		$now = gmdate( 'Y-m-d H:i:s' );

		return $this->table->insert_row(
			[
				'status'          => Sync_Status::Running->value,
				'trigger_type'    => $trigger->value,
				'triggered_by'    => $user_id,
				'is_force'        => $force ? 1 : 0,
				'phase'           => null,
				'cursor_state'    => (string) wp_json_encode( $cursor ),
				'control'         => Sync_Control::None->value,
				'total_estimated' => $total_estimated,
				'processed'       => 0,
				'pushed'          => 0,
				'skipped'         => 0,
				'deleted'         => 0,
				'failed_count'    => 0,
				'started_at'      => $now,
			]
		);
	}

	/**
	 * Records an incremental drain as a single aggregated, already-finished row
	 * rather than one row per post.
	 */
	public function record_incremental( int $pushed, int $deleted, int $failed, ?string $error = null ): int {
		$now    = gmdate( 'Y-m-d H:i:s' );
		$status = ( $failed > 0 && 0 === $pushed && 0 === $deleted ) ? Sync_Status::Failed : Sync_Status::Completed;

		return $this->table->insert_row(
			[
				'status'          => $status->value,
				'trigger_type'    => Sync_Trigger::Incremental->value,
				'triggered_by'    => null,
				'is_force'        => 0,
				'phase'           => 'done',
				'control'         => Sync_Control::None->value,
				'total_estimated' => $pushed + $deleted,
				'processed'       => $pushed + $deleted,
				'pushed'          => $pushed,
				'skipped'         => 0,
				'deleted'         => $deleted,
				'failed_count'    => $failed,
				'started_at'      => $now,
				'finished_at'     => $now,
				'last_error'      => $error,
			]
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function active(): ?array {
		return $this->table->active_row();
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find( int $id ): ?array {
		return $this->table->find_row( $id );
	}

	/**
	 * @param  array<string,mixed>  $fields
	 */
	public function save( int $id, array $fields ): void {
		// Callers speak the API field name `cursor`; map it to the storage column.
		if ( array_key_exists( 'cursor', $fields ) ) {
			$cursor = $fields['cursor'];
			unset( $fields['cursor'] );
			$fields['cursor_state'] = is_array( $cursor ) ? (string) wp_json_encode( $cursor ) : (string) $cursor;
		}

		$this->table->update_row( $id, $fields );
	}

	public function finish( int $id, Sync_Status $status, ?string $error = null ): void {
		$this->table->update_row(
			$id,
			[
				'status'      => $status->value,
				'control'     => Sync_Control::None->value,
				'phase'       => 'done',
				'finished_at' => gmdate( 'Y-m-d H:i:s' ),
				'last_error'  => $error,
			]
		);
	}

	public function request_control( int $id, Sync_Control $signal ): void {
		$this->table->update_row( $id, [ 'control' => $signal->value ] );
	}

	/**
	 * Fresh read of the between-batch control signal (set by the REST control
	 * endpoint while a tick is running).
	 */
	public function control_signal( int $id ): Sync_Control {
		return Sync_Control::from_storage( $this->table->read_control( $id ) );
	}

	public function set_status( int $id, Sync_Status $status ): void {
		$this->table->update_row( $id, [ 'status' => $status->value, 'control' => Sync_Control::None->value ] );
	}

	/**
	 * @param  array<string,mixed>  $args
	 * @return array{items:array<int,array<string,mixed>>,total:int}
	 */
	public function history( array $args ): array {
		$result            = $this->table->query_history( $args );
		$result['items']   = array_map( [ $this, 'present' ], $result['items'] );

		return $result;
	}

	public function delete( int $id ): bool {
		$row = $this->find( $id );

		// Never delete the active run through the history surface.
		if ( null === $row || ( Sync_Status::tryFrom( (string) $row['status'] )?->is_active() ?? false ) ) {
			return false;
		}

		return $this->table->delete_row( $id );
	}

	public function clear_finished(): int {
		return $this->table->clear_finished();
	}

	/**
	 * Apply the retention policy. `$days <= 0` means unlimited (no pruning).
	 */
	public function apply_retention( int $days ): int {
		if ( $days <= 0 ) {
			return 0;
		}

		$cutoff = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );

		return $this->table->purge_older_than( $cutoff );
	}

	/**
	 * @param  array<string,mixed>  $row
	 * @return array<string,mixed>
	 */
	public function present( array $row ): array {
		$cursor = json_decode( (string) ( $row['cursor_state'] ?? '' ), true );

		return [
			'id'              => (int) ( $row['id'] ?? 0 ),
			'status'          => (string) ( $row['status'] ?? '' ),
			'trigger'         => (string) ( $row['trigger_type'] ?? '' ),
			'triggered_by'    => isset( $row['triggered_by'] ) ? (int) $row['triggered_by'] : null,
			'force'           => ! empty( $row['is_force'] ),
			'phase'           => isset( $row['phase'] ) ? (string) $row['phase'] : null,
			'cursor'          => is_array( $cursor ) ? $cursor : null,
			'total_estimated' => (int) ( $row['total_estimated'] ?? 0 ),
			'processed'       => (int) ( $row['processed'] ?? 0 ),
			'pushed'          => (int) ( $row['pushed'] ?? 0 ),
			'skipped'         => (int) ( $row['skipped'] ?? 0 ),
			'language_skipped' => (int) ( $row['language_skipped'] ?? 0 ),
			'deleted'         => (int) ( $row['deleted'] ?? 0 ),
			'failed_count'    => (int) ( $row['failed_count'] ?? 0 ),
			'started_at'      => $this->iso( $row['started_at'] ?? null ),
			'finished_at'     => $this->iso( $row['finished_at'] ?? null ),
			'last_error'      => isset( $row['last_error'] ) && '' !== (string) $row['last_error'] ? (string) $row['last_error'] : null,
			'created_at'      => $this->iso( $row['created_at'] ?? null ),
			'updated_at'      => $this->iso( $row['updated_at'] ?? null ),
		];
	}

	/**
	 * Normalize a stored GMT datetime into an ISO-8601 UTC string for the UI.
	 *
	 * @param  mixed  $value
	 */
	private function iso( $value ): ?string {
		$value = is_string( $value ) ? trim( $value ) : '';

		if ( '' === $value || str_starts_with( $value, '0000' ) ) {
			return null;
		}

		$timestamp = strtotime( $value . ' UTC' );

		return false === $timestamp ? null : gmdate( 'c', $timestamp );
	}
}
