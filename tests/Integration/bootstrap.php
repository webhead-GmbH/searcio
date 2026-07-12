<?php
/**
 * PHPUnit bootstrap for the wp-env integration suite.
 *
 * Unlike `tests/bootstrap.php` (fast, DB-free unit tests), this boots a real
 * WordPress + database through the wp-phpunit library so activation, custom
 * tables, cron/jobs, REST endpoints, and multisite timing can be exercised for
 * real. It is meant to run inside the wp-env `tests-cli` container:
 *
 *     npm run test:integration
 *
 * The plugin is loaded on `muplugins_loaded` and its tables are created by
 * running the real activation routine once WordPress has finished loading, so
 * every test starts against the plugin's actual installed schema.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

// Composer autoload: registers the plugin's classes, the PHPUnit Polyfills, and
// wp-phpunit's `__loaded.php`, which exports WP_PHPUNIT__DIR.
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

$whsc_wp_phpunit_dir = getenv( 'WP_PHPUNIT__DIR' );

if ( false === $whsc_wp_phpunit_dir || ! is_dir( $whsc_wp_phpunit_dir ) ) {
	echo 'Error: wp-phpunit was not found. Run `composer install` before the integration suite.' . PHP_EOL;
	exit( 1 );
}

// Point the WordPress test bootstrap at our database/config instead of the
// bundled placeholder.
define( 'WP_TESTS_CONFIG_FILE_PATH', __DIR__ . '/wp-tests-config.php' );

require_once $whsc_wp_phpunit_dir . '/includes/functions.php';

// Load this plugin as a mu-plugin so it is active for every test, and capture
// the booted instance so we can create its tables after WordPress is ready.
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		require dirname( __DIR__, 2 ) . '/webhead-search-cloud.php';
	}
);

tests_add_filter(
	'webhead_search_cloud/after_load',
	static function ( $plugin ): void {
		$GLOBALS['whsc_test_plugin'] = $plugin;
	}
);

require $whsc_wp_phpunit_dir . '/includes/bootstrap.php';

// Create the plugin's custom tables (sync_runs, change_queue) and sync
// capabilities/jobs against the freshly installed test database. Idempotent, so
// running it once per suite is enough.
if ( isset( $GLOBALS['whsc_test_plugin'] ) && $GLOBALS['whsc_test_plugin'] instanceof \Webhead\WP\SearchCloud\Plugin ) {
	$GLOBALS['whsc_test_plugin']->activate( false );
}
