<?php
/**
 * `POST /connect` request payload (see docs/api/building-a-plugin.md
 * "Zero-friction connect").
 *
 * A pure value object: no WordPress function calls. Callers resolve the
 * WordPress-specific fallbacks (admin email, current user's display name,
 * site name, home URL) before constructing this, so it stays trivial to unit
 * test.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Connection;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Connect_Request {
	private function __construct(
		public readonly string $platform,
		public readonly string $site_name,
		public readonly string $site_url,
		public readonly string $verify_url,
		public readonly string $admin_email,
		public readonly string $admin_name,
		public readonly string $idempotency_key,
		public readonly bool $terms_privacy,
		public readonly bool $dpa,
	) {}

	public static function create(
		string $platform,
		string $site_name,
		string $site_url,
		string $verify_url,
		string $admin_email,
		string $admin_name,
		string $idempotency_key,
		bool $terms_privacy,
		bool $dpa
	): self {
		return new self(
			platform: trim( $platform ),
			site_name: trim( $site_name ),
			site_url: trim( $site_url ),
			verify_url: trim( $verify_url ),
			admin_email: trim( $admin_email ),
			admin_name: trim( $admin_name ),
			idempotency_key: trim( $idempotency_key ),
			terms_privacy: $terms_privacy,
			dpa: $dpa
		);
	}

	/**
	 * `admin_name` and `verify_url` are optional API-side (`admin_name` falls
	 * back to the part of `admin_email` before the `@`; omitting `verify_url`
	 * simply skips the async domain-ownership ping), so empty values are
	 * omitted rather than sent as `""`.
	 *
	 * @return array<string,mixed>
	 */
	public function to_payload(): array {
		$payload = [
			'platform'        => $this->platform,
			'site_name'       => $this->site_name,
			'site_url'        => $this->site_url,
			'admin_email'     => $this->admin_email,
			'idempotency_key' => $this->idempotency_key,
			'consents'        => [
				'terms_privacy' => $this->terms_privacy,
				'dpa'           => $this->dpa,
			],
		];

		if ( '' !== $this->admin_name ) {
			$payload['admin_name'] = $this->admin_name;
		}

		if ( '' !== $this->verify_url ) {
			$payload['verify_url'] = $this->verify_url;
		}

		return $payload;
	}
}
