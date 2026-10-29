<?php
/**
 * Which bottom corner the floating search button sits in.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
enum Floating_Position: string {
	/** Where a line of text starts: the left, or the right on a right-to-left site. */
	case Start = 'start';

	/** Where a line of text ends, which is where a cart or a chat button usually is not. */
	case End = 'end';

	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::End ) : self::End;
	}
}
