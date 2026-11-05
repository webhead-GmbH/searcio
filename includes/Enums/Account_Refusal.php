<?php
/**
 * Why Searcio does not serve the connected account.
 *
 * An account without an active plan, and a suspended one, is refused
 * searching, indexing and MCP. A refused call answers `402` or `403` with
 * `{ message, reason }`, and `/health` keeps answering `200` with the same
 * reason in `account`. The value of each case is that `reason`.
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
enum Account_Refusal: string {
	case NoActivePlan = 'no_active_plan';
	case Suspended    = 'account_suspended';

	/**
	 * The refusal a call was answered with, or null when it was not one. A
	 * `403` without a `reason` is a disabled site, which is not this.
	 *
	 * @param array<string,mixed> $body
	 */
	public static function from_response( int $status, array $body ): ?self {
		$reason = $body['reason'] ?? null;

		if ( ! in_array( $status, [ 402, 403 ], true ) || ! is_string( $reason ) ) {
			return null;
		}

		return self::tryFrom( $reason );
	}

	/**
	 * The refusal a `/health` body reports in `account`, or null for an
	 * account that is served and for a body that says nothing about it.
	 *
	 * @param array<string,mixed> $body
	 */
	public static function from_health( array $body ): ?self {
		$account = $body['account'] ?? null;

		if ( ! is_array( $account ) || false !== ( $account['served'] ?? null ) || ! is_string( $account['reason'] ?? null ) ) {
			return null;
		}

		return self::tryFrom( $account['reason'] );
	}

	public function label(): string {
		return match ( $this ) {
			self::NoActivePlan => __( 'Your Searcio account has no active plan', 'searcio' ),
			self::Suspended    => __( 'Your Searcio account is suspended', 'searcio' ),
		};
	}

	/**
	 * What it means for the site and what the owner does about it, for the
	 * sync history and Site Health.
	 */
	public function message(): string {
		return match ( $this ) {
			self::NoActivePlan => __( 'Searcio does not search or index for this site until the account has an active plan. Choose a plan on your Searcio dashboard, then run a sync.', 'searcio' ),
			self::Suspended    => __( 'Searcio does not search or index for this site while the account is suspended. Contact Searcio support to have it restored.', 'searcio' ),
		};
	}
}
