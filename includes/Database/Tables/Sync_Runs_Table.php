<?php
/**
 * Sync runs table.
 *
 * Single source of truth for sync state and history. One row per run: the
 * active row (queued/running/paused) is the live state polled by the Sync
 * dashboard; finished rows form the DataViews history. Incremental syncs
 * record aggregated batch rows here too.
 *
 * The trigger source is stored as `trigger_type` because `trigger` is a
 * reserved SQL word; the REST payload exposes it as `trigger`.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Database\Tables;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Blueprint;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Table;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_Runs_Table extends Table {
	protected function get_table_name(): string {
		return 'webhead_search_cloud_sync_runs';
	}

	/**
	 * Schema:
	 * | Column          | Type         |
	 * | --------------- | ------------ |
	 * | id              | BIGINT(20)   |
	 * | status          | VARCHAR(20)  | queued|running|paused|completed|failed|cancelled
	 * | trigger_type    | VARCHAR(20)  | manual|scheduled|incremental
	 * | triggered_by    | BIGINT(20)   | user id, null for scheduled/incremental
	 * | is_force        | TINYINT(1)   | ignore dirty hashes when set
	 * | phase           | VARCHAR(40)  | current post type / "prune" / "done"
	 * | cursor_state    | TEXT         | resumable cursor (JSON)
	 * | control         | VARCHAR(20)  | between-batch signal: ''|pause|cancel
	 *
	 * `is_force`/`cursor_state` avoid the reserved SQL words FORCE/CURSOR, like
	 * `trigger_type` avoids TRIGGER; the REST payload exposes them as `force`/`cursor`.
	 * | total_estimated | INT          |
	 * | processed       | INT          |
	 * | pushed          | INT          |
	 * | skipped         | INT          |
	 * | language_skipped| INT          | skipped by the language restriction
	 * | deleted         | INT          |
	 * | failed_count    | INT          |
	 * | started_at      | DATETIME     |
	 * | finished_at     | DATETIME     |
	 * | last_error      | TEXT         |
	 * | created_at      | TIMESTAMP    |
	 * | updated_at      | TIMESTAMP    |
	 */
	protected function get_table_schema( Blueprint $table ): void {
		$table->bigint( 'id' )->unsigned()->auto_increment()->primary();
		$table->string( 'status', 20 )->not_nullable()->default_to( 'queued' );
		$table->string( 'trigger_type', 20 )->not_nullable()->default_to( 'manual' );
		$table->bigint( 'triggered_by' )->unsigned()->nullable();
		$table->boolean( 'is_force' )->default_to( '0' );
		$table->string( 'phase', 40 )->nullable();
		$table->text( 'cursor_state' )->nullable();
		$table->string( 'control', 20 )->not_nullable()->default_to( '' );
		$table->integer( 'total_estimated' )->default_to( '0' );
		$table->integer( 'processed' )->default_to( '0' );
		$table->integer( 'pushed' )->default_to( '0' );
		$table->integer( 'skipped' )->default_to( '0' );
		$table->integer( 'language_skipped' )->default_to( '0' );
		$table->integer( 'deleted' )->default_to( '0' );
		$table->integer( 'failed_count' )->default_to( '0' );
		$table->datetime( 'started_at' )->nullable();
		$table->datetime( 'finished_at' )->nullable();
		$table->text( 'last_error' )->nullable();
		$table->timestamps();

		$table->index( 'status', [ 'status' ] );
		$table->index( 'trigger_type', [ 'trigger_type' ] );
		$table->index( 'created_at', [ 'created_at' ] );
	}

	protected function get_default_values(): array {
		return [];
	}

	public function get_version(): string {
		return '1.1';
	}

	/** Columns allowed as a history sort key (defends the order_by input). */
	private const SORTABLE = [ 'id', 'status', 'trigger_type', 'processed', 'pushed', 'created_at', 'finished_at' ];

	/**
	 * @param  array<string,mixed>  $data
	 */
	public function insert_row( array $data ): int {
		$result = $this->insert( $data );

		if ( false === $result ) {
			return 0;
		}

		return (int) $this->get_connection()->insert_id;
	}

	/**
	 * @param  array<string,mixed>  $data
	 */
	public function update_row( int $id, array $data ): void {
		$this->update( $data, [ 'id' => $id ] );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function find_row( int $id ): ?array {
		$row = $this->fresh_query()->where( 'id', $id )->first();

		return $this->row_or_null( $row );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function active_row(): ?array {
		$row = $this->fresh_query()
			->where_in( 'status', Sync_Status::active_values() )
			->order_by_desc( 'id' )
			->first();

		return $this->row_or_null( $row );
	}

	/**
	 * Fresh read of just the between-batch control signal for a run.
	 */
	public function read_control( int $id ): string {
		$value = $this->fresh_query()->where( 'id', $id )->value( 'control' );

		return is_string( $value ) ? $value : '';
	}

	/**
	 * Filtered, sorted, paginated history slice plus the total matching count.
	 *
	 * @param  array<string,mixed>  $args
	 * @return array{items:array<int,array<string,mixed>>,total:int}
	 */
	public function query_history( array $args ): array {
		$per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$order_by = in_array( $args['order_by'] ?? '', self::SORTABLE, true ) ? (string) $args['order_by'] : 'id';
		$order    = strtolower( (string) ( $args['order'] ?? 'desc' ) ) === 'asc' ? 'asc' : 'desc';

		$total = (int) $this->apply_filters( $this->fresh_query(), $args )->count();

		$items = $this->apply_filters( $this->fresh_query(), $args )
			->order_by( $order_by, $order )
			->for_page( $page, $per_page )
			->get();

		return [
			'items' => is_array( $items ) ? $items : [],
			'total' => $total,
		];
	}

	public function delete_row( int $id ): bool {
		return false !== $this->delete( [ 'id' => $id ] );
	}

	/**
	 * Remove every finished (non-active) row. Returns the number deleted.
	 */
	public function clear_finished(): int {
		$deleted = 0;

		foreach ( Sync_Status::finished_values() as $status ) {
			$result = $this->delete( [ 'status' => $status ] );

			if ( false !== $result ) {
				$deleted += (int) $result;
			}
		}

		return $deleted;
	}

	/**
	 * Retention: delete finished rows created before the cutoff. Active rows are
	 * inherently excluded because only finished statuses are matched.
	 */
	public function purge_older_than( string $cutoff_gmt ): int {
		$deleted = 0;

		foreach ( Sync_Status::finished_values() as $status ) {
			$result = $this->delete(
				[
					'status'       => $status,
					'created_at <' => $cutoff_gmt,
				]
			);

			if ( false !== $result ) {
				$deleted += (int) $result;
			}
		}

		return $deleted;
	}

	/**
	 * @param  \Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Query\Builder  $query
	 * @param  array<string,mixed>  $args
	 */
	private function apply_filters( $query, array $args ) {
		if ( ! empty( $args['status'] ) && null !== Sync_Status::tryFrom( (string) $args['status'] ) ) {
			$query->where( 'status', (string) $args['status'] );
		}

		if ( ! empty( $args['trigger'] ) && null !== Sync_Trigger::tryFrom( (string) $args['trigger'] ) ) {
			$query->where( 'trigger_type', (string) $args['trigger'] );
		}

		if ( ! empty( $args['date_after'] ) ) {
			$query->where( 'created_at', '>=', (string) $args['date_after'] );
		}

		if ( ! empty( $args['date_before'] ) ) {
			$query->where( 'created_at', '<=', (string) $args['date_before'] );
		}

		return $query;
	}

	/**
	 * @param  mixed  $row
	 * @return array<string,mixed>|null
	 */
	private function row_or_null( $row ): ?array {
		if ( ! is_array( $row ) || ! isset( $row['id'] ) ) {
			return null;
		}

		return $row;
	}
}
