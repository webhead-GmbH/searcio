<?php
/**
 * Incremental drain.
 *
 * Coalesces and processes queued post changes in batches: rebuilds and upserts
 * documents that are still indexable, deletes the rest, and clears the per-post
 * sync meta on delete. Each drain is recorded as a single aggregated sync_runs
 * row (trigger = incremental). Dirty tracking is honoured, so an upsert whose
 * document has not changed is skipped. Reschedules itself while the queue is
 * non-empty, and yields to a full sync if one is running.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use WP_Post;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Database\Tables\Change_Queue_Table;
use Webhead\WP\SearchCloud\DTO\Queued_Change;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Jobs\Jobs_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Incremental_Service {
	private const BATCH_SIZE    = 100;
	private const RETRY_DELAY   = 60;
	private const FOLLOWUP_DELAY = 10;

	public function __construct(
		private Index_Config $config,
		private Document_Builder $builder,
		private Search_Cloud_Client $client,
		private Dirty_Tracker $dirty,
		private Change_Queue_Table $queue,
		private Sync_State $state,
		private Jobs_Manager $jobs
	) {}

	public function drain(): void {
		// A full sync owns the index while it runs; let it finish first.
		if ( null !== $this->state->active() || ! $this->client->is_configured() ) {
			$this->reschedule( self::RETRY_DELAY );

			return;
		}

		$changes = $this->queue->claim( self::BATCH_SIZE );

		if ( [] === $changes ) {
			return;
		}

		$cv          = $this->config->config_version();
		$documents   = [];
		$targets     = [];
		$delete_docs = [];
		$processed   = [];
		$pushed      = 0;
		$deleted     = 0;
		$failed      = 0;

		foreach ( $changes as $change ) {
			$processed[] = $change->id;
			$action      = $this->resolve_action( $change );

			if ( Change_Action::Delete === $action ) {
				$delete_docs[] = $change->document_id();

				continue;
			}

			$post = get_post( $change->object_id );

			if ( ! $post instanceof WP_Post ) {
				continue;
			}

			$document = $this->builder->build( $post );

			if ( null === $document ) {
				continue;
			}

			$hash = $this->builder->hash( $document );

			if ( $this->dirty->is_fresh( $post, $hash, $cv ) ) {
				continue;
			}

			$documents[]                          = $document;
			$targets[ (string) $document['id'] ] = [ $change->object_id, $hash ];
		}

		if ( [] !== $documents ) {
			$response = $this->client->bulk_upsert( array_values( $documents ) );

			if ( $response->ok() ) {
				foreach ( $targets as $target ) {
					[ $object_id, $hash ] = $target;
					$this->dirty->mark_synced( (int) $object_id, (string) $hash, $cv );
				}

				$pushed += count( $documents );
			} else {
				// Leave the rows queued and retry later; a plan limit needs admin action.
				$failed += count( $documents );
				$this->reschedule( self::RETRY_DELAY );

				if ( $response->is_plan_limit() ) {
					$this->state->record_incremental( 0, 0, $failed, $this->plan_limit_message() );
				}

				return;
			}
		}

		// The API has no bulk delete.
		foreach ( $delete_docs as $doc_id ) {
			$response = $this->client->delete( $doc_id );

			if ( $response->ok() || 404 === $response->status ) {
				$this->dirty->clear_for_document( $doc_id );
				$deleted++;
			} else {
				$failed++;
			}
		}

		$this->queue->remove( $processed );

		if ( $pushed > 0 || $deleted > 0 || $failed > 0 ) {
			$this->state->record_incremental( $pushed, $deleted, $failed );
		}

		if ( $this->queue->pending_count() > 0 ) {
			$this->reschedule( self::FOLLOWUP_DELAY );
		}
	}

	/**
	 * A queued upsert for a post that's no longer indexable becomes a delete.
	 */
	private function resolve_action( Queued_Change $change ): Change_Action {
		if ( Change_Action::Delete === $change->action ) {
			return Change_Action::Delete;
		}

		$post = get_post( $change->object_id );

		if ( ! $post instanceof WP_Post || null === $this->config->block_for( $post->post_type ) || ! $this->builder->is_indexable( $post ) ) {
			return Change_Action::Delete;
		}

		return Change_Action::Upsert;
	}

	private function reschedule( int $delay ): void {
		if ( $this->jobs->is_scheduled( Sync_Keys::HOOK_DRAIN ) ) {
			return;
		}

		$this->jobs->schedule_single( Sync_Keys::HOOK_DRAIN, time() + max( 1, $delay ) );

		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	private function plan_limit_message(): string {
		return __( 'Incremental sync paused: your Search Cloud plan limit was reached.', 'webhead-search-cloud' );
	}
}
