<?php
/**
 * Shared autoloading for the WordPress-free unit suite.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 * Do not edit it: add your own polyfills and fixtures to tests/bootstrap.php,
 * which requires this file and is yours to change.
 *
 * Two autoloaders matter here. Composer's covers the dev-only test
 * dependencies and the classes of the tests. The plugin's own,
 * includes/autoload.php, is the one WordPress loads the plugin through: it
 * loads the framework after Mozart has rewritten it into
 * includes/Dependencies under this plugin's own namespace, and the
 * framework's helper functions, which are not autoloaded and which Composer
 * does not know under that namespace. The bundle only exists once
 * `composer install` has run, and a missing one simply means the prefixed
 * classes and functions are not available yet.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __DIR__ ) . '/' );
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
require_once dirname( __DIR__ ) . '/includes/autoload.php';
