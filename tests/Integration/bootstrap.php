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
 * WooCommerce and Elementor are loaded too when present in the wp-env install,
 * so the WooCommerce-indexing and Elementor-widget suites can exercise real
 * objects. They are optional: a bare `composer`/PHP run without them still boots
 * the suite, and the tests that need them skip themselves when they are absent.
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
// WooCommerce and Elementor are loaded first (when the wp-env install provides
// them) so their classes exist by the time this plugin registers its product
// indexing and Elementor widget on `init`/`elementor/widgets/register`.
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		$whsc_plugin_dir = defined( 'WP_PLUGIN_DIR' ) ? WP_PLUGIN_DIR : dirname( __DIR__, 3 );

		// wp-env names a plugin folder after its source: a zip URL like
		// `woocommerce.latest-stable.zip` becomes `woocommerce.latest-stable/`,
		// not `woocommerce/`, and can nest the real plugin one level deeper. Glob
		// for the main file so discovery survives whatever folder name wp-env
		// (or a manual install) used.
		foreach ( [ 'woocommerce', 'elementor' ] as $whsc_slug ) {
			$whsc_matches = array_merge(
				glob( $whsc_plugin_dir . '/*/' . $whsc_slug . '.php' ) ?: [],
				glob( $whsc_plugin_dir . '/*/*/' . $whsc_slug . '.php' ) ?: []
			);

			foreach ( $whsc_matches as $whsc_main ) {
				if ( is_readable( $whsc_main ) ) {
					require_once $whsc_main;
					break;
				}
			}
		}

		require dirname( __DIR__, 2 ) . '/webhead-search-cloud.php';
	}
);

tests_add_filter(
	'webhead_search_cloud/after_load',
	static function ( $plugin ): void {
		$GLOBALS['whsc_test_plugin'] = $plugin;
	}
);

// Create WooCommerce's own tables once against the test database so product
// objects can be saved and read in the WooCommerce-indexing suite. Runs on
// `setup_theme` — after WooCommerce has loaded (so `WC_Install` exists) but
// before its `init` hook queries those tables, mirroring WooCommerce's own test
// bootstrap. `install()` uses dbDelta (DDL, implicitly committed), so the tables
// survive the per-test transaction rollback; product rows created inside each
// test do not.
tests_add_filter(
	'setup_theme',
	static function (): void {
		if ( class_exists( \WC_Install::class ) ) {
			\WC_Install::install();
		}
	}
);

require $whsc_wp_phpunit_dir . '/includes/bootstrap.php';

// Create the plugin's custom tables (sync_runs, change_queue) and sync
// capabilities/jobs against the freshly installed test database. Idempotent, so
// running it once per suite is enough.
if ( isset( $GLOBALS['whsc_test_plugin'] ) && $GLOBALS['whsc_test_plugin'] instanceof \Webhead\WP\SearchCloud\Plugin ) {
	$GLOBALS['whsc_test_plugin']->activate( false );
}
