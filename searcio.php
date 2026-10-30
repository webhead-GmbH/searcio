<?php
/**
 * Plugin Name: Searcio - Fast AI Product Search for WooCommerce
 * Plugin URI: https://wordpress.org/plugins/searcio/
 * Description: Connect WordPress and WooCommerce to Searcio.
 * Version: 1.3.1
 * Author: webhead GmbH
 * Author URI: https://webhead.at
 * Text Domain: searcio
 * Domain Path: /languages
 * Requires at least: 6.8
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

// This plugin's classes and the runtime bundled with it. Composer's autoloader
// is not asked: a release package has no `vendor` directory.
require_once __DIR__ . '/includes/autoload.php';

defined( 'Webhead\WP\SearchCloud\VERSION' ) || define(
	'Webhead\WP\SearchCloud\VERSION',
	'1.3.1'
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
/**
 * The name the framework gives everything after: the hook prefix, the cache
 * group, the asset handles, the admin page. It is the plugin's first slug and
 * stays, whatever folder the plugin is installed in: wordpress.org installs it
 * as `searcio/`, the text domain.
 */
defined( 'Webhead\WP\SearchCloud\PLUGIN_SLUG' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_SLUG',
	'webhead-search-cloud'
);
/**
 * The plugin's slug on wordpress.org, which files its translations under that
 * name. Only the translations follow it: what a site stores, and what the
 * service calls, keep the names of the slug above.
 */
defined( 'Webhead\WP\SearchCloud\TEXT_DOMAIN' ) || define(
	'Webhead\WP\SearchCloud\TEXT_DOMAIN',
	'searcio'
);
defined( 'Webhead\WP\SearchCloud\CACHE_GROUP' )
|| define( 'Webhead\WP\SearchCloud\CACHE_GROUP', 'webhead_search_cloud' );

defined( 'Webhead\WP\SearchCloud\SERVICE_URL' )
|| define( 'Webhead\WP\SearchCloud\SERVICE_URL', 'https://searcio.com' );

/**
 * Linked from the consent checkboxes on the Connection tab until Searcio
 * supplies its own, and whenever it cannot be reached. They are the documents
 * `GET /connect` names, at the address of the service.
 */
defined( 'Webhead\WP\SearchCloud\LEGAL_TERMS_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_TERMS_URL', 'https://searcio.com/impressum' );

defined( 'Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL', 'https://searcio.com/datenschutz' );

defined( 'Webhead\WP\SearchCloud\LEGAL_DPA_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_DPA_URL', 'https://searcio.com/data-processing-agreement' );

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
