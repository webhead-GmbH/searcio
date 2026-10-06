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
	private const PRUNE_PER_TICK       = 100;

	/**
	 * How long a run waits before it sends a batch the index did not take
	 * again: a minute after the first failure, then longer each time. The
	 * client has already tried each request a few times within seconds, so
	 * what gets here is an index that is down, not one that hiccuped.
	 *
	 * The waits add up to a little over an hour. A run that still cannot write
	 * then is given up: it holds the one active slot, and while it does the
	 * incremental drain sends no change and no scheduled sync starts.
	 *
	 * @var array<int,int>
	 */
	private const RETRY_DELAYS = [
		MINUTE_IN_SECONDS,
		2 * MINUTE_IN_SECONDS,
		5 * MINUTE_IN_SECONDS,
		10 * MINUTE_IN_SECONDS,
		15 * MINUTE_IN_SECONDS,
		30 * MINUTE_IN_SECONDS,
	];

	/**
	 * Wall-clock budget for one tick. A prune batch costs one HTTP round trip
	 * per document (the API has no bulk delete), so a batch count alone can't
	 * keep a tick inside PHP's execution limit — a large prune queue would run
	 * hundreds of blocking requests in a single invocation and get killed.
	 */
	private const TICK_BUDGET = 20;

	/**
	 * When the next tick is re-armed *before* the work starts, so a tick that
	 * dies mid-batch still leaves a scheduled successor. Comfortably longer than
	 * {@see self::TICK_BUDGET} so it never races a healthy tick.
	 */
	private const WATCHDOG_DELAY = 180;

	/**
	 * How long a scheduled tick may be overdue before the worker is treated as
	 * dead. A run schedules its next tick itself, seconds ahead or, while it
	 * waits to try a failed batch again, up to half an hour ahead; a tick that
	 * is this long past its time means WP-Cron is not firing
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
		private Failed_Deletes $failed_deletes,
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
			'retries'    => 0,
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
			$this->clear_tick();

			return;
		}

		$id     = (int) $run['id'];
		$status = (string) $run['status'];

		// Only a running row advances. A paused one waits for Resume, or for
		// the next scheduled sync, which resumes it: see run_scheduled().
		if ( Sync_Status::Running->value !== $status ) {
			return;
		}

		/*
		 * Dead man's switch. Every clean exit below either reschedules or clears
		 * this, so it only ever fires when the tick itself died — PHP's
		 * max_execution_time, an OOM, or the worker being killed mid-batch. That
		 * used to orphan the run: the follow-up tick was scheduled at the very
		 * end of this method, so a tick that never reached the end left a run
		 * Running with no worker, which also blocked every future scheduled sync.
		 */
		$this->schedule_tick( self::WATCHDOG_DELAY );

		$cursor   = $this->cursor( $run );
		$counters = $this->counters( $run );
		$force    = ! empty( $run['is_force'] );
		$types    = $this->config->indexable_post_types();
		$cv       = $this->config->config_version();
		// Wall-clock budget, checked between batches: batch sizes alone are a
		// poor proxy for how long a tick takes, since a prune batch is one HTTP
		// round trip *per document*.
		$deadline = time() + $this->tick_budget();

		for ( $batch = 0; $batch < self::MAX_BATCHES_PER_TICK; $batch++ ) {
			if ( $batch > 0 && time() >= $deadline ) {
				break;
			}

			$signal = $this->state->control_signal( $id );

			if ( Sync_Control::Cancel === $signal ) {
				$this->cleanup_options();
				$this->state->finish( $id, Sync_Status::Cancelled );
				$this->clear_tick();

				return;
			}

			if ( Sync_Control::Pause === $signal ) {
				$this->persist( $id, $cursor, $counters );
				$this->state->set_status( $id, Sync_Status::Paused );
				$this->clear_tick();

				return;
			}

			if ( 'prune' === $cursor['phase'] ) {
				$prune_error = null;
				$done        = $this->prune_step( $counters, $deadline, $prune_error );
				$this->persist( $id, $cursor, $counters );

				if ( null !== $prune_error ) {
					$this->state->save( $id, [ 'last_error' => $prune_error ] );
				}

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
			$before = $counters;
			$result = $this->index_batch( $type, (int) $cursor['last_id'], $force, $cv, $counters );

			if ( 'plan_limit' === $result['outcome'] ) {
				$this->state->finish( $id, Sync_Status::Failed, $result['message'] );
				$this->clear_tick();

				return;
			}

			if ( 'error' === $result['outcome'] ) {
				/*
				 * The index did not take the batch, after the client's own tries.
				 * The run stays running and sends the same batch again later,
				 * waiting longer each time. It used to be set to Paused here with
				 * a tick scheduled "to retry", but a tick does not advance a
				 * paused run: nothing ever resumed it, and it held the active slot
				 * until somebody pressed Resume.
				 *
				 * Nothing of the batch is counted: it is read again on the next
				 * try, and counting each try would have the run process more than
				 * there is. Its documents count as failed once, when the run stops
				 * trying.
				 */
				$counters = $before;
				$cursor['retries']++;
				$given_up = $cursor['retries'] > count( self::RETRY_DELAYS );

				if ( $given_up ) {
					$counters['failed_count'] += $result['failed'];
				}

				$this->persist( $id, $cursor, $counters );

				if ( $given_up ) {
					$this->state->finish( $id, Sync_Status::Failed, $this->given_up_message( $result['response'], $cursor['retries'] ) );
					$this->clear_tick();

					return;
				}

				$delay = self::RETRY_DELAYS[ $cursor['retries'] - 1 ];

				$this->state->save( $id, [ 'last_error' => $this->retry_message( $result['response'], $delay ) ] );
				$this->schedule_tick( $delay );

				return;
			}

			if ( $cursor['retries'] > 0 ) {
				// The index is taking writes again: the failure is behind the run.
				$cursor['retries'] = 0;
				$this->state->save( $id, [ 'last_error' => null ] );
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

		$active = $this->state->active();

		if ( null !== $active ) {
			/*
			 * An interrupted run holds the active slot, so without this every
			 * later scheduled sync is a silent no-op and the run sits at
			 * Running forever. If nothing is coming to advance it, re-arm the
			 * worker: the cursor is already persisted, so the run picks up
			 * exactly where the dead tick left off.
			 */
			if ( Sync_Status::Running->value === (string) $active['status'] && ! $this->worker_alive() ) {
				$this->schedule_tick( self::TICK_DELAY );
			}

			/*
			 * A paused run holds the slot as well, and nothing but a person ends
			 * a pause. The scheduled sync is the site's promise that the index
			 * is brought up to date every day, and a pause does not take that
			 * back: it lasts until this runs at the latest. That also picks up
			 * the runs earlier versions paused at their first failure and left.
			 */
			if ( Sync_Status::Paused->value === (string) $active['status'] ) {
				$this->resume( (int) $active['id'] );
			}

			return;
		}

		if ( ! $this->client->is_configured() ) {
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
		// A run that is waiting to try a batch again has no tick at work either:
		// its next one is minutes away, and is not needed once it is paused.
		if ( $this->awaits_retry( $run ) ) {
			$this->clear_tick();
			$this->state->set_status( $id, Sync_Status::Paused );
		} elseif ( $this->worker_alive() ) {
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

		// Whoever resumes it wants it tried now, and from the shortest wait.
		$cursor            = $this->cursor( $run );
		$cursor['retries'] = 0;

		$this->state->save(
			$id,
			[
				'last_error' => null,
				'cursor'     => $cursor,
			]
		);
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
		if ( Sync_Status::Running === $status && $this->worker_alive() && ! $this->awaits_retry( $run ) ) {
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

	/**
	 * Seconds until the active run sends a batch the index did not take again,
	 * or 0 when it is not waiting to. For a caller that drives the run itself,
	 * as `wp webhead-search-cloud sync run` does, and so has to wait as WP-Cron
	 * would.
	 */
	public function seconds_until_retry(): int {
		$run = $this->state->active();

		if ( null === $run || Sync_Status::Running->value !== (string) $run['status'] || ! $this->awaits_retry( $run ) ) {
			return 0;
		}

		$next = $this->jobs->next_run( Sync_Keys::HOOK_TICK );

		return false === $next ? 0 : max( 0, (int) $next - time() );
	}

	/**
	 * Is the run between two tries of a batch the index did not take? No tick
	 * is at work then, and the next one can be half an hour away, so a control
	 * action acts on the run itself rather than leave a signal for that tick.
	 *
	 * @param  array<string,mixed>  $run
	 */
	private function awaits_retry( array $run ): bool {
		return $this->cursor( $run )['retries'] > 0;
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
	 * @return array{outcome:string,exhausted:bool,last_id:int,message?:string,response?:Api_Response,failed?:int}
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
				return [
					'outcome'   => 'error',
					'exhausted' => false,
					'last_id'   => $after_id,
					'response'  => $response,
					'failed'    => count( $documents ),
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
	 * A document this site put in the index that was not seen this run no
	 * longer exists, or is no longer indexable. Three records say what was put
	 * there. The sync meta on each post is written by the incremental drain as
	 * well as by full syncs, so it covers documents no full sync ever pushed,
	 * which the snapshot does not name. The snapshot of the last completed run
	 * still names documents whose posts have since been deleted outright,
	 * taking their meta with them. {@see Failed_Deletes} names the documents
	 * whose delete the drain or an earlier prune could not complete, which
	 * covers a post deleted outright that only the drain ever pushed, and one
	 * whose refused prune dropped it from the snapshot: no other record names
	 * either.
	 */
	private function begin_prune(): void {
		$seen    = array_fill_keys( $this->read_ids( Sync_Keys::OPTION_SEEN ), true );
		$refused = $this->failed_deletes->ids();
		$indexed = array_merge( $this->read_ids( Sync_Keys::OPTION_SNAPSHOT ), $this->dirty->indexed_document_ids(), $refused );

		$to_delete = array_keys( array_diff_key( array_fill_keys( $indexed, true ), $seen ) );

		// A document this run saw belongs in the index again (a trashed post was
		// restored), so the delete that failed for it is no longer owed.
		$this->failed_deletes->forget( array_keys( array_intersect_key( array_fill_keys( $refused, true ), $seen ) ) );

		update_option( Sync_Keys::OPTION_PRUNE, $to_delete, false );
	}

	/**
	 * @param  array<string,int>  $counters
	 * @param  int                $deadline Unix time this tick must stop by.
	 * @param  string|null        $error    First failure seen, for the run's last_error.
	 */
	private function prune_step( array &$counters, int $deadline, ?string &$error = null ): bool {
		$queue = $this->read_ids( Sync_Keys::OPTION_PRUNE );

		if ( [] === $queue ) {
			return true;
		}

		$slice     = array_slice( $queue, 0, self::PRUNE_PER_TICK );
		$remaining = array_slice( $queue, count( $slice ) );
		$done      = 0;
		$removed   = [];
		$refused   = [];

		foreach ( $slice as $doc_id ) {
			// Each delete is its own request, so the deadline is checked per
			// document rather than per batch: one slice against a slow API can
			// outlast the whole tick on its own.
			if ( $done > 0 && time() >= $deadline ) {
				$remaining = array_merge( array_slice( $slice, $done ), $remaining );

				break;
			}

			$response = $this->client->delete( $doc_id );
			$done++;

			if ( $response->ok() || 404 === $response->status ) {
				$counters['deleted']++;
				$this->dirty->clear_for_document( $doc_id );
				$removed[] = $doc_id;

				continue;
			}

			/*
			 * The document stays in the remote index. Counting it (rather than
			 * dropping it silently, as this used to) is what makes a broken
			 * delete endpoint visible: the dashboard otherwise showed a prune
			 * running for hours with "deleted 0" and no error to explain it.
			 * The queue still advances — one unusable document must not wedge
			 * the run behind it forever.
			 */
			$refused[] = $doc_id;
			$counters['failed_count']++;

			if ( null === $error ) {
				$error = sprintf(
					/* translators: 1: document id, 2: HTTP status code. */
					__( 'Could not remove %1$s from the index (HTTP %2$d).', 'webhead-search-cloud' ),
					$doc_id,
					$response->status
				);
			}
		}

		/*
		 * A refused document goes on the list of refused deletes so the next
		 * full sync retries it: when only the snapshot named it (a post deleted
		 * outright whose type is no longer indexed, so the change listener
		 * queued nothing), complete() will replace that snapshot with what
		 * this run saw. A removed document leaves the list. The list is
		 * written before the queue advances, so a tick that dies in between
		 * sends the slice again rather than losing a refusal.
		 */
		$this->failed_deletes->add( $refused );
		$this->failed_deletes->forget( $removed );
		update_option( Sync_Keys::OPTION_PRUNE, $remaining, false );

		return [] === $remaining;
	}

	private function complete( int $id ): void {
		update_option( Sync_Keys::OPTION_SNAPSHOT, $this->read_ids( Sync_Keys::OPTION_SEEN ), false );
		$this->cleanup_options();

		// `finish()` writes `last_error` unconditionally, so carry forward what
		// the run already recorded — a completed run that could not remove some
		// documents still has to say why.
		$run   = $this->state->find( $id );
		$error = isset( $run['last_error'] ) ? (string) $run['last_error'] : '';

		$this->state->finish( $id, Sync_Status::Completed, '' === $error ? null : $error );
		$this->clear_tick();
	}

	private function cleanup_options(): void {
		delete_option( Sync_Keys::OPTION_SEEN );
		delete_option( Sync_Keys::OPTION_PRUNE );
	}

	/* --------------------------------------------------------------------- */
	/* Helpers                                                               */
	/* --------------------------------------------------------------------- */

	private function schedule_tick( int $delay ): void {
		// Replace rather than add: WP-Cron refuses a duplicate of the same hook
		// within ten minutes, so the watchdog armed at the top of a tick would
		// otherwise swallow the real (much sooner) follow-up scheduled at the
		// end of it.
		$this->jobs->unschedule( Sync_Keys::HOOK_TICK );
		$this->jobs->schedule_single( Sync_Keys::HOOK_TICK, time() + max( 1, $delay ) );

		// Nudge WP-Cron so the dashboard feels live without waiting for traffic.
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
	}

	/** No more work is coming for this run, so the armed watchdog must go too. */
	private function clear_tick(): void {
		$this->jobs->unschedule( Sync_Keys::HOOK_TICK );
	}

	/**
	 * Seconds of wall clock one tick may spend. Filterable because the safe
	 * value is a property of the host, not of this plugin: shared hosting with
	 * a 30-second `max_execution_time` wants less, a WP-CLI or system-cron
	 * driven site can afford much more.
	 */
	private function tick_budget(): int {
		/**
		 * Filters the per-tick wall-clock budget, in seconds.
		 *
		 * @since 1.0.3
		 *
		 * @param  int  $budget  Default {@see self::TICK_BUDGET}.
		 */
		$budget = (int) apply_filters( 'webhead_search_cloud/sync/tick_budget', self::TICK_BUDGET );

		return max( 0, $budget );
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
	 * `retries` counts the tries of the current batch that failed one after the
	 * other; a batch the index takes sets it back to 0.
	 *
	 * @param  array<string,mixed>  $run
	 * @return array{phase:string,type_index:int,last_id:int,retries:int}
	 */
	private function cursor( array $run ): array {
		$cursor = json_decode( (string) ( $run['cursor_state'] ?? '' ), true );
		$cursor = is_array( $cursor ) ? $cursor : [];

		return [
			'phase'      => isset( $cursor['phase'] ) ? (string) $cursor['phase'] : 'index',
			'type_index' => (int) ( $cursor['type_index'] ?? 0 ),
			'last_id'    => (int) ( $cursor['last_id'] ?? 0 ),
			'retries'    => max( 0, (int) ( $cursor['retries'] ?? 0 ) ),
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

	/**
	 * What a run says while it waits to send a batch again.
	 *
	 * @param  int  $delay  Seconds until the next try.
	 */
	private function retry_message( Api_Response $response, int $delay ): string {
		$wait = human_time_diff( time(), time() + $delay );

		if ( $response->transport_error ) {
			return sprintf(
				/* translators: %s: a length of time, such as "5 mins". */
				__( 'Could not reach Search Cloud. The sync tries again in %s.', 'webhead-search-cloud' ),
				$wait
			);
		}

		return sprintf(
			/* translators: 1: HTTP status code, 2: a length of time, such as "5 mins". */
			__( 'Search Cloud returned an error (HTTP %1$d). The sync tries again in %2$s.', 'webhead-search-cloud' ),
			$response->status,
			$wait
		);
	}

	/**
	 * What a run says when it stops trying.
	 *
	 * @param  int  $tries  How many times the batch was sent.
	 */
	private function given_up_message( Api_Response $response, int $tries ): string {
		if ( $response->transport_error ) {
			return sprintf(
				/* translators: %d: number of tries. */
				__( 'Could not reach Search Cloud in %d tries, so this sync was stopped. The next scheduled sync starts again; changes made meanwhile are sent as soon as Search Cloud answers.', 'webhead-search-cloud' ),
				$tries
			);
		}

		return sprintf(
			/* translators: 1: HTTP status code, 2: number of tries. */
			__( 'Search Cloud returned an error (HTTP %1$d) in %2$d tries, so this sync was stopped. The next scheduled sync starts again; changes made meanwhile are sent as soon as Search Cloud answers.', 'webhead-search-cloud' ),
			$response->status,
			$tries
		);
	}
}
