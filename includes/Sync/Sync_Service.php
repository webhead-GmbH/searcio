<?php
/**
 * Sync engine orchestrator.
 *
 * Drives the resumable, batched full sync. One run row is the live state; each
 * cron tick processes a few batches, advances a keyset cursor, and reschedules
 * itself until the catalog is indexed and pruned. Work is idempotent and
 * dirty-tracked: a post is only re-pushed when its rendered document changes,
 * the mapping `config_version` moved, or a re-sync is forced.
 *
 * Everything is per-site: state lives in the per-blog sync_runs table and
 * per-blog options, so multisite subsites stay independent.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use WP_Post;
use Webhead\WP\SearchCloud\Connection\Api_Response;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Enums\Sync_Control;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Jobs\Jobs_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_Service {
	private const BATCH_SIZE           = 200;
	private const MAX_BATCHES_PER_TICK = 5;
	private const TICK_DELAY           = 5;
	private const BACKOFF_DELAY        = 60;
	private const PRUNE_PER_TICK       = 100;

	/**
	 * How long a scheduled tick may be overdue before the worker is treated as
	 * dead. A healthy run reschedules itself within {@see self::BACKOFF_DELAY}
	 * seconds, so anything past that plus a margin means WP-Cron is not firing
	 * (DISABLE_WP_CRON, no site traffic) or a fatal killed the tick. Operator
	 * control actions must then act directly instead of parking a between-batch
	 * signal that no live tick will ever read.
	 */
	private const STALE_TICK_GRACE = 120;

	public function __construct(
		private Index_Config $config,
		private Document_Builder $builder,
		private Search_Cloud_Client $client,
		private Sync_State $state,
		private Dirty_Tracker $dirty,
		private Jobs_Manager $jobs,
		private Settings_Manager $settings
	) {}

	/**
	 * @return array{ok:bool,run?:array<string,mixed>,message?:string}
	 */
	public function start( Sync_Trigger $trigger, ?int $user_id, bool $force ): array {
		if ( ! $this->client->is_configured() ) {
			return [
				'ok'      => false,
				'message' => __( 'Add and save your Search Cloud credentials before syncing.', 'webhead-search-cloud' ),
			];
		}

		$types = $this->config->indexable_post_types();

		if ( [] === $types ) {
			return [
				'ok'      => false,
				'message' => __( 'No content types are enabled for indexing yet.', 'webhead-search-cloud' ),
			];
		}

		if ( null !== $this->state->active() ) {
			return [
				'ok'      => false,
				'message' => __( 'A sync is already in progress.', 'webhead-search-cloud' ),
			];
		}

		update_option( Sync_Keys::OPTION_SEEN, [], false );
		update_option( Sync_Keys::OPTION_PRUNE, [], false );

		$cursor = [
			'phase'      => 'index',
			'type_index' => 0,
			'last_id'    => 0,
		];

		$id = $this->state->create( $trigger, $user_id, $force, $this->estimate_total( $types ), $cursor );

		if ( $id <= 0 ) {
			return [
				'ok'      => false,
				'message' => __( 'Could not start the sync run.', 'webhead-search-cloud' ),
			];
		}

		$this->schedule_tick( self::TICK_DELAY );

		$run = $this->state->find( $id );

		return [
			'ok'  => true,
			'run' => null === $run ? null : $this->state->present( $run ),
		];
	}

	public function tick(): void {
		$run = $this->state->active();

		if ( null === $run ) {
			return;
		}

		$id     = (int) $run['id'];
		$status = (string) $run['status'];

		// Only a running row advances; paused/queued rows wait for an explicit resume.
		if ( Sync_Status::Running->value !== $status ) {
			return;
		}

		$cursor   = $this->cursor( $run );
		$counters = $this->counters( $run );
		$force    = ! empty( $run['is_force'] );
		$types    = $this->config->indexable_post_types();
		$cv       = $this->config->config_version();

		for ( $batch = 0; $batch < self::MAX_BATCHES_PER_TICK; $batch++ ) {
			$signal = $this->state->control_signal( $id );

			if ( Sync_Control::Cancel === $signal ) {
				$this->cleanup_options();
				$this->state->finish( $id, Sync_Status::Cancelled );

				return;
			}

			if ( Sync_Control::Pause === $signal ) {
				$this->persist( $id, $cursor, $counters );
				$this->state->set_status( $id, Sync_Status::Paused );

				return;
			}

			if ( 'prune' === $cursor['phase'] ) {
				$done = $this->prune_step( $counters );
				$this->persist( $id, $cursor, $counters );

				if ( $done ) {
					$this->complete( $id );

					return;
				}

				continue;
			}

			// Indexing phase: have we exhausted every configured post type?
			if ( $cursor['type_index'] >= count( $types ) ) {
				$cursor['phase'] = 'prune';
				$this->begin_prune();
				$this->persist( $id, $cursor, $counters );

				continue;
			}

			$type   = $types[ $cursor['type_index'] ];
			$result = $this->index_batch( $type, (int) $cursor['last_id'], $force, $cv, $counters );

			if ( 'plan_limit' === $result['outcome'] ) {
				$this->state->finish( $id, Sync_Status::Failed, $result['message'] );

				return;
			}

			if ( 'error' === $result['outcome'] ) {
				// Transient failure survived the client's own retries: pause with an
				// actionable error and try again on a later, slower tick.
				$this->persist( $id, $cursor, $counters );
				$this->state->save( $id, [ 'last_error' => $result['message'] ] );
				$this->state->set_status( $id, Sync_Status::Paused );
				$this->schedule_tick( self::BACKOFF_DELAY );

				return;
			}

			if ( $result['exhausted'] ) {
				$cursor['type_index']++;
				$cursor['last_id'] = 0;
			} else {
				$cursor['last_id'] = $result['last_id'];
			}

			$cursor['phase'] = 'index';
			$this->persist( $id, $cursor, $counters, $type );
		}

		// More work remains: hand off to the next tick.
		$this->persist( $id, $cursor, $counters );
		$this->schedule_tick( self::TICK_DELAY );
	}

	public function run_scheduled(): void {
		$this->apply_retention();

		if ( null !== $this->state->active() || ! $this->client->is_configured() ) {
			return;
		}

		if ( [] === $this->config->indexable_post_types() ) {
			return;
		}

		$this->start( Sync_Trigger::Scheduled, null, false );
	}

	public function pause( int $id ): bool {
		$run = $this->state->find( $id );

		if ( null === $run || Sync_Status::Running->value !== (string) $run['status'] ) {
			return false;
		}

		// A live tick honours the signal cleanly at the next batch boundary. If
		// the worker is dead (cron not firing, or a fatal killed the tick) no
		// tick will ever read that signal, so pause the run directly — the cursor
		// is already persisted, so a later resume continues where it left off.
		if ( $this->worker_alive() ) {
			$this->state->request_control( $id, Sync_Control::Pause );
		} else {
			$this->state->set_status( $id, Sync_Status::Paused );
		}

		return true;
	}

	public function resume( int $id ): bool {
		$run = $this->state->find( $id );

		if ( null === $run || Sync_Status::Paused->value !== (string) $run['status'] ) {
			return false;
		}

		$this->state->save( $id, [ 'last_error' => null ] );
		$this->state->set_status( $id, Sync_Status::Running );
		$this->schedule_tick( self::TICK_DELAY );

		return true;
	}

	public function cancel( int $id ): bool {
		$run    = $this->state->find( $id );
		$status = null === $run ? null : Sync_Status::tryFrom( (string) $run['status'] );

		if ( null === $status || ! $status->is_active() ) {
			return false;
		}

		// A running run with a live tick stops cleanly at the next batch boundary
		// via the control signal. A paused/queued run — or a running run whose
		// tick worker is dead (cron not firing, a fatal killed it) — has no tick
		// in flight to honour that signal, so finish it directly: clear any stray
		// scheduled tick and free the single active slot so a new sync can start.
		if ( Sync_Status::Running === $status && $this->worker_alive() ) {
			$this->state->request_control( $id, Sync_Control::Cancel );
		} else {
			$this->jobs->unschedule( Sync_Keys::HOOK_TICK );
			$this->cleanup_options();
			$this->state->finish( $id, Sync_Status::Cancelled );
		}

		return true;
	}

	/**
	 * Is a tick worker demonstrably advancing the active run? True only when a
	 * tick is scheduled and not badly overdue. A scheduled-but-long-overdue tick
	 * means WP-Cron is not firing, so the run is effectively stuck and control
	 * actions must act directly rather than wait for a between-batch signal.
	 */
	private function worker_alive(): bool {
		$next = $this->jobs->next_run( Sync_Keys::HOOK_TICK );

		return false !== $next && $next > time() - self::STALE_TICK_GRACE;
	}

	public function apply_retention(): void {
		$days = (int) $this->settings->get( Plugin_Settings::SYNC_RETENTION_DAYS );

		$this->state->apply_retention( $days );
	}

	/**
	 * @return array<string,mixed>
	 */
	public function status(): array {
		$active = $this->state->active();

		return [
			'configured' => $this->client->is_configured(),
			'indexable'  => $this->config->indexable_post_types(),
			'active'     => null === $active ? null : $this->state->present( $active ),
		];
	}

	/* --------------------------------------------------------------------- */
	/* Indexing                                                              */
	/* --------------------------------------------------------------------- */

	/**
	 * @param  array<string,int>  $counters  Mutated in place.
	 * @return array{outcome:string,exhausted:bool,last_id:int,message?:string}
	 */
	private function index_batch( string $type, int $after_id, bool $force, int $cv, array &$counters ): array {
		$ids = $this->next_ids( $type, $after_id, self::BATCH_SIZE );

		if ( [] === $ids ) {
			return [
				'outcome'   => 'ok',
				'exhausted' => true,
				'last_id'   => $after_id,
			];
		}

		$documents = [];
		$targets   = [];
		$seen      = [];
		$last_id   = $after_id;

		foreach ( $ids as $post_id ) {
			$last_id = $post_id;
			$post    = get_post( $post_id );

			if ( $post instanceof WP_Post && $this->builder->is_language_excluded( $post ) ) {
				$counters['processed']++;
				$counters['language_skipped']++;

				continue;
			}

			if ( ! $post instanceof WP_Post || ! $this->builder->is_indexable( $post ) ) {
				$counters['processed']++;

				continue;
			}

			$document  = $this->builder->build( $post );
			$counters['processed']++;

			if ( null === $document ) {
				continue;
			}

			$doc_id        = (string) $document['id'];
			$seen[]        = $doc_id;
			$hash          = $this->builder->hash( $document );

			if ( ! $force && $this->dirty->is_fresh( $post, $hash, $cv ) ) {
				$counters['skipped']++;

				continue;
			}

			$documents[]        = $document;
			$targets[ $doc_id ] = [ $post_id, $hash ];
		}

		if ( [] !== $documents ) {
			$response = $this->client->bulk_upsert( $documents );

			if ( $response->is_plan_limit() ) {
				return [
					'outcome'   => 'plan_limit',
					'exhausted' => false,
					'last_id'   => $last_id,
					'message'   => $this->plan_limit_message( $response ),
				];
			}

			if ( ! $response->ok() ) {
				$counters['failed_count'] += count( $documents );

				return [
					'outcome'   => 'error',
					'exhausted' => false,
					'last_id'   => $after_id,
					'message'   => $this->error_message( $response ),
				];
			}

			foreach ( $targets as $target ) {
				[ $post_id, $hash ] = $target;
				$this->dirty->mark_synced( (int) $post_id, (string) $hash, $cv );
			}

			$counters['pushed'] += count( $documents );
		}

		if ( [] !== $seen ) {
			$this->append_seen( $seen );
		}

		return [
			'outcome'   => 'ok',
			'exhausted' => count( $ids ) < self::BATCH_SIZE,
			'last_id'   => $last_id,
		];
	}

	/**
	 * @return array<int,int>
	 */
	private function next_ids( string $type, int $after_id, int $limit ): array {
		global $wpdb;

		// Indexability (incl. the private toggle and product visibility) is decided
		// per post by Document_Builder; here we just page publish + private posts.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- keyset pagination over the posts table for a batched background sync.
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status IN ( %s, %s ) AND ID > %d ORDER BY ID ASC LIMIT %d",
				$type,
				'publish',
				'private',
				$after_id,
				$limit
			)
		);

		return array_map( 'intval', is_array( $ids ) ? $ids : [] );
	}

	/* --------------------------------------------------------------------- */
	/* Pruning                                                               */
	/* --------------------------------------------------------------------- */

	/**
	 * Ids present in the previous snapshot but not seen this run no longer
	 * exist, or are no longer indexable.
	 */
	private function begin_prune(): void {
		$snapshot = $this->read_ids( Sync_Keys::OPTION_SNAPSHOT );
		$seen     = array_fill_keys( $this->read_ids( Sync_Keys::OPTION_SEEN ), true );

		$to_delete = array_values(
			array_filter(
				$snapshot,
				static fn( string $doc_id ): bool => ! isset( $seen[ $doc_id ] )
			)
		);

		update_option( Sync_Keys::OPTION_PRUNE, $to_delete, false );
	}

	/**
	 * @param  array<string,int>  $counters
	 */
	private function prune_step( array &$counters ): bool {
		$queue = $this->read_ids( Sync_Keys::OPTION_PRUNE );

		if ( [] === $queue ) {
			return true;
		}

		$slice     = array_slice( $queue, 0, self::PRUNE_PER_TICK );
		$remaining = array_slice( $queue, count( $slice ) );

		foreach ( $slice as $doc_id ) {
			$response = $this->client->delete( $doc_id );

			if ( $response->ok() || 404 === $response->status ) {
				$counters['deleted']++;
				$this->dirty->clear_for_document( $doc_id );
			}
		}

		update_option( Sync_Keys::OPTION_PRUNE, $remaining, false );

		return [] === $remaining;
	}

	private function complete( int $id ): void {
		update_option( Sync_Keys::OPTION_SNAPSHOT, $this->read_ids( Sync_Keys::OPTION_SEEN ), false );
		$this->cleanup_options();
		$this->state->finish( $id, Sync_Status::Completed );
	}

	private function cleanup_options(): void {
		delete_option( Sync_Keys::OPTION_SEEN );
		delete_option( Sync_Keys::OPTION_PRUNE );
	}

	/* --------------------------------------------------------------------- */
	/* Helpers                                                               */
	/* --------------------------------------------------------------------- */

	private function schedule_tick( int $delay ): void {
		$this->jobs->schedule_single( Sync_Keys::HOOK_TICK, time() + max( 1, $delay ) );

		// Nudge WP-Cron so the dashboard feels live without waiting for traffic.
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	/**
	 * @param  array<string,int>  $counters
	 */
	private function persist( int $id, array $cursor, array $counters, ?string $phase_label = null ): void {
		$fields = $counters;
		$fields['cursor'] = $cursor;
		$fields['phase']  = $phase_label ?? (string) $cursor['phase'];

		$this->state->save( $id, $fields );
	}

	/**
	 * @param  array<string,mixed>  $run
	 * @return array{phase:string,type_index:int,last_id:int}
	 */
	private function cursor( array $run ): array {
		$cursor = json_decode( (string) ( $run['cursor_state'] ?? '' ), true );
		$cursor = is_array( $cursor ) ? $cursor : [];

		return [
			'phase'      => isset( $cursor['phase'] ) ? (string) $cursor['phase'] : 'index',
			'type_index' => (int) ( $cursor['type_index'] ?? 0 ),
			'last_id'    => (int) ( $cursor['last_id'] ?? 0 ),
		];
	}

	/**
	 * @param  array<string,mixed>  $run
	 * @return array<string,int>
	 */
	private function counters( array $run ): array {
		return [
			'processed'        => (int) ( $run['processed'] ?? 0 ),
			'pushed'           => (int) ( $run['pushed'] ?? 0 ),
			'skipped'          => (int) ( $run['skipped'] ?? 0 ),
			'language_skipped' => (int) ( $run['language_skipped'] ?? 0 ),
			'deleted'          => (int) ( $run['deleted'] ?? 0 ),
			'failed_count'     => (int) ( $run['failed_count'] ?? 0 ),
		];
	}

	/**
	 * @param  array<int,string>  $types
	 */
	private function estimate_total( array $types ): int {
		$total = 0;

		foreach ( $types as $type ) {
			$counts = wp_count_posts( $type );

			if ( is_object( $counts ) ) {
				$total += (int) ( $counts->publish ?? 0 ) + (int) ( $counts->private ?? 0 );
			}
		}

		return $total;
	}

	/**
	 * @param  array<int,string>  $ids
	 */
	private function append_seen( array $ids ): void {
		$current = $this->read_ids( Sync_Keys::OPTION_SEEN );

		update_option( Sync_Keys::OPTION_SEEN, array_values( array_unique( array_merge( $current, $ids ) ) ), false );
	}

	/**
	 * @return array<int,string>
	 */
	private function read_ids( string $option ): array {
		$value = get_option( $option, [] );

		if ( ! is_array( $value ) ) {
			return [];
		}

		return array_values( array_filter( array_map( 'strval', $value ), static fn( string $id ): bool => '' !== $id ) );
	}

	private function plan_limit_message( Api_Response $response ): string {
		$metric = isset( $response->body['metric'] ) ? (string) $response->body['metric'] : '';
		$limit  = isset( $response->body['limit'] ) ? (int) $response->body['limit'] : 0;

		if ( '' !== $metric && $limit > 0 ) {
			return sprintf(
				/* translators: 1: plan metric name, 2: plan limit. */
				__( 'Plan limit reached for %1$s (limit %2$s). Upgrade your plan or reduce what you index, then re-run the sync.', 'webhead-search-cloud' ),
				$metric,
				number_format_i18n( $limit )
			);
		}

		return __( 'Your Search Cloud plan limit was reached. Upgrade your plan or reduce what you index, then re-run the sync.', 'webhead-search-cloud' );
	}

	private function error_message( Api_Response $response ): string {
		if ( $response->transport_error ) {
			return __( 'Could not reach Search Cloud. The sync is paused and will retry.', 'webhead-search-cloud' );
		}

		return sprintf(
			/* translators: %d: HTTP status code. */
			__( 'Search Cloud returned an error (HTTP %d). The sync is paused and will retry.', 'webhead-search-cloud' ),
			$response->status
		);
	}
}
