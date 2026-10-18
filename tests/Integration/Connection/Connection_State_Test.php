<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Connection;

use Webhead\WP\SearchCloud\Connection\Api_Response;
use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Enums\Plan_Tier;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Connection_State_Test extends Integration_Test_Case {
	private function state(): Connection_State {
		return $this->service( 'connection_state' );
	}

	public function test_idempotency_key_is_generated_once_and_replayed_on_subsequent_calls(): void {
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY ) );

		$first  = $this->state()->idempotency_key();
		$second = $this->state()->idempotency_key();

		$this->assertNotSame( '', $first );
		$this->assertSame( $first, $second );
		$this->assertSame( $first, $this->settings()->get( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY ) );
	}

	public function test_pending_claim_defaults_to_not_pending(): void {
		$this->assertSame( [ 'pending' => false, 'email' => '' ], $this->state()->pending_claim() );
	}

	public function test_set_pending_claim_persists_the_flag_and_email(): void {
		$this->state()->set_pending_claim( 'owner@example.com' );

		$this->assertSame(
			[ 'pending' => true, 'email' => 'owner@example.com' ],
			$this->state()->pending_claim()
		);
	}

	public function test_clear_pending_claim_resets_both_fields(): void {
		$this->state()->set_pending_claim( 'owner@example.com' );
		$this->state()->clear_pending_claim();

		$this->assertSame( [ 'pending' => false, 'email' => '' ], $this->state()->pending_claim() );
	}

	public function test_save_credentials_stores_encrypted_keys_and_clears_a_pending_claim(): void {
		$this->state()->set_pending_claim( 'owner@example.com' );

		$this->state()->save_credentials( 'wk_new', 'secret_new', 'sk_new' );

		$this->assertSame( 'wk_new', Plugin_Settings::decrypt_secret( (string) $this->settings()->get( Plugin_Settings::WRITE_KEY ) ) );
		$this->assertSame( 'secret_new', Plugin_Settings::decrypt_secret( (string) $this->settings()->get( Plugin_Settings::WRITE_SECRET ) ) );
		$this->assertSame( 'sk_new', $this->settings()->get( Plugin_Settings::SEARCH_KEY ) );
		$this->assertSame( [ 'pending' => false, 'email' => '' ], $this->state()->pending_claim() );
	}

	public function test_disconnect_clears_credentials_pending_claim_and_regenerates_the_idempotency_key(): void {
		$this->connect_client();
		$this->settings()->set( Plugin_Settings::SEARCH_KEY, 'sk_existing' );
		$this->state()->set_pending_claim( 'owner@example.com' );
		$original_key = $this->state()->idempotency_key();

		$this->state()->disconnect();

		$this->assertSame( '', $this->settings()->get( Plugin_Settings::WRITE_KEY ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::WRITE_SECRET ) );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::SEARCH_KEY ) );
		$this->assertSame( [ 'pending' => false, 'email' => '' ], $this->state()->pending_claim() );

		$new_key = $this->state()->idempotency_key();
		$this->assertNotSame( '', $new_key );
		$this->assertNotSame( $original_key, $new_key );
	}

	public function test_no_plan_tier_is_known_until_search_cloud_names_one(): void {
		$this->assertNull( $this->state()->plan_tier() );
	}

	public function test_the_tier_a_health_check_names_is_kept(): void {
		$this->state()->remember_plan( $this->health( [ 'plan' => [ 'is_free' => true ] ] ) );
		$this->assertSame( Plan_Tier::Free, $this->state()->plan_tier() );

		$this->state()->remember_plan( $this->health( [ 'plan' => [ 'is_free' => false ] ] ) );
		$this->assertSame( Plan_Tier::Paid, $this->state()->plan_tier() );
	}

	/**
	 * A check that failed, or that says nothing about the plan, is no reason
	 * to forget the tier: a Free account would lose its logo to an outage.
	 */
	public function test_a_health_check_that_names_no_tier_keeps_the_one_kept(): void {
		$this->state()->remember_plan( $this->health( [ 'plan' => [ 'is_free' => true ] ] ) );

		$this->state()->remember_plan( $this->health( [ 'site' => [ 'id' => 1 ] ] ) );
		$this->state()->remember_plan( $this->health( [ 'message' => 'Unavailable.' ], 503 ) );
		$this->state()->remember_plan( Api_Response::from_transport_error( new \WP_Error( 'http_request_failed', 'Could not resolve host.' ) ) );

		$this->assertSame( Plan_Tier::Free, $this->state()->plan_tier() );
	}

	public function test_disconnecting_forgets_the_tier(): void {
		$this->state()->remember_plan( $this->health( [ 'plan' => [ 'is_free' => false ] ] ) );

		$this->state()->disconnect();

		$this->assertNull( $this->state()->plan_tier() );
	}

	/**
	 * @param array<string,mixed> $body
	 */
	private function health( array $body, int $status = 200 ): Api_Response {
		return Api_Response::from_http( $status, $this->http_ok( $body, $status ) );
	}
}
