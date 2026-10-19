<?php
/**
 * Uninstall plugin.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/searcio.php';

// In a function of its own: WordPress includes this file inside
// uninstall_plugin(), whose own variable is called $plugin.
( static function (): void {
	$instance = new \Webhead\WP\SearchCloud\Plugin();

	// WordPress deactivates a plugin before it deletes it, so asking whether
	// the plugin is network active here always answers no. The framework
	// records how far activation reached instead, and that record is what
	// decides whether uninstall cleans every site of the network.
	$instance->uninstall( $instance->was_activated_for_network() );
} )();
