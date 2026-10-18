<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Plan_Tier;

final class Plan_Tier_Test extends TestCase {
	public function test_a_free_plan_is_free_and_any_other_is_paid(): void {
		$this->assertSame( Plan_Tier::Free, Plan_Tier::from_health( [ 'plan' => [ 'is_free' => true, 'name' => 'Free' ] ] ) );
		$this->assertSame( Plan_Tier::Paid, Plan_Tier::from_health( [ 'plan' => [ 'is_free' => false, 'name' => 'Pro' ] ] ) );
	}

	/**
	 * Reading an answer that says nothing about the plan as a paid one would
	 * let a Free account turn the searcio logo off.
	 *
	 * @dataProvider silent_bodies
	 *
	 * @param array<string,mixed> $body
	 */
	public function test_an_answer_that_names_no_tier_gives_none( array $body ): void {
		$this->assertNull( Plan_Tier::from_health( $body ) );
	}

	/**
	 * @return array<string,array{0:array<string,mixed>}>
	 */
	public static function silent_bodies(): array {
		return [
			'no plan'             => [ [ 'site' => [ 'id' => 1 ] ] ],
			'a plan with no tier' => [ [ 'plan' => [ 'name' => 'Free' ] ] ],
			'a tier as a string'  => [ [ 'plan' => [ 'is_free' => '1' ] ] ],
			'a plan as a string'  => [ [ 'plan' => 'free' ] ],
		];
	}
}
