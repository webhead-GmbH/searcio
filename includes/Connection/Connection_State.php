<?php
/**
 * Local (WordPress-side) state for the zero-friction connect flow.
 *
 * Owns everything the `/connect` flow persists that isn't itself an ingest
 * credential: the per-site idempotency key required by
 * docs/api/building-a-plugin.md, and the `pending_claim` flag shown on the
 * Connection tab while the owner finishes claiming an existing account by
 * email. Credential storage is delegated to {@see Search_Cloud_Client}, which
 * already owns the encrypt/decrypt round trip for the write key/secret.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Connection;

use Webhead\WP\SearchCloud\Enums\Plan_Tier;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Connection_State {
	public function __construct( private Settings_Manager $settings ) {}

	/**
	 * Generated once and replayed on every retry so a lost response doesn't
	 * cause a duplicate site to be claimed (see the API's idempotency +
	 * duplicate-protection contract).
	 */
	public function idempotency_key(): string {
		$key = (string) $this->settings->get( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY );

		if ( '' !== $key ) {
			return $key;
		}

		$key = wp_generate_uuid4();
		$this->settings->set( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY, $key );

		return $key;
	}

	/**
	 * Open the window in which the public `/verify` route will answer. Called
	 * when this site asks Search Cloud to connect it, because the ownership
	 * ping that follows is the only caller that route exists for.
	 */
	public function open_verification_window(): void {
		$this->settings->set( Plugin_Settings::VERIFICATION_OPENED_AT, time() );
	}

	/**
	 * Whether a connection attempt started recently enough that the ownership
	 * ping could still be arriving.
	 *
	 * The service dispatches that ping two minutes after provisioning and
	 * retries with backoff, so an hour is generous; outside it the route has no
	 * legitimate caller left.
	 */
	public function verification_window_is_open( int $ttl = HOUR_IN_SECONDS ): bool {
		$opened = (int) $this->settings->get( Plugin_Settings::VERIFICATION_OPENED_AT );

		return 0 !== $opened && ( time() - $opened ) < $ttl;
	}

	/**
	 * @return array{pending:bool,email:string}
	 */
	public function pending_claim(): array {
		return [
			'pending' => (bool) $this->settings->get( Plugin_Settings::CONNECT_PENDING_CLAIM ),
			'email'   => (string) $this->settings->get( Plugin_Settings::CONNECT_PENDING_EMAIL ),
		];
	}

	public function set_pending_claim( string $email ): void {
		$this->settings->set( Plugin_Settings::CONNECT_PENDING_CLAIM, true );
		$this->settings->set( Plugin_Settings::CONNECT_PENDING_EMAIL, $email );
	}

	public function clear_pending_claim(): void {
		$this->settings->set( Plugin_Settings::CONNECT_PENDING_CLAIM, false );
		$this->settings->set( Plugin_Settings::CONNECT_PENDING_EMAIL, '' );
	}

	/**
	 * Saves the credentials `/connect` (or a manual paste) issued and clears
	 * any pending-claim notice — a saved, working credential set supersedes it.
	 */
	public function save_credentials( string $write_key, string $write_secret, string $search_key ): void {
		$this->settings->set( Plugin_Settings::WRITE_KEY, $write_key );
		$this->settings->set( Plugin_Settings::WRITE_SECRET, $write_secret );
		$this->settings->set( Plugin_Settings::SEARCH_KEY, $search_key );
		$this->clear_pending_claim();
	}

	/**
	 * Clears local credentials and pending-claim state and regenerates the
	 * idempotency key so a subsequent `/connect` isn't rejected as a replay of
	 * the disconnected attempt. Never touches the Search Cloud account itself.
	 */
	public function disconnect(): void {
		$this->settings->set( Plugin_Settings::WRITE_KEY, '' );
		$this->settings->set( Plugin_Settings::WRITE_SECRET, '' );
		$this->settings->set( Plugin_Settings::SEARCH_KEY, '' );
		$this->clear_pending_claim();
		$this->settings->set( Plugin_Settings::CONNECT_IDEMPOTENCY_KEY, '' );
		$this->settings->set( Plugin_Settings::PLAN_TIER, '' );
	}

	/**
	 * The plan tier last seen, or null when none has been seen since the site
	 * connected.
	 */
	public function plan_tier(): ?Plan_Tier {
		return Plan_Tier::tryFrom( (string) $this->settings->get( Plugin_Settings::PLAN_TIER ) );
	}

	/**
	 * Keeps the tier a `/health` answer names. An answer that failed, or names
	 * no tier, leaves the one already kept.
	 */
	public function remember_plan( Api_Response $health ): void {
		if ( $health->transport_error || ! $health->ok() ) {
			return;
		}

		$tier = Plan_Tier::from_health( $health->body() );

		if ( null !== $tier ) {
			$this->settings->set( Plugin_Settings::PLAN_TIER, $tier->value );
		}
	}
}
