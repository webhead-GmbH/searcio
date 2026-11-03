<?php
/**
 * How the search window's filter lists the shop's categories.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.3.2
 */
enum Category_Filter: string {
	/** Every category in one list, as a search answers with them. */
	case All = 'all';

	/** The main categories alone. */
	case Main = 'main';

	/** The main categories, each with its subcategories under it. */
	case Nested = 'nested';

	/** Anything that is not one of the cases is the list as it always was. */
	public static function from_storage( mixed $value ): self {
		return is_string( $value ) ? ( self::tryFrom( strtolower( trim( $value ) ) ) ?? self::All ) : self::All;
	}
}
