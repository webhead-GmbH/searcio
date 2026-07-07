<?php
/**
 * What started a sync run.
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
enum Sync_Trigger: string {
	case Manual      = 'manual';
	case Scheduled   = 'scheduled';
	case Incremental = 'incremental';

	/**
	 * Stored string values (for validating REST filter input).
	 *
	 * @return array<int,string>
	 */
	public static function values(): array {
		return array_map( static fn( self $case ): string => $case->value, self::cases() );
	}
}
