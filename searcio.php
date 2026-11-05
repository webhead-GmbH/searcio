<?php
/**
 * Plugin Name: Searcio - Fast AI Product Search for WooCommerce
 * Plugin URI: https://wordpress.org/plugins/searcio/
 * Description: Connect WordPress and WooCommerce to Searcio.
 * Version: 1.4.0
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
	'1.4.0'
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
 * The name the framework gives everything after: the options, the tables, the
 * capabilities, the hook prefix, the cache group, the REST namespace, the
 * asset handles, the admin page. It is the plugin's slug on wordpress.org, and
 * was `webhead-search-cloud` until 1.4.0 (`Lifecycle\Legacy_Slug` moves what a
 * site stored under that name).
 */
defined( 'Webhead\WP\SearchCloud\PLUGIN_SLUG' ) || define(
	'Webhead\WP\SearchCloud\PLUGIN_SLUG',
	'searcio'
);
/**
 * The text domain, which wordpress.org files the plugin's translations under:
 * the slug.
 */
defined( 'Webhead\WP\SearchCloud\TEXT_DOMAIN' ) || define(
	'Webhead\WP\SearchCloud\TEXT_DOMAIN',
	'searcio'
);
defined( 'Webhead\WP\SearchCloud\CACHE_GROUP' )
|| define( 'Webhead\WP\SearchCloud\CACHE_GROUP', 'searcio' );

defined( 'Webhead\WP\SearchCloud\SERVICE_URL' )
|| define( 'Webhead\WP\SearchCloud\SERVICE_URL', 'https://searcio.com' );

/**
 * Linked from the consent checkboxes on the Connection tab until Searcio
 * supplies its own, and whenever it cannot be reached. They are the documents
 * `GET /connect` names, at the address of the service.
 */
defined( 'Webhead\WP\SearchCloud\LEGAL_TERMS_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_TERMS_URL', 'https://searcio.com/nutzungsbedingungen' );

defined( 'Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_PRIVACY_URL', 'https://searcio.com/datenschutz' );

defined( 'Webhead\WP\SearchCloud\LEGAL_DPA_URL' )
|| define( 'Webhead\WP\SearchCloud\LEGAL_DPA_URL', 'https://searcio.com/data-processing-agreement' );

// What a site stored under the plugin's first slug, moved before anything
// reads it under the new one; on a network, for each site as it is reached.
\Webhead\WP\SearchCloud\Lifecycle\Legacy_Slug::migrate();
add_action( 'switch_blog', [ \Webhead\WP\SearchCloud\Lifecycle\Legacy_Slug::class, 'migrate' ], 0, 0 );

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
	do_action( 'searcio/before_load' );
	do_action_deprecated( 'webhead_search_cloud/before_load', [], '1.4.0', 'searcio/before_load' );

	$plugin = new \Webhead\WP\SearchCloud\Plugin();

	do_action( 'searcio/after_load', $plugin );
	do_action_deprecated( 'webhead_search_cloud/after_load', [ $plugin ], '1.4.0', 'searcio/after_load' );
} );
