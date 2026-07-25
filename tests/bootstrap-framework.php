<?php
/**
 * Shared autoloading for the WordPress-free unit suite.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 * Do not edit it: add your own polyfills and fixtures to tests/bootstrap.php,
 * which requires this file and is yours to change.
 *
 * Two autoloaders matter here. Composer's covers the plugin's own classes and
 * the dev-only test dependencies. The second one covers the framework after
 * Mozart has rewritten it into includes/Dependencies under this plugin's own
 * namespace — it only exists once `composer install` has run, so it is loaded
 * conditionally and a missing file simply means the prefixed classes are not
 * available yet.
 *
 * @author    webhead GmbH <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __DIR__ ) . '/' );
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';

$webhead_search_cloud_prefixed_autoload_file = dirname( __DIR__ ) . '/includes/Dependencies/autoload.php';

if ( is_readable( $webhead_search_cloud_prefixed_autoload_file ) ) {
	require_once $webhead_search_cloud_prefixed_autoload_file;
}

unset( $webhead_search_cloud_prefixed_autoload_file );
