<?php
/**
 * Incremental change queue table.
 *
 * Editorial events (save/trash/delete/status change) enqueue the affected post
 * here instead of calling the API inline; a short-lived drain job coalesces and
 * batches them. At most one pending row per post: enqueuing replaces any
 * existing row so the latest action wins (an edit-then-delete collapses to a
 * single delete).
 *
 * The action column is `change_action` (not `action`) to stay clear of SQL
 * reserved words, consistent with the sync_runs table.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Database\Tables;

use Webhead\WP\SearchCloud\DTO\Queued_Change;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Blueprint;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Table;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Change_Queue_Table extends Table {
	protected function get_table_name(): string {
		return 'webhead_search_cloud_change_queue';
	}

	protected function get_table_schema( Blueprint $table ): void {
		$table->bigint( 'id' )->unsigned()->auto_increment()->primary();
		$table->bigint( 'object_id' )->unsigned()->not_nullable();
		// Stored so a delete can reconstruct the deterministic `{type}-{id}` document
		// id even after the post itself is gone.
		$table->string( 'object_type', 32 )->not_nullable()->default_to( 'post' );
		$table->string( 'change_action', 16 )->not_nullable();
		$table->timestamps();

		$table->index( 'object_id', [ 'object_id' ] );
	}

	protected function get_default_values(): array {
		return [];
	}

	public function get_version(): string {
		return '1.0';
	}

	public function enqueue( int $object_id, string $object_type, Change_Action $action ): void {
		$this->delete( [ 'object_id' => $object_id ] );

		$this->insert(
			[
				'object_id'     => $object_id,
				'object_type'   => $object_type,
				'change_action' => $action->value,
			]
		);
	}

	/**
	 * Returns oldest-first so the drain job processes changes in order.
	 *
	 * @return array<int,Queued_Change>
	 */
	public function claim( int $limit ): array {
		$rows = $this->fresh_query()
			->order_by( 'id', 'asc' )
			->limit( max( 1, $limit ) )
			->get();

		if ( ! is_array( $rows ) ) {
			return [];
		}

		return array_map(
			static fn( array $row ): Queued_Change => Queued_Change::from_row( $row ),
			$rows
		);
	}

	/**
	 * @param  array<int,int>  $ids
	 */
	public function remove( array $ids ): void {
		$ids = array_values( array_filter( array_map( 'intval', $ids ), static fn( int $id ): bool => $id > 0 ) );

		foreach ( $ids as $id ) {
			$this->delete( [ 'id' => $id ] );
		}
	}

	public function pending_count(): int {
		return (int) $this->fresh_query()->count();
	}

	public function clear(): void {
		$this->truncate();
	}
}
