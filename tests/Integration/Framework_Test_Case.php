<?php
/**
 * Framework-provided base class for the wp-env integration suite.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 * Do not edit it: add your own fixtures and helpers to Integration_Test_Case,
 * which extends this class and is yours to change.
 *
 * Extends WP_UnitTestCase, so every test runs inside a database transaction
 * that is rolled back afterwards. Rows created in a test disappear; schema
 * created during bootstrap does not.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration;

use WP_REST_Request;
use WP_REST_Response;
use WP_UnitTestCase;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Dependencies\League\Container\Container;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

/**
 * @since 1.0.0
 */
abstract class Framework_Test_Case extends WP_UnitTestCase {
	/* --------------------------------------------------------------------- */
	/* Plugin access                                                         */
	/* --------------------------------------------------------------------- */

	protected function plugin(): Plugin {
		$plugin = $GLOBALS['webhead_search_cloud_test_plugin'] ?? null;

		if ( ! $plugin instanceof Plugin ) {
			$this->fail( 'The plugin was not booted by tests/Integration/bootstrap.php.' );
		}

		return $plugin;
	}

	protected function container(): Container {
		return $this->plugin()->get_container();
	}

	/**
	 * Resolve a service from the plugin container.
	 */
	protected function service( string $id ): mixed {
		return $this->container()->get( $id );
	}

	protected function settings(): Settings_Manager {
		return $this->service( Settings_Manager::class );
	}

	/* --------------------------------------------------------------------- */
	/* Current user                                                          */
	/* --------------------------------------------------------------------- */

	/**
	 * Run the rest of the test as a freshly created user with the given role.
	 *
	 * Pass an empty string to act as a logged-out visitor. Returns the new user
	 * id, or 0 when logged out.
	 */
	protected function acting_as( string $role = 'administrator' ): int {
		if ( '' === $role ) {
			wp_set_current_user( 0 );

			return 0;
		}

		$user_id = (int) self::factory()->user->create( [ 'role' => $role ] );
		wp_set_current_user( $user_id );

		return $user_id;
	}

	/* --------------------------------------------------------------------- */
	/* REST                                                                  */
	/* --------------------------------------------------------------------- */

	/**
	 * Dispatch a REST request through the real server, so permission callbacks,
	 * argument validation, and registered schemas all run.
	 *
	 * The route is relative to the REST root, for example
	 * `/webhead-search-cloud/v1/example`.
	 *
	 * @param array<string, mixed> $body Encoded as a JSON body when not empty.
	 */
	protected function rest_request( string $method, string $route, array $body = [] ): WP_REST_Response {
		$request = new WP_REST_Request( strtoupper( $method ), '/' . ltrim( $route, '/' ) );

		if ( [] !== $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( (string) wp_json_encode( $body ) );
		}

		return rest_get_server()->dispatch( $request );
	}

	/* --------------------------------------------------------------------- */
	/* Skips                                                                 */
	/* --------------------------------------------------------------------- */

	/**
	 * The suite runs twice — single site and multisite. Use these when a test's
	 * expectations genuinely differ, instead of branching on is_multisite().
	 */
	protected function skip_if_multisite( string $message = 'This expectation only holds on single-site WordPress.' ): void {
		if ( is_multisite() ) {
			$this->markTestSkipped( $message );
		}
	}

	protected function skip_unless_multisite( string $message = 'This expectation only holds on a multisite network.' ): void {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( $message );
		}
	}

	/**
	 * Skip a test whose subject is still a commented-out example registration.
	 *
	 * The generated Example_* classes are registered in the container but not
	 * with their managers, so their behaviour is inert until you uncomment the
	 * registration in includes/Plugin.php. Guard example-backed tests with this
	 * so a freshly scaffolded plugin stays green and the skip message doubles as
	 * a to-do list.
	 *
	 * @param callable(): bool $check Returns true once the subject is live.
	 */
	protected function skip_unless_registered( callable $check, string $message ): void {
		if ( ! (bool) $check() ) {
			$this->markTestSkipped( $message );
		}
	}
}
