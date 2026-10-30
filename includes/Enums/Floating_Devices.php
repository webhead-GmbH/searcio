<?php
/**
 * On which screens the floating search button is drawn.
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
enum Floating_Devices: string {
	/** Below 782px, the width WordPress itself takes for a phone: for a theme that hides its search there. */
	case Phones = 'phones';

	/** On every screen. */
	case All = 'all';

	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::Phones ) : self::Phones;
	}
}
