<?php
/**
 * Plugin-specific setup for the wp-env integration suite.
 *
 * This file belongs to the plugin: the scaffolder writes it once and never
 * touches it again. tests/Integration/bootstrap.php requires it before it
 * registers the plugin itself, so what is hooked on `muplugins_loaded` here
 * runs first.
 *
 * The test database is installed from scratch on every run, so WordPress
 * starts with no active plugin. A plugin this one works with has to be loaded
 * by hand, or every test that needs it skips. .wp-env.json installs the
 * plugins named below; add a slug here when you add one there.
 *
 * WooCommerce and Elementor are both optional to this plugin: WooCommerce
 * first, so its classes exist when the product indexer is built, then
 * Elementor, whose registration hook the widgets are named on.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		foreach ( [ 'woocommerce', 'elementor' ] as $slug ) {
			// wp-env names a download after its zip file, so an older
			// .wp-env.json may have put the plugin in `<slug>.latest-stable`.
			foreach ( [ $slug, $slug . '.latest-stable' ] as $directory ) {
				$main_file = WP_PLUGIN_DIR . '/' . $directory . '/' . $slug . '.php';

				if ( is_readable( $main_file ) ) {
					require_once $main_file;

					continue 2;
				}
			}

			echo sprintf( 'Notice: %s is not installed in this wp-env, so the tests that need it will skip.', $slug ) . PHP_EOL;
		}
	}
);

// WooCommerce creates its tables, roles and pages when it is installed, which
// a test database never was. Harmless when WooCommerce is not loaded.
tests_add_filter(
	'setup_theme',
	static function (): void {
		if ( class_exists( 'WC_Install' ) ) {
			WC_Install::install();
		}
	}
);
