<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Connection;

use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Connection_StateTest extends Integration_Test_Case {
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
}
