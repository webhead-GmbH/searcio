<?php
/**
 * Between-batch control signal for a running sync.
 *
 * The REST control endpoint writes the desired signal; the tick worker reads it
 * fresh between batches and stops cleanly (pause keeps the cursor, cancel resets
 * it). `None` is the resting state.
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
enum Sync_Control: string {
	case None   = '';
	case Pause  = 'pause';
	case Cancel = 'cancel';

	/**
	 * Resolve a stored value, defaulting to {@see self::None} for unknown input.
	 */
	public static function from_storage( ?string $value ): self {
		return self::tryFrom( (string) $value ) ?? self::None;
	}
}
