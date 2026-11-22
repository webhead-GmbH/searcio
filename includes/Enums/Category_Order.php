<?php
/**
 * The order the search window's category filter lists the categories in.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.1
 */
enum Category_Order: string {
	/** The order the shop dragged its categories into in WooCommerce. */
	case Shop = 'shop';

	/** By name, as the page's language sorts them. */
	case Name = 'name';

	/** The category with the most results first. */
	case Count = 'count';

	/** Anything that is not one of the cases is the shop's own order. */
	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::Shop ) : self::Shop;
	}
}
