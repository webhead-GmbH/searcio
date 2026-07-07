<?php
/**
 * Uninstall plugin.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/webhead-search-cloud.php';

$plugin = new \Webhead\WP\SearchCloud\Plugin();

$plugin->uninstall( $plugin->is_active_for_network() );
