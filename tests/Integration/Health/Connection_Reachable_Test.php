<?php
/**
 * What Site Health says of the connection once Searcio has answered.
 *
 * Searcio keeps answering the health check for an account it does not serve,
 * one without an active plan or a suspended one. The check used to say
 * "Searcio is reachable" while every search and sync of the site was refused.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Health;

use Webhead\WP\SearchCloud\Enums\Account_Refusal;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Connection_Reachable_Test extends Integration_Test_Case {
	private const TEST = 'searcio_connection_reachable';

	public function test_a_served_account_is_reachable(): void {
		$this->answer_health( [ 'account' => [ 'served' => true, 'reason' => null ] ] );

		$result = $this->run_check();

		$this->assertSame( 'good', $result['status'] );
		$this->assertSame( 'Searcio is reachable', $result['label'] );
	}

	public function test_an_account_without_an_active_plan_is_critical_and_links_to_a_plan(): void {
		$this->answer_health(
			[
				'account' => [ 'served' => false, 'reason' => 'no_active_plan' ],
				'plan'    => [ 'id' => null, 'is_free' => false, 'upgrade_url' => 'https://searcio.test/acme/billing' ],
			]
		);

		$result = $this->run_check();

		$this->assertSame( 'critical', $result['status'] );
		$this->assertSame( Account_Refusal::NoActivePlan->label(), $result['label'] );
		$this->assertStringContainsString( esc_html( Account_Refusal::NoActivePlan->message() ), $result['description'] );
		$this->assertStringContainsString( 'href="https://searcio.test/acme/billing"', $result['actions'] );
		$this->assertStringContainsString( 'Choose a plan', $result['actions'] );
	}

	/**
	 * The plan's upgrade link leads to the billing page, where an overdue
	 * payment is settled.
	 */
	public function test_an_overdue_payment_is_critical_and_links_to_billing(): void {
		$this->answer_health(
			[
				'account' => [ 'served' => false, 'reason' => 'payment_overdue', 'support_url' => 'https://searcio.test/acme/support' ],
				'plan'    => [ 'id' => 4, 'is_free' => false, 'upgrade_url' => 'https://searcio.test/acme/billing' ],
			]
		);

		$result = $this->run_check();

		$this->assertSame( 'critical', $result['status'] );
		$this->assertSame( Account_Refusal::PaymentOverdue->label(), $result['label'] );
		$this->assertStringContainsString( esc_html( Account_Refusal::PaymentOverdue->message() ), $result['description'] );
		$this->assertStringContainsString( 'href="https://searcio.test/acme/billing"', $result['actions'] );
		$this->assertStringContainsString( 'Go to billing', $result['actions'] );
	}

	public function test_a_suspended_account_is_critical_and_links_to_support(): void {
		$this->answer_health(
			[
				'account' => [ 'served' => false, 'reason' => 'account_suspended', 'support_url' => 'https://searcio.test/acme/support' ],
				'plan'    => [ 'id' => 4, 'is_free' => false, 'upgrade_url' => 'https://searcio.test/acme/billing' ],
			]
		);

		$result = $this->run_check();

		$this->assertSame( 'critical', $result['status'] );
		$this->assertSame( Account_Refusal::Suspended->label(), $result['label'] );
		$this->assertStringContainsString( 'href="https://searcio.test/acme/support"', $result['actions'] );
		$this->assertStringContainsString( 'Contact Searcio support', $result['actions'] );
		$this->assertStringNotContainsString( 'billing', $result['actions'], 'A plan does not lift a suspension.' );
	}

	/** Until the service names its support page, the dashboard is the way there. */
	public function test_support_is_the_dashboard_until_the_service_names_its_page(): void {
		$this->answer_health( [ 'account' => [ 'served' => false, 'reason' => 'account_suspended' ] ] );

		$this->assertStringContainsString(
			'href="' . esc_url( untrailingslashit( \Webhead\WP\SearchCloud\SERVICE_URL ) . '/login' ) . '"',
			$this->run_check()['actions']
		);
	}

	/**
	 * @param  array<string,mixed>  $body  The `/health` body.
	 */
	private function answer_health( array $body ): void {
		$this->connect_client();
		$this->fake_http( fn(): array => $this->http_ok( $body ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function run_check(): array {
		return $this->service( 'site_health_manager' )->run_test( self::TEST );
	}
}
