<?php
/**
 * Incremental change action.
 *
 * What a queued post change should do to the index when the drain job runs:
 * upsert the rebuilt document, or delete it.
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
enum Change_Action: string {
	case Upsert = 'upsert';
	case Delete = 'delete';

	/**
	 * Resolve a stored value, defaulting to {@see self::Upsert} for unknown input.
	 */
	public static function from_storage( ?string $value ): self {
		return self::tryFrom( (string) $value ) ?? self::Upsert;
	}
}
