<?php
/**
 * Base class for the wp-env integration suite.
 *
 * Gives every integration test typed access to the booted plugin container and
 * its sync services, plus small helpers for the things sync tests repeatedly
 * need: a persisted run row, control over the tick cron schedule, faked Search
 * Cloud HTTP responses, and a connected/indexable configuration. Extends
 * `WP_UnitTestCase`, so each test runs inside a rolled-back transaction and the
 * `sync_runs` / `change_queue` tables reset automatically between tests.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration;

use WP_UnitTestCase;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Sync\Sync_State;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;
use Webhead\WP\SearchCloud\Dependencies\League\Container\Container;

abstract class Integration_Test_Case extends WP_UnitTestCase {
	protected function plugin(): Plugin {
		$plugin = $GLOBALS['whsc_test_plugin'] ?? null;

		if ( ! $plugin instanceof Plugin ) {
			$this->fail( 'The plugin was not booted by the integration bootstrap.' );
		}

		return $plugin;
	}

	protected function container(): Container {
		return $this->plugin()->get_container();
	}

	/**
	 * @return mixed
	 */
	protected function service( string $id ) {
		return $this->container()->get( $id );
	}

	protected function sync_service(): Sync_Service {
		return $this->service( 'sync_service' );
	}

	protected function sync_state(): Sync_State {
		return $this->service( 'sync_state' );
	}

	protected function settings(): Settings_Manager {
		return $this->service( Settings_Manager::class );
	}

	/* --------------------------------------------------------------------- */
	/* Fixtures                                                              */
	/* --------------------------------------------------------------------- */

	/**
	 * Persist a fresh run in the running state and return its id.
	 */
	protected function make_running_run( bool $force = false ): int {
		$id = $this->sync_state()->create(
			\Webhead\WP\SearchCloud\Enums\Sync_Trigger::Manual,
			1,
			$force,
			10,
			[ 'phase' => 'index', 'type_index' => 0, 'last_id' => 0 ]
		);

		$this->assertGreaterThan( 0, $id, 'Failed to create a sync run row.' );

		return $id;
	}

	/**
	 * Pretend a tick worker is alive by scheduling the tick cron a few seconds
	 * out (the default) or, with a negative offset, badly overdue to simulate a
	 * cron that stopped firing.
	 */
	protected function schedule_tick( int $offset_seconds = 5 ): void {
		wp_clear_scheduled_hook( Sync_Keys::HOOK_TICK );
		wp_schedule_single_event( time() + $offset_seconds, Sync_Keys::HOOK_TICK );
	}

	protected function clear_tick(): void {
		wp_clear_scheduled_hook( Sync_Keys::HOOK_TICK );
	}

	protected function tick_is_scheduled(): bool {
		return false !== wp_next_scheduled( Sync_Keys::HOOK_TICK );
	}

	/**
	 * Store working credentials so `Search_Cloud_Client::is_configured()` is true.
	 */
	protected function connect_client(): void {
		$this->settings()->set( Plugin_Settings::WRITE_KEY, Plugin_Settings::encrypt_secret( 'test-write-key' ) );
		$this->settings()->set( Plugin_Settings::WRITE_SECRET, Plugin_Settings::encrypt_secret( 'test-write-secret' ) );
	}

	/**
	 * Enable a single post type for indexing so sync has something to do.
	 * `$block` overrides parts of that type's mapping, such as
	 * `include_private`.
	 *
	 * @param  array<string,mixed>  $block
	 */
	protected function enable_indexing( string $post_type = 'post', array $block = [] ): void {
		$this->service( 'index_config' )->save(
			[ $post_type => array_merge( [ 'enabled' => true ], $block ) ]
		);
	}

	/**
	 * Intercept every outbound HTTP request and answer with a canned response so
	 * sync never touches the network. `$handler` receives ( $url, $args ) and
	 * returns a WP HTTP response array.
	 *
	 * @param  callable(string,array<string,mixed>):array<string,mixed>  $handler
	 */
	protected function fake_http( callable $handler ): void {
		add_filter(
			'pre_http_request',
			static function ( $preempt, $args, $url ) use ( $handler ) {
				return $handler( (string) $url, is_array( $args ) ? $args : [] );
			},
			10,
			3
		);
	}

	/**
	 * A 2xx JSON HTTP response array for {@see self::fake_http()}.
	 *
	 * @param  array<string,mixed>  $body
	 * @return array<string,mixed>
	 */
	protected function http_ok( array $body = [], int $status = 200 ): array {
		return [
			'headers'  => [],
			'body'     => (string) wp_json_encode( $body ),
			'response' => [ 'code' => $status, 'message' => 'OK' ],
			'cookies'  => [],
			'filename' => null,
		];
	}
}
