<?php
/**
 * Sync run status.
 *
 * Backed string enum so the lifecycle states are type-safe in PHP while storing
 * and exposing their stable string values in the database and REST payloads.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
enum Sync_Status: string {
	case Queued    = 'queued';
	case Running   = 'running';
	case Paused    = 'paused';
	case Completed = 'completed';
	case Failed    = 'failed';
	case Cancelled = 'cancelled';

	/**
	 * An active run is one that occupies the single live slot (at most one per
	 * site): it is still queued, running, or paused.
	 */
	public function is_active(): bool {
		return in_array( $this, [ self::Queued, self::Running, self::Paused ], true );
	}

	public function is_finished(): bool {
		return ! $this->is_active();
	}

	/**
	 * Stored string values of the active statuses (for `WHERE status IN (...)`).
	 *
	 * @return array<int,string>
	 */
	public static function active_values(): array {
		return [ self::Queued->value, self::Running->value, self::Paused->value ];
	}

	/**
	 * Stored string values of the finished statuses.
	 *
	 * @return array<int,string>
	 */
	public static function finished_values(): array {
		return [ self::Completed->value, self::Failed->value, self::Cancelled->value ];
	}
}
