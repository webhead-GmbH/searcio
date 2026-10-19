<?php
/**
 * PHPUnit bootstrap for the wp-env integration suite.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 * Do not edit it. Plugin-specific setup — loading companion plugins, seeding
 * fixtures, registering extra filters — belongs in
 * tests/Integration/bootstrap-extra.php, which this file requires when present.
 *
 * Unlike tests/bootstrap.php, this boots real WordPress and a real database
 * through wp-phpunit, so activation, custom tables, cron, REST endpoints, and
 * multisite timing can be exercised for real. It is meant to run inside the
 * wp-env `tests-cli` container:
 *
 *     npm run test:integration
 *
 * Order matters here. bootstrap-extra.php is loaded before this plugin
 * registers its own `muplugins_loaded` callback, so anything it hooks on that
 * action runs first — that is how you make a companion plugin's classes exist
 * by the time this plugin boots against them.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

// Registers the plugin's classes, PHPUnit Polyfills, and wp-phpunit's
// __loaded.php, which exports WP_PHPUNIT__DIR.
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

$webhead_search_cloud_wp_phpunit_dir = getenv( 'WP_PHPUNIT__DIR' );

if ( false === $webhead_search_cloud_wp_phpunit_dir || ! is_dir( $webhead_search_cloud_wp_phpunit_dir ) ) {
	echo 'Error: wp-phpunit was not found. Run `composer install` before the integration suite.' . PHP_EOL;
	exit( 1 );
}

// Point the WordPress test bootstrap at our database configuration instead of
// the placeholder bundled with wp-phpunit.
define( 'WP_TESTS_CONFIG_FILE_PATH', __DIR__ . '/wp-tests-config.php' );

require_once $webhead_search_cloud_wp_phpunit_dir . '/includes/functions.php';

$webhead_search_cloud_bootstrap_extra = __DIR__ . '/bootstrap-extra.php';

if ( is_readable( $webhead_search_cloud_bootstrap_extra ) ) {
	require_once $webhead_search_cloud_bootstrap_extra;
}

unset( $webhead_search_cloud_bootstrap_extra );

// Load the plugin as a mu-plugin so it is active for every test.
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		require dirname( __DIR__, 2 ) . '/searcio.php';
	}
);

// Capture the booted instance so the suite can reach the container.
tests_add_filter(
	'webhead_search_cloud/after_load',
	static function ( $plugin ): void {
		$GLOBALS['webhead_search_cloud_test_plugin'] = $plugin;
	}
);

require $webhead_search_cloud_wp_phpunit_dir . '/includes/bootstrap.php';

unset( $webhead_search_cloud_wp_phpunit_dir );

// Run the real activation routine once against the freshly installed test
// database, so every test starts against the plugin's actual schema, options,
// and capabilities. Activation is idempotent, so running it once per suite is
// enough, and the DDL it performs survives the per-test transaction rollback.
if ( isset( $GLOBALS['webhead_search_cloud_test_plugin'] ) && $GLOBALS['webhead_search_cloud_test_plugin'] instanceof \Webhead\WP\SearchCloud\Plugin ) {
	$GLOBALS['webhead_search_cloud_test_plugin']->activate( is_multisite() );
}
