<?php
/**
 * Toggle a dummy "connected" state for the upgrade-button E2E test. With
 * credentials stored, `is_configured()` is true, so the settings page localizes
 * `connection.isConnected = true` and the header's upgrade CTA runs its health
 * check (which the test mocks). Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-connection.php set     # store dummy keys
 *   wp eval-file .../tests/e2e/seed-connection.php clear   # remove them
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 * The keys never reach Search Cloud - the test intercepts the health request.
 *
 * @var array<int,string> $args
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_action = isset( $args[0] ) ? (string) $args[0] : 'set';
$whsc_key    = 'webhead_search_cloud_write_key';
$whsc_secret = 'webhead_search_cloud_write_secret';

if ( 'clear' === $whsc_action ) {
	// Restore whatever was there before (a real connection, or empty) and drop
	// the backups.
	update_option( $whsc_key, (string) get_option( $whsc_key . '_e2e_backup', '' ) );
	update_option( $whsc_secret, (string) get_option( $whsc_secret . '_e2e_backup', '' ) );
	delete_option( $whsc_key . '_e2e_backup' );
	delete_option( $whsc_secret . '_e2e_backup' );
} else {
	// Back up the current values once (add_option is a no-op if a backup already
	// exists), then store dummy encrypted keys so is_configured() is true.
	add_option( $whsc_key . '_e2e_backup', (string) get_option( $whsc_key, '' ) );
	add_option( $whsc_secret . '_e2e_backup', (string) get_option( $whsc_secret, '' ) );
	update_option( $whsc_key, \Webhead\WP\SearchCloud\Settings\Plugin_Settings::encrypt_secret( 'wk_e2e_upgrade' ) );
	update_option( $whsc_secret, \Webhead\WP\SearchCloud\Settings\Plugin_Settings::encrypt_secret( 'ws_e2e_upgrade' ) );
}

echo 'OK';
