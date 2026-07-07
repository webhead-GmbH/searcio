<?php
/**
 * PHPUnit bootstrap.
 *
 * These are pure-PHP unit tests for plugin classes that do not need a full
 * WordPress + database environment (see `.agents/skills/webhead-plugin-testing`
 * for the unit vs. wp-env-integration split). A handful of WordPress
 * functions are polyfilled here rather than loading all of WordPress, so the
 * suite stays fast and DB-free. Activation/upgrade/multisite/REST behavior
 * belongs in wp-env integration tests, not here.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

define( 'ABSPATH', __DIR__ . '/' );

if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) {
		return $text;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, $options = 0, $depth = 512 ) {
		return json_encode( $data, $options, $depth );
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $text ) {
		return trim( strip_tags( (string) $text ) );
	}
}

if ( ! function_exists( 'get_the_title' ) ) {
	function get_the_title( $post = null ) {
		return is_object( $post ) && isset( $post->post_title ) ? (string) $post->post_title : '';
	}
}

if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
	function wp_remote_retrieve_body( $response ) {
		return is_array( $response ) && isset( $response['body'] ) ? $response['body'] : '';
	}
}

if ( ! function_exists( 'wp_remote_retrieve_header' ) ) {
	function wp_remote_retrieve_header( $response, $header ) {
		if ( ! is_array( $response ) || ! isset( $response['headers'] ) || ! is_array( $response['headers'] ) ) {
			return '';
		}

		foreach ( $response['headers'] as $key => $value ) {
			if ( 0 === strcasecmp( (string) $key, $header ) ) {
				return $value;
			}
		}

		return '';
	}
}

/**
 * Minimal fakes for the handful of WordPress runtime functions exercised by
 * pure-logic classes under test (`Dirty_Tracker`, `Multilingual_Support`).
 * Backed by `$GLOBALS['wp_test_state']` so each test can set up exactly the
 * state it needs and tear it down afterwards — see
 * `Webhead\WP\SearchCloud\Tests\Unit\Resets_Wp_Test_State`.
 */
$GLOBALS['wp_test_state'] = [
	'post_meta'         => [],
	'post_types'        => [],
	'filters'           => [],
	'pll_languages'     => [],
	'pll_post_language' => [],
	'pll_active'        => false,
];

if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( $post_id, $key = '', $single = false ) {
		$value = $GLOBALS['wp_test_state']['post_meta'][ $post_id ][ $key ] ?? null;

		if ( null === $value ) {
			return $single ? '' : [];
		}

		return $single ? $value : [ $value ];
	}
}

if ( ! function_exists( 'update_post_meta' ) ) {
	function update_post_meta( $post_id, $key, $value ) {
		$GLOBALS['wp_test_state']['post_meta'][ $post_id ][ $key ] = $value;

		return true;
	}
}

if ( ! function_exists( 'delete_post_meta' ) ) {
	function delete_post_meta( $post_id, $key ) {
		unset( $GLOBALS['wp_test_state']['post_meta'][ $post_id ][ $key ] );

		return true;
	}
}

if ( ! function_exists( 'get_post_type' ) ) {
	function get_post_type( $post_id = 0 ) {
		return $GLOBALS['wp_test_state']['post_types'][ $post_id ] ?? false;
	}
}

if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( $tag, $callback, $priority = 10, $accepted_args = 1 ) {
		$GLOBALS['wp_test_state']['filters'][ $tag ] = $callback;

		return true;
	}
}

if ( ! function_exists( 'has_filter' ) ) {
	function has_filter( $tag, $callback = false ) {
		return array_key_exists( $tag, $GLOBALS['wp_test_state']['filters'] );
	}
}

if ( ! function_exists( 'PLL' ) ) {
	/**
	 * Polylang's own global accessor — `Polylang_Integration::is_active()`
	 * checks `function_exists('PLL') && null !== PLL()`.
	 */
	function PLL() {
		return ( $GLOBALS['wp_test_state']['pll_active'] ?? false ) ? new stdClass() : null;
	}
}

if ( ! function_exists( 'remove_all_filters' ) ) {
	function remove_all_filters( $tag = null ) {
		if ( null === $tag ) {
			$GLOBALS['wp_test_state']['filters'] = [];

			return true;
		}

		unset( $GLOBALS['wp_test_state']['filters'][ $tag ] );

		return true;
	}
}

if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $tag, $value, ...$args ) {
		$callback = $GLOBALS['wp_test_state']['filters'][ $tag ] ?? null;

		return null !== $callback ? $callback( $value, ...$args ) : $value;
	}
}

if ( ! function_exists( 'pll_languages_list' ) ) {
	function pll_languages_list( $args = [] ) {
		return $GLOBALS['wp_test_state']['pll_languages'];
	}
}

if ( ! function_exists( 'pll_get_post_language' ) ) {
	function pll_get_post_language( $post_id, $field = 'slug' ) {
		return $GLOBALS['wp_test_state']['pll_post_language'][ $post_id ] ?? false;
	}
}

if ( ! class_exists( 'WP_Post' ) ) {
	/**
	 * Minimal stand-in for WordPress core's `WP_Post` — this bootstrap never
	 * loads `wp-includes`, so only the public properties the plugin's own
	 * code actually reads are provided.
	 */
	class WP_Post {
		public int $ID;
		public string $post_type;
		public string $post_status;
		public string $post_title;

		/**
		 * @param  array<string,mixed>  $data
		 */
		public function __construct( array $data = [] ) {
			$this->ID          = (int) ( $data['ID'] ?? 0 );
			$this->post_type   = (string) ( $data['post_type'] ?? 'post' );
			$this->post_status = (string) ( $data['post_status'] ?? 'publish' );
			$this->post_title  = (string) ( $data['post_title'] ?? '' );
		}
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	/**
	 * Minimal stand-in for WordPress core's `WP_Error` — only the single
	 * accessor `Api_Response::from_transport_error()` actually calls.
	 */
	class WP_Error {
		public function __construct( private string $code = '', private string $message = '' ) {}

		public function get_error_message(): string {
			return $this->message;
		}

		public function get_error_code(): string {
			return $this->code;
		}
	}
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';

$webhead_search_cloud_prefixed_autoload_file = dirname( __DIR__ ) . '/includes/Dependencies/autoload.php';

if ( is_readable( $webhead_search_cloud_prefixed_autoload_file ) ) {
	require_once $webhead_search_cloud_prefixed_autoload_file;
}
