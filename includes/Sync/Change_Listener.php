<?php
/**
 * Incremental change listener (PLAN §5.4).
 *
 * Watches editorial events and enqueues the affected post into the change queue
 * — it never calls the API inline. A short-lived, coalescing drain job is then
 * scheduled (debounced) to batch the changes. Status handling: a post that is
 * currently indexable is queued for upsert; one that left publish (or is no
 * longer indexable) but was previously indexed is queued for delete; deletions
 * are queued for delete.
 *
 * WooCommerce: variations are not indexed directly — a variation change maps to
 * its parent product so the parent document (price range, SKUs) stays fresh.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use WP_Post;
use Webhead\WP\SearchCloud\Database\Tables\Change_Queue_Table;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Hooks\Actions;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Jobs\Jobs_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Change_Listener implements Actions {
	/** Debounce window so a burst of edits coalesces into one drain. */
	private const DRAIN_DELAY = 10;

	public function __construct(
		private Index_Config $config,
		private Document_Builder $builder,
		private Dirty_Tracker $dirty,
		private Change_Queue_Table $queue,
		private Jobs_Manager $jobs
	) {}

	/**
	 * @return array<string,array{0:string,1:int,2:int}>
	 */
	public function get_actions(): array {
		return [
			'save_post'               => [ 'on_save', 20, 3 ],
			'transition_post_status'  => [ 'on_transition', 20, 3 ],
			'wp_trash_post'           => [ 'on_trash', 20, 1 ],
			'before_delete_post'      => [ 'on_delete', 20, 1 ],
			'woocommerce_update_product' => [ 'on_product', 20, 1 ],
		];
	}

	public function on_save( int $post_id, mixed $post = null, bool $update = false ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		$this->sync_post( $post instanceof WP_Post ? $post : get_post( $post_id ) );
	}

	public function on_transition( string $new_status, string $old_status, mixed $post = null ): void {
		$this->sync_post( $post instanceof WP_Post ? $post : null );
	}

	public function on_trash( int $post_id ): void {
		$this->maybe_delete( $post_id );
	}

	public function on_delete( int $post_id ): void {
		$this->maybe_delete( $post_id );
	}

	public function on_product( int $product_id ): void {
		$this->sync_post( get_post( $product_id ) );
	}

	private function sync_post( ?WP_Post $post ): void {
		if ( ! $post instanceof WP_Post ) {
			return;
		}

		// A variation change re-indexes its parent product, not the variation.
		if ( 'product_variation' === $post->post_type ) {
			if ( $post->post_parent > 0 ) {
				$this->sync_post( get_post( $post->post_parent ) );
			}

			return;
		}

		if ( ! $this->relevant( $post->post_type ) ) {
			return;
		}

		if ( $this->builder->is_indexable( $post ) ) {
			$this->enqueue( $post->ID, $post->post_type, Change_Action::Upsert );
		} elseif ( $this->dirty->was_indexed( $post->ID ) ) {
			$this->enqueue( $post->ID, $post->post_type, Change_Action::Delete );
		}
	}

	private function maybe_delete( int $post_id ): void {
		$post = get_post( $post_id );

		if ( ! $post instanceof WP_Post || ! $this->relevant( $post->post_type ) ) {
			return;
		}

		if ( $this->dirty->was_indexed( $post_id ) ) {
			$this->enqueue( $post_id, $post->post_type, Change_Action::Delete );
		}
	}

	private function relevant( string $post_type ): bool {
		return null !== $this->config->block_for( $post_type );
	}

	private function enqueue( int $object_id, string $object_type, Change_Action $action ): void {
		$this->queue->enqueue( $object_id, $object_type, $action );

		if ( ! $this->jobs->is_scheduled( Sync_Keys::HOOK_DRAIN ) ) {
			$this->jobs->schedule_single( Sync_Keys::HOOK_DRAIN, time() + self::DRAIN_DELAY );
		}
	}
}
