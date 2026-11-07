<?php
/**
 * The connection to Searcio, opened in the head of a page that will search.
 *
 * The first search of a page view pays for DNS, TCP and TLS before its
 * request leaves (search-cloud #164). A `preconnect` in the head lets the
 * browser open the connection while it reads the page. It is added when the
 * storefront script is already enqueued as WordPress prints its resource
 * hints: a placement on every page (the theme's search, the shortcut, the
 * floating button), and a block or a widget of a block theme, whose templates
 * are drawn before the head. For a block in a classic theme's content, drawn
 * after the head, the storefront script adds the same link as it boots.
 *
 * The storefront fetches with `credentials: 'omit'`, an anonymous CORS
 * request, so the hint says `crossorigin`: without it the browser opens a
 * connection the fetch cannot use.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Resource_Hints {
	/**
	 * @param string $handle  The storefront script's handle.
	 * @param string $service Searcio's address, whose origin the storefront asks.
	 */
	public function __construct(
		private string $handle,
		private string $service
	) {}

	/**
	 * @param mixed $urls     The hints of `$relation`.
	 * @param mixed $relation `preconnect`, `dns-prefetch` and so on.
	 */
	#[Filter( 'wp_resource_hints', accepted_args: 2 )]
	public function preconnect( mixed $urls, mixed $relation = '' ): mixed {
		if ( 'preconnect' !== $relation || ! is_array( $urls ) || ! wp_script_is( $this->handle, 'enqueued' ) ) {
			return $urls;
		}

		$origin = self::origin( $this->service );

		if ( '' === $origin || self::origin( home_url( '/' ) ) === $origin ) {
			return $urls;
		}

		$urls[] = [
			'href'        => $origin,
			'crossorigin' => 'anonymous',
		];

		return $urls;
	}

	/**
	 * `scheme://host[:port]` of `$url`, or '' when it has none.
	 */
	public static function origin( string $url ): string {
		$parts = wp_parse_url( $url );

		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return '';
		}

		return strtolower( $parts['scheme'] . '://' . $parts['host'] ) . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' );
	}
}
