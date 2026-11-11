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

use Closure;
use WP_Error;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Cache_Key;
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

	/**
	 * How long a read for the settings screen is kept. What it shows changes
	 * on Searcio's side only when somebody changes it there, and every change
	 * the plugin makes forgets what it changed, so a tab opens without a round
	 * trip to Searcio each time.
	 */
	private const READ_TTL = 10 * MINUTE_IN_SECONDS;

	/** The site's status and this month's usage move with every search: kept shorter. */
	private const HEALTH_TTL = 5 * MINUTE_IN_SECONDS;

	/** The cache group the reads are kept in. */
	private const READS = 'searcio_reads';

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

	/**
	 * `GET /health`: the site, its plan and what it has used. Kept for a few
	 * minutes for the settings screen; Site Health, the daily sync and "Test
	 * connection" ask afresh.
	 */
	public function health( bool $fresh = false ): Api_Response {
		return $this->kept( 'health', self::HEALTH_TTL, fn (): Api_Response => $this->request( 'GET', '/health' ), $fresh );
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
		$response = $this->request( 'POST', '/connect', $payload, authenticated: false );

		$this->forget_reads();

		return $response;
	}

	/**
	 * `DELETE /disconnect` - the mirror of {@see self::connect()}. Permanently
	 * deletes the site and its index on Searcio's side; the caller is
	 * responsible for clearing local credentials once this succeeds (see
	 * docs/api/building-a-plugin.md "Disconnecting").
	 */
	public function disconnect(): Api_Response {
		$response = $this->request( 'DELETE', '/disconnect' );

		$this->forget_reads();

		return $response;
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

		return $this->cache_manager->transients()->remember(
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

	public function get_search_config( bool $fresh = false ): Api_Response {
		return $this->kept( 'search_config', self::READ_TTL, fn (): Api_Response => $this->request( 'GET', '/search-config' ), $fresh );
	}

	/**
	 * @param  array<string,mixed>  $payload  Only the sections being changed; omitted
	 *                                        keys keep their current server-side value.
	 */
	public function update_search_config( array $payload ): Api_Response {
		$response = $this->request( 'PUT', '/search-config', $payload );

		$this->forget( 'search_config' );

		return $response;
	}

	/**
	 * The site's quizzes, drafts included (`docs/api/quiz.md`, "Managing
	 * quizzes from a plugin"): `{ quizzes: [{ id, name, status, lang,
	 * question_count, updated_at }], limit }`.
	 */
	public function list_quizzes( bool $fresh = false ): Api_Response {
		return $this->kept( 'quizzes', self::READ_TTL, fn (): Api_Response => $this->request( 'GET', '/quiz-templates' ), $fresh );
	}

	/**
	 * @param  array<string,mixed>  $quiz  `name`, and optionally `lang`, `status` and `questions`.
	 */
	public function create_quiz( array $quiz ): Api_Response {
		// Asked once: a create that timed out may still have made the quiz,
		// and asking again would make a second one.
		$response = $this->request( 'POST', '/quiz-templates', $quiz, true, false );

		$this->forget( 'quizzes' );

		return $response;
	}

	public function get_quiz( int $id ): Api_Response {
		return $this->request( 'GET', '/quiz-templates/' . $id );
	}

	/**
	 * @param  array<string,mixed>  $changes  Only the keys that change.
	 */
	public function update_quiz( int $id, array $changes ): Api_Response {
		$response = $this->request( 'PUT', '/quiz-templates/' . $id, $changes );

		$this->forget( 'quizzes' );

		return $response;
	}

	public function delete_quiz( int $id ): Api_Response {
		$response = $this->request( 'DELETE', '/quiz-templates/' . $id );

		$this->forget( 'quizzes' );

		return $response;
	}

	/**
	 * The values of every facet field with how many documents carry each, for
	 * answers to tag values that exist.
	 */
	public function quiz_facet_values( bool $fresh = false ): Api_Response {
		return $this->kept( 'quiz_facet_values', self::READ_TTL, fn (): Api_Response => $this->request( 'GET', '/quiz-templates/facet-values' ), $fresh );
	}

	/**
	 * Forgets every kept read, as a new connection does.
	 */
	public function forget_reads(): void {
		$this->cache_manager->invalidate_group( self::READS );
	}

	/**
	 * A read, from where it was kept unless `$fresh` asks for Searcio's answer
	 * now. Only a successful answer is kept, so a failure is asked again next
	 * time.
	 *
	 * @param  Closure(): Api_Response  $read
	 */
	private function kept( string $name, int $ttl, Closure $read, bool $fresh ): Api_Response {
		$key   = $this->read_key( $name );
		$store = $this->cache_manager->transients();

		if ( ! $fresh ) {
			$kept = $store->get( $key );

			if ( is_array( $kept ) && isset( $kept['status'] ) && is_array( $kept['body'] ?? null ) ) {
				return Api_Response::kept( (int) $kept['status'], $kept['body'] );
			}
		}

		$response = $read();

		if ( $response->ok() ) {
			$store->set( $key, [ 'status' => $response->status, 'body' => $response->body ], $ttl );
		}

		return $response;
	}

	private function forget( string $name ): void {
		$this->cache_manager->transients()->delete( $this->read_key( $name ) );
	}

	/**
	 * Named after the write key as well: keys entered anew read afresh.
	 */
	private function read_key( string $name ): Cache_Key {
		return $this->cache_manager->key( $name . '_' . substr( wp_hash( $this->write_key() ), 0, 12 ), self::READS );
	}

	/**
	 * Every way a question graph can end, saved or not, with its product count.
	 * A quiz in one language is offered on that language's pages alone, so its
	 * products are counted in that language (`lang`, which a service before it
	 * ignores).
	 *
	 * @param  array<int,array<string,mixed>>  $questions
	 */
	public function quiz_endings( array $questions, ?string $lang = null ): Api_Response {
		return $this->request( 'POST', '/quiz-templates/endings', [ 'questions' => $questions ] + ( null !== $lang && '' !== $lang ? [ 'lang' => $lang ] : [] ) );
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

	/**
	 * @param  array<string,mixed>|null  $body
	 * @param  bool                      $retry  Whether a failure that may pass is asked again.
	 */
	private function request( string $method, string $path, ?array $body = null, bool $authenticated = true, bool $retry = true ): Api_Response {
		$url = $this->base() . $path;

		// The language of the screen, or of the site, so that what Searcio says
		// back - a field it refuses, for one - can be in it: it answered an
		// English screen in German.
		$headers = [
			'Accept'          => 'application/json',
			'Accept-Language' => str_replace( '_', '-', determine_locale() ),
		];

		if ( $authenticated ) {
			[ $write_key, $write_secret ] = $this->credentials();

			$headers['X-Write-Key']    = $write_key;
			$headers['X-Write-Secret'] = $write_secret;
		}

		// The certificate is always verified, WordPress's default. A development
		// site whose service has a certificate of a local authority says so for
		// its own host with the `http_request_args` filter.
		$args = [
			'method'  => $method,
			'timeout' => self::TIMEOUT,
			'headers' => $headers,
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

			if ( $retry && $result->should_retry() && $attempt < self::MAX_ATTEMPTS ) {
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
