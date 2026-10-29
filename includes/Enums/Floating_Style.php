<?php
/**
 * What the floating search button shows.
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
enum Floating_Style: string {
	/** A round button with the magnifier alone. */
	case Icon = 'icon';

	/** A pill with the magnifier and the word "Search". */
	case Label = 'label';

	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::Icon ) : self::Icon;
	}
}
