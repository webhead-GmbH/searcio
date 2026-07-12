<?php
/**
 * Plugin Name: webhead Search Cloud
 * Plugin URI: https://github.com/webhead-GmbH/webhead-search-cloud
 * Description: Connect WordPress and WooCommerce to webhead Search Cloud.
 * Version: 1.0.1
 * Author: webhead GmbH
 * Author URI: https://webhead.at
 * Text Domain: webhead-search-cloud
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 8.3

 * License: GNU General Public License v3.0
 * License URI: http://www.gnu.org/licenses/gpl-3.0.html
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

// Prevent direct file access
defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

$webhead_search_cloud_prefixed_autoload_file = __DIR__ . '/includes/Dependencies/autoload.php';

if ( is_readable( $webhead_search_cloud_prefixed_autoload_file ) ) {
	require_once $webhead_search_cloud_prefixed_autoload_file;
}

defined( 'Webhead\WP\SearchCloud\VERSION' ) || define(
	'Webhead\WP\SearchCloud\VERSION',
	'1.0.1'
);
defined( 'Webhead\WP\SearchCloud\PLUGIN_FILE' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_FILE',
	__FILE__
);
defined( 'Webhead\WP\SearchCloud\PLUGIN_BASE' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_BASE',
	plugin_basename( \Webhead\WP\SearchCloud\PLUGIN_FILE )
);
defined( 'Webhead\WP\SearchCloud\PLUGIN_DIR' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_DIR',
	plugin_dir_path( \Webhead\WP\SearchCloud\PLUGIN_FILE )
);
defined( 'Webhead\WP\SearchCloud\PLUGIN_URL' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_URL',
	plugin_dir_url( \Webhead\WP\SearchCloud\PLUGIN_FILE )
);
defined( 'Webhead\WP\SearchCloud\PLUGIN_SLUG' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_SLUG',
	dirname( \Webhead\WP\SearchCloud\PLUGIN_BASE )
);
defined( 'Webhead\WP\SearchCloud\CACHE_GROUP' )
|| define( 'Webhead\WP\SearchCloud\CACHE_GROUP', 'webhead_search_cloud' );

defined( 'Webhead\WP\SearchCloud\SERVICE_URL' )
|| define( 'Webhead\WP\SearchCloud\SERVICE_URL', 'https://search.webhead.dev' );

register_activation_hook(
	__FILE__,
	static function ( bool $network_wide ): void {
		( new \Webhead\WP\SearchCloud\Plugin() )->activate( $network_wide );
	}
);

register_deactivation_hook(
	__FILE__,
	static function ( bool $network_wide ): void {
		( new \Webhead\WP\SearchCloud\Plugin() )->deactivate( $network_wide );
	}
);

add_action( 'plugins_loaded', static function (): void {
	do_action( 'webhead_search_cloud/before_load' );

	$plugin = new \Webhead\WP\SearchCloud\Plugin();

	do_action( 'webhead_search_cloud/after_load', $plugin );
} );
