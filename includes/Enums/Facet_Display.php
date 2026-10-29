<?php
/**
 * How the search window draws the values of one filter.
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
enum Facet_Display: string {
	/** The storefront decides from the values: tiles for sizes, colours when every value has one, a list otherwise. */
	case Auto = 'auto';

	/** A list of checkboxes. */
	case List = 'list';

	/** Tiles in the values' natural order: clothing sizes, shoe sizes, capacities. */
	case Tiles = 'tiles';

	/** Pills with a colour dot, for a field whose values have colours. */
	case Color = 'color';

	/** Two bounds, for a numeric field. */
	case Range = 'range';

	/**
	 * Anything that is not one of the cases is `auto`: the storefront then
	 * decides, which is what a field nobody set a display for gets.
	 */
	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::Auto ) : self::Auto;
	}
}
