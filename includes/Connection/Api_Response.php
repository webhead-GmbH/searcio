<?php
/**
 * Normalized Searcio API response.
 *
 * Wraps a wp_remote_request result so callers can branch on the two `429`
 * kinds (transient rate-limit with `Retry-After` vs. non-transient plan limit
 * carrying `{ metric, limit }`) and on transport failures.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Connection;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Api_Response {
	/**
	 * @param  array<string,mixed>  $body
	 */
	private function __construct(
		public readonly int $status,
		public readonly array $body,
		public readonly ?int $retry_after = null,
		public readonly bool $transport_error = false,
		public readonly string $error_message = '',
	) {}

	/**
	 * @param  array<string,mixed>|\WP_HTTP_Response|array  $response  wp_remote_request result.
	 */
	public static function from_http( int $status, mixed $response ): self {
		$raw  = wp_remote_retrieve_body( $response );
		$body = json_decode( is_string( $raw ) ? $raw : '', true );
		$body = is_array( $body ) ? $body : [];

		$retry_after_header = wp_remote_retrieve_header( $response, 'retry-after' );
		$retry_after        = is_numeric( $retry_after_header ) ? (int) $retry_after_header : null;

		return new self( $status, $body, $retry_after );
	}

	public static function from_transport_error( WP_Error $error ): self {
		return new self( 0, [], null, true, $error->get_error_message() );
	}

	public function ok(): bool {
		return $this->status >= 200 && $this->status < 300;
	}

	/**
	 * A plan-limit 429 carries `{ metric, limit }` and is not transient.
	 */
	public function is_plan_limit(): bool {
		return 429 === $this->status && isset( $this->body['metric'] );
	}

	public function should_retry(): bool {
		if ( $this->transport_error ) {
			return true;
		}

		if ( 429 === $this->status ) {
			return ! $this->is_plan_limit();
		}

		return $this->status >= 500;
	}

	public function retry_after(): ?int {
		return $this->retry_after;
	}

	/**
	 * @return array<string,mixed>
	 */
	public function body(): array {
		return $this->body;
	}
}
