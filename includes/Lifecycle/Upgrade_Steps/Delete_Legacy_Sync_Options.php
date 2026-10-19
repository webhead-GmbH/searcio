<?php
/**
 * Delete legacy sync/onboarding options.
 *
 * An earlier version of the sync and onboarding flow persisted its progress in
 * a spread of standalone options (a product-discovery counter, initial-sync
 * flags, a handful of "last run" timestamps, and a sync interval). The current
 * engine keeps all of that in the `sync_runs` table and
 * {@see \Webhead\WP\SearchCloud\Sync\Sync_Keys}, so nothing reads or writes
 * these keys anymore - they just sit in `wp_options` on sites that were set up
 * under the old flow, where a stale value such as a `discovery_status` stuck on
 * `running` can still be read by curious eyes and mistaken for live state.
 *
 * Options written through the framework settings layer get a sibling
 * `<option>_metadata` row (see `Settings_Manager::set_with_metadata()`), so each
 * key is removed together with that sibling.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Lifecycle\Upgrade_Step;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.3
 */
final class Delete_Legacy_Sync_Options implements Upgrade_Step {
	/**
	 * Base option keys, without their `_metadata` siblings.
	 *
	 * @var string[]
	 */
	public const OPTIONS = [
		'webhead_search_cloud_discovery_status',
		'webhead_search_cloud_discovered_products_count',
		'webhead_search_cloud_queued_products_total',
		'webhead_search_cloud_has_initial_sync_started',
		'webhead_search_cloud_has_initial_sync_completed',
		'webhead_search_cloud_last_full_sync_started_at',
		'webhead_search_cloud_last_full_sync_completed_at',
		'webhead_search_cloud_last_incremental_sync_run_at',
		'webhead_search_cloud_last_sync_at',
		'webhead_search_cloud_last_sync_status',
		'webhead_search_cloud_sync_interval',
	];

	private const METADATA_SUFFIX = '_metadata';

	/**
	 * Kept at the current plugin version: the framework upgrade runner skips
	 * steps declaring a version above the version being upgraded to, so a step
	 * introduced ahead of the plugin header would never run.
	 */
	public function version(): string {
		return '1.0.3';
	}

	public function run(): void {
		self::delete();
	}

	/**
	 * Every option key this step removes, each base key followed by its
	 * framework `_metadata` sibling.
	 *
	 * @return string[]
	 */
	public static function option_keys(): array {
		$keys = [];

		foreach ( self::OPTIONS as $option ) {
			$keys[] = $option;
			$keys[] = $option . self::METADATA_SUFFIX;
		}

		return $keys;
	}

	/**
	 * Deletes from the current site only. Lifecycle state is per-site (the
	 * framework does not opt into network lifecycle state), so on multisite the
	 * upgrade runner already executes inside each blog's context - switching
	 * blogs here would delete other sites' rows off-schedule and let the local
	 * "step completed" marker lie about them.
	 *
	 * Replay-safe: `delete_option()` on a missing key is a no-op.
	 */
	public static function delete(): void {
		foreach ( self::option_keys() as $key ) {
			delete_option( $key );
		}
	}
}
