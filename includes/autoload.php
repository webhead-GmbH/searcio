<?php
/**
 * Loads the classes of this plugin and of the runtime bundled with it.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * WordPress loads the plugin through this file and never through Composer's
 * autoloader. A release package holds no `vendor` directory and no
 * `composer.json`, and the plugin runs the same way where it is developed:
 * `vendor/autoload.php` is for the test suites, which load it themselves.
 *
 * The map below is `autoload.psr-4` of composer.json, written out. Change it
 * there and run `composer framework:update`.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

// Prevent direct file access.
defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	static function ( string $class_name ): void {
		// Longest prefix first, the order Composer reads them in.
		$prefixes = [
			'Webhead\\WP\\SearchCloud\\' => [ 'includes' ],
		];

		foreach ( $prefixes as $prefix => $directories ) {
			if ( ! str_starts_with( $class_name, $prefix ) ) {
				continue;
			}

			$relative_path = str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) ) . '.php';

			foreach ( $directories as $directory ) {
				$file = dirname( __DIR__ ) . '/' . $directory . '/' . $relative_path;

				if ( is_file( $file ) ) {
					require_once $file;

					return;
				}
			}
		}
	}
);

// The framework and what it runs on, which `composer install` writes under
// this plugin's own namespace. A checkout that has not installed yet has the
// plugin's classes and nothing they extend.
( static function (): void {
	$bundle = dirname( __DIR__ ) . '/includes/Dependencies';

	if ( is_readable( $bundle . '/autoload.php' ) ) {
		require_once $bundle . '/autoload.php';
	}

	// The framework's helper functions, which are this plugin's own as its
	// classes are: `Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Helpers\arr_get()`.
	// A function is not autoloaded, and the bundle's autoloader loads classes.
	if ( is_readable( $bundle . '/Webhead/WP/Framework/Support/helpers.php' ) ) {
		require_once $bundle . '/Webhead/WP/Framework/Support/helpers.php';
	}
} )();
