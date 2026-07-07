<?php
/**
 * Sync engine identifiers.
 *
 * Central home for the per-post dirty-tracking meta keys, the pruning snapshot
 * option keys, and the cron hooks. The run status / trigger / control vocab
 * lives in dedicated enums ({@see \Webhead\WP\SearchCloud\Enums\Sync_Status},
 * {@see \Webhead\WP\SearchCloud\Enums\Sync_Trigger},
 * {@see \Webhead\WP\SearchCloud\Enums\Sync_Control}).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_Keys {
	/** Per-post dirty-tracking meta (PLAN §5.2). */
	public const META_SYNCED_AT = '_whsc_synced_at';
	public const META_DOC_HASH  = '_whsc_doc_hash';
	public const META_CONFIG_VER = '_whsc_synced_cv';

	/**
	 * Pruning snapshots (PLAN §5.3). `SNAPSHOT` is the set of document ids known
	 * to be in the index after the last completed full run; `SEEN` accumulates the
	 * ids kept during the in-progress run so it stays resumable across ticks.
	 */
	public const OPTION_SNAPSHOT = 'webhead_search_cloud_index_snapshot';
	public const OPTION_SEEN     = 'webhead_search_cloud_sync_seen';

	/** Document ids still pending deletion in the prune phase (resumable). */
	public const OPTION_PRUNE = 'webhead_search_cloud_sync_prune';

	/** Recurring scheduled sync. */
	public const HOOK_SCHEDULED = 'webhead_search_cloud_scheduled_sync';

	/** Resumable, self-rescheduling batch worker. */
	public const HOOK_TICK = 'webhead_search_cloud_sync_tick';

	/** Coalescing drain worker for incremental changes (Phase 4). */
	public const HOOK_DRAIN = 'webhead_search_cloud_change_drain';
}
