<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Account_Refusal;

final class Account_Refusal_Test extends TestCase {
	public function test_its_values_are_the_reasons_the_service_answers_with(): void {
		$this->assertSame( 'no_active_plan', Account_Refusal::NoActivePlan->value );
		$this->assertSame( 'account_suspended', Account_Refusal::Suspended->value );
	}

	public function test_a_refused_call_is_read_from_its_status_and_reason(): void {
		$this->assertSame(
			Account_Refusal::NoActivePlan,
			Account_Refusal::from_response( 402, [ 'message' => 'This account has no active plan.', 'reason' => 'no_active_plan' ] )
		);
		$this->assertSame(
			Account_Refusal::Suspended,
			Account_Refusal::from_response( 403, [ 'message' => 'This account is suspended.', 'reason' => 'account_suspended' ] )
		);
	}

	/**
	 * A 403 without a reason is a disabled site, and a reason on any other
	 * status is not a refusal of the account.
	 *
	 * @dataProvider answers_that_are_no_refusal
	 *
	 * @param array<string,mixed> $body
	 */
	public function test_any_other_answer_is_no_refusal( int $status, array $body ): void {
		$this->assertNull( Account_Refusal::from_response( $status, $body ) );
	}

	/**
	 * @return array<string,array{0:int,1:array<string,mixed>}>
	 */
	public static function answers_that_are_no_refusal(): array {
		return [
			'a disabled site'           => [ 403, [ 'message' => 'This site is disabled.' ] ],
			'a plan limit'              => [ 429, [ 'metric' => 'documents', 'limit' => 100, 'reason' => 'no_active_plan' ] ],
			'a server error'            => [ 500, [ 'reason' => 'account_suspended' ] ],
			'a reason it does not know' => [ 402, [ 'reason' => 'something_else' ] ],
			'a reason as a number'      => [ 402, [ 'reason' => 1 ] ],
			'a success'                 => [ 200, [ 'reason' => 'no_active_plan' ] ],
		];
	}

	public function test_the_health_check_names_the_refusal_in_account(): void {
		$this->assertSame(
			Account_Refusal::NoActivePlan,
			Account_Refusal::from_health( [ 'account' => [ 'served' => false, 'reason' => 'no_active_plan' ] ] )
		);
		$this->assertSame(
			Account_Refusal::Suspended,
			Account_Refusal::from_health( [ 'account' => [ 'served' => false, 'reason' => 'account_suspended' ] ] )
		);
	}

	/**
	 * A service from before the refusal says nothing about the account, and
	 * serves it.
	 *
	 * @dataProvider health_bodies_of_a_served_account
	 *
	 * @param array<string,mixed> $body
	 */
	public function test_a_served_account_is_no_refusal( array $body ): void {
		$this->assertNull( Account_Refusal::from_health( $body ) );
	}

	/**
	 * @return array<string,array{0:array<string,mixed>}>
	 */
	public static function health_bodies_of_a_served_account(): array {
		return [
			'served'                 => [ [ 'account' => [ 'served' => true, 'reason' => null ] ] ],
			'no account'             => [ [ 'site' => [ 'id' => 1 ] ] ],
			'served as a string'     => [ [ 'account' => [ 'served' => 'false', 'reason' => 'no_active_plan' ] ] ],
			'not served, no reason'  => [ [ 'account' => [ 'served' => false, 'reason' => null ] ] ],
			'an account as a string' => [ [ 'account' => 'suspended' ] ],
		];
	}

	public function test_each_refusal_names_what_it_is_and_the_way_back(): void {
		$this->assertStringContainsString( 'no active plan', Account_Refusal::NoActivePlan->label() );
		$this->assertStringContainsString( 'Choose a plan', Account_Refusal::NoActivePlan->message() );
		$this->assertStringContainsString( 'suspended', Account_Refusal::Suspended->label() );
		$this->assertStringContainsString( 'Contact Searcio support', Account_Refusal::Suspended->message() );
	}
}
