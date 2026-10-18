<?php
/**
 * The kind of Search Cloud plan the connected account is on.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.3.0
 */
enum Plan_Tier: string {
	case Free = 'free';
	case Paid = 'paid';

	/**
	 * The tier a `/health` body names in `plan.is_free`, or null when it names
	 * none: a body without it says nothing about the plan, and reading it as
	 * paid would let a Free account turn the searcio logo off.
	 *
	 * @param array<string,mixed> $body
	 */
	public static function from_health( array $body ): ?self {
		$plan = $body['plan'] ?? null;

		if ( ! is_array( $plan ) || ! array_key_exists( 'is_free', $plan ) || ! is_bool( $plan['is_free'] ) ) {
			return null;
		}

		return $plan['is_free'] ? self::Free : self::Paid;
	}
}
