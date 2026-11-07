<?php
/**
 * Whether a quiz is shown in the product finder.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * Searcio's own two states for a quiz: a draft is only in the editor, a
 * published quiz is offered to visitors.
 *
 * @since 1.4.0
 */
enum Quiz_Status: string {
	case Draft     = 'draft';
	case Published = 'published';

	/**
	 * @return array<int,string>
	 */
	public static function values(): array {
		return array_map( static fn( self $case ): string => $case->value, self::cases() );
	}
}
