<?php
/**
 * HTTP client for the Searcio ingest + health API.
 *
 * Server-side only. Reads connection credentials from the framework
 * Settings_Manager (the single source of truth) and decrypts the write key and
 * secret via Plugin_Settings. Retries transient failures (rate-limit `429` with
 * `Retry-After`, and `5xx`) with a small attempt cap.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Connection;

use WP_Error;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Cache_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Search_Cloud_Client {
	private const MAX_ATTEMPTS    = 3;
	private const TIMEOUT         = 15;
	private const MAX_BACKOFF     = 8;
	private const LEGAL_LINKS_TTL = 6 * HOUR_IN_SECONDS;

	public function __construct(
		private Settings_Manager $settings,
		private Cache_Manager $cache_manager
	) {}

	public function is_configured(): bool {
		[ $write_key, $write_secret ] = $this->credentials();

		return '' !== $write_key && '' !== $write_secret;
	}

	/**
	 * The write key alone, decrypted, for contexts that must never see the
	 * secret half (e.g. the public domain-ownership {@see \Webhead\WP\SearchCloud\Routing\Verify_Endpoint}).
	 */
	public function write_key(): string {
		[ $write_key ] = $this->credentials();

		return $write_key;
	}

	public function health(): Api_Response {
		return $this->request( 'GET', '/health' );
	}

	/**
	 * `POST /connect` - the only endpoint with no key at all (see
	 * docs/api/authentication-and-security.md "Connect credentials"). Uses the
	 * same retry/backoff policy as every other call, just without the
	 * write-key/secret headers.
	 *
	 * @param  array<string,mixed>  $payload
	 */
	public function connect( array $payload ): Api_Response {
		return $this->request( 'POST', '/connect', $payload, authenticated: false );
	}

	/**
	 * `DELETE /disconnect` - the mirror of {@see self::connect()}. Permanently
	 * deletes the site and its index on Searcio's side; the caller is
	 * responsible for clearing local credentials once this succeeds (see
	 * docs/api/building-a-plugin.md "Disconnecting").
	 */
	public function disconnect(): Api_Response {
		return $this->request( 'DELETE', '/disconnect' );
	}

	/**
	 * `GET /connect` - consent-screen metadata (legal-document links), no auth
	 * required. Separate from {@see self::legal_links()} so callers that want
	 * the raw response (status, errors) can still get it.
	 */
	public function connect_metadata(): Api_Response {
		return $this->request( 'GET', '/connect', authenticated: false );
	}

	/**
	 * Cached, always-present shape for the consent checkboxes' links. Falls
	 * back to the plugin's own constants when Searcio is unreachable or
	 * hasn't configured a given document - "fail safe" per
	 * docs/api/authentication-and-security.md "Best practices for integrators".
	 *
	 * @return array{terms:string,privacy:string,dpa:string}
	 */
	public function legal_links(): array {
		$cache_key = $this->cache_manager->key( 'connect_legal_links' );

		return $this->cache_manager->object_cache()->remember(
			$cache_key,
			self::LEGAL_LINKS_TTL,
			function (): array {
				$response = $this->connect_metadata();
				$legal    = $response->ok() ? ( $response->body()['legal'] ?? [] ) : [];
				$legal    = is_array( $legal ) ? $legal : [];

				return [
					'terms'   => $this->legal_url( $legal, 'terms', \Webhead\WP\SearchCloud\LEGAL_TERMS_URL ),
					'privacy' => $this->legal_url( $legal, 'privacy', \Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL ),
					'dpa'     => $this->legal_url( $legal, 'dpa', \Webhead\WP\SearchCloud\LEGAL_DPA_URL ),
				];
			}
		);
	}

	/**
	 * @param  array<string,mixed>  $legal
	 */
	private function legal_url( array $legal, string $key, string $fallback ): string {
		$value = $legal[ $key ] ?? null;

		return is_string( $value ) && '' !== $value ? $value : $fallback;
	}

	/**
	 * @param  array<int,array<string,mixed>>  $documents  1-1000 documents.
	 */
	public function bulk_upsert( array $documents ): Api_Response {
		return $this->request( 'POST', '/documents', [ 'documents' => array_values( $documents ) ] );
	}

	/**
	 * @param  array<string,mixed>  $fields
	 */
	public function upsert( string $id, array $fields ): Api_Response {
		return $this->request( 'PUT', '/documents/' . rawurlencode( $id ), $fields );
	}

	public function delete( string $id ): Api_Response {
		return $this->request( 'DELETE', '/documents/' . rawurlencode( $id ) );
	}

	public function get_search_config(): Api_Response {
		return $this->request( 'GET', '/search-config' );
	}

	/**
	 * @param  array<string,mixed>  $payload  Only the sections being changed; omitted
	 *                                        keys keep their current server-side value.
	 */
	public function update_search_config( array $payload ): Api_Response {
		return $this->request( 'PUT', '/search-config', $payload );
	}

	/**
	 * @return array{0:string,1:string}
	 */
	private function credentials(): array {
		return [
			Plugin_Settings::decrypt_secret( (string) $this->settings->get( Plugin_Settings::WRITE_KEY ) ),
			Plugin_Settings::decrypt_secret( (string) $this->settings->get( Plugin_Settings::WRITE_SECRET ) ),
		];
	}

	/**
	 * The Searcio host comes from a single hard-coded constant, overridable
	 * per environment in wp-config.php. Key-relative - no site id in the path;
	 * the API resolves the site from the write key + secret sent in the request
	 * headers below (see docs/api/README.md "Key-relative endpoints").
	 */
	private function base(): string {
		$host = defined( 'Webhead\WP\SearchCloud\SERVICE_URL' ) ? \Webhead\WP\SearchCloud\SERVICE_URL : '';

		return rtrim( (string) $host, '/' ) . '/api/v1';
	}

	private function is_development(): bool {
		return defined( 'WEBHEAD_SEARCH_CLOUD_DEVELOPMENT' ) && WEBHEAD_SEARCH_CLOUD_DEVELOPMENT;
	}

	/**
	 * @param  array<string,mixed>|null  $body
	 */
	private function request( string $method, string $path, ?array $body = null, bool $authenticated = true ): Api_Response {
		$url = $this->base() . $path;

		$headers = [ 'Accept' => 'application/json' ];

		if ( $authenticated ) {
			[ $write_key, $write_secret ] = $this->credentials();

			$headers['X-Write-Key']    = $write_key;
			$headers['X-Write-Secret'] = $write_secret;
		}

		$args = [
			'method'    => $method,
			'timeout'   => self::TIMEOUT,
			'sslverify' => ! $this->is_development(),
			'headers'   => $headers,
		];

		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = (string) wp_json_encode( $body );
		}

		$attempt = 0;
		$result  = null;

		do {
			$attempt++;
			$response = wp_remote_request( $url, $args );

			if ( $response instanceof WP_Error ) {
				$result = Api_Response::from_transport_error( $response );
			} else {
				$result = Api_Response::from_http( (int) wp_remote_retrieve_response_code( $response ), $response );
			}

			if ( $result->should_retry() && $attempt < self::MAX_ATTEMPTS ) {
				$this->sleep( $attempt, $result->retry_after() );
				continue;
			}

			return $result;
		} while ( $attempt < self::MAX_ATTEMPTS );

		return $result;
	}

	private function sleep( int $attempt, ?int $retry_after = null ): void {
		$seconds = null !== $retry_after ? $retry_after : 2 ** $attempt;

		usleep( (int) min( $seconds, self::MAX_BACKOFF ) * 1_000_000 );
	}
}
