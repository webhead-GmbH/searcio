<?php
/**
 * What the plugin does while it boots, which is on every request of the site.
 *
 * `includes/Plugin.php` registers; it does not read. A setting read there is a
 * query on every front-end page, for something only one screen - or, for the
 * uninstall policy, one moment in the plugin's life - ever needs.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Lifecycle\Uninstall_Manager;

final class Boot_Test extends Integration_Test_Case {
	/**
	 * Counted with nothing cached but the options WordPress loads by itself,
	 * and with the uninstall setting never saved: a setting nobody saved is not
	 * in that list, so reading it is a query. A second construction of the
	 * plugin runs the same registration as the first and attaches no hooks.
	 */
	public function test_booting_the_plugin_sends_no_query(): void {
		global $wpdb;

		delete_option( 'webhead_search_cloud_delete_data_on_uninstall' );
		wp_cache_flush();
		wp_load_alloptions();

		$before = $wpdb->num_queries;

		new Plugin();

		$this->assertSame( 0, $wpdb->num_queries - $before, 'The plugin read the database while it booted.' );
	}

	public function test_data_is_kept_on_uninstall_until_the_site_says_otherwise(): void {
		$this->assertSame( Uninstall_Manager::POLICY_KEEP_DATA, $this->plugin()->get_uninstall_manager()->get_policy() );
		$this->assertSame( Uninstall_Manager::POLICY_KEEP_DATA, $this->plugin()->uninstall_policy() );
	}

	public function test_the_uninstall_policy_follows_the_setting_when_it_is_asked_for(): void {
		$this->settings()->set( Plugin_Settings::DELETE_DATA_ON_UNINSTALL, true );

		$this->assertSame( Uninstall_Manager::POLICY_DELETE_DATA, $this->plugin()->uninstall_policy() );

		// Booting again does not pick the setting up: the policy is chosen
		// when a site is cleaned, not when the plugin loads.
		$this->assertSame( Uninstall_Manager::POLICY_KEEP_DATA, ( new Plugin() )->get_uninstall_manager()->get_policy() );
	}

	/**
	 * A table is registered with the Database_Manager once. A second object of
	 * its class would be one the manager never configured.
	 *
	 * @dataProvider table_services
	 */
	public function test_a_table_is_one_object_wherever_it_is_asked_for( string $service ): void {
		$table = $this->service( $service );

		$this->assertSame( $table, $this->service( $service ) );
		$this->assertContains( $table, $this->plugin()->get_database_manager()->tables() );
	}

	/**
	 * @return array<string,array{0:string}>
	 */
	public static function table_services(): array {
		return [
			'sync runs'    => [ 'sync_runs_table' ],
			'change queue' => [ 'change_queue_table' ],
		];
	}
}
