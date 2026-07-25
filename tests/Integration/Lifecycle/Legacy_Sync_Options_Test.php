<?php
/**
 * Legacy sync/onboarding option cleanup tests.
 *
 * Covers the upgrade step that removes the dead options left in `wp_options` by
 * the pre-`sync_runs` onboarding flow, the uninstall cleanup that catches sites
 * deleted before the step ever ran, and the per-site boundary both rely on.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps\Delete_Legacy_Sync_Options;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Legacy_Sync_Options_Test extends Integration_Test_Case {

	/**
	 * Seed every key the step targets with a value distinguishable from the
	 * `false` a missing option returns.
	 */
	private function seed_legacy_options(): void {
		foreach ( Delete_Legacy_Sync_Options::option_keys() as $key ) {
			update_option( $key, 'legacy-value' );
		}
	}

	public function test_option_keys_cover_each_base_key_and_its_metadata_sibling(): void {
		$keys = Delete_Legacy_Sync_Options::option_keys();

		foreach ( Delete_Legacy_Sync_Options::OPTIONS as $option ) {
			$this->assertContains( $option, $keys );
			$this->assertContains( $option . '_metadata', $keys );
		}

		$this->assertCount( count( Delete_Legacy_Sync_Options::OPTIONS ) * 2, $keys );
	}

	public function test_the_documented_dead_options_are_all_listed(): void {
		// The list the cleanup was written against; a typo here or in the step
		// would silently leave the option on real installs.
		$expected = [
			'webhead_search_cloud_discovery_status',
			'webhead_search_cloud_discovered_products_count',
			'webhead_search_cloud_queued_products_total',
			'webhead_search_cloud_has_initial_sync_started',
			'webhead_search_cloud_has_initial_sync_completed',
			'webhead_search_cloud_last_full_sync_started_at',
			'webhead_search_cloud_last_full_sync_completed_at',
			'webhead_search_cloud_last_incremental_sync_run_at',
			'webhead_search_cloud_last_sync_at',
			'webhead_search_cloud_last_sync_status',
			'webhead_search_cloud_sync_interval',
		];

		$this->assertSame( $expected, Delete_Legacy_Sync_Options::OPTIONS );
	}

	public function test_the_step_deletes_every_legacy_option(): void {
		$this->seed_legacy_options();

		( new Delete_Legacy_Sync_Options() )->run();

		foreach ( Delete_Legacy_Sync_Options::option_keys() as $key ) {
			$this->assertFalse( get_option( $key ), sprintf( 'Option [%s] survived the upgrade step.', $key ) );
		}
	}

	public function test_the_step_is_replay_safe(): void {
		$step = new Delete_Legacy_Sync_Options();

		// Nothing seeded: deleting absent options must not error.
		$step->run();

		$this->seed_legacy_options();
		$step->run();
		$step->run();

		$this->assertFalse( get_option( 'webhead_search_cloud_discovery_status' ) );
	}

	public function test_the_step_leaves_live_options_alone(): void {
		$this->seed_legacy_options();

		// A live plugin option sharing the same prefix, plus the sync engine's
		// own state keys: none of them may be caught by the cleanup.
		update_option( 'webhead_search_cloud_search_key', 'sk_live' );
		update_option( Sync_Keys::OPTION_SNAPSHOT, [ 'post_1' ] );

		( new Delete_Legacy_Sync_Options() )->run();

		$this->assertSame( 'sk_live', get_option( 'webhead_search_cloud_search_key' ) );
		$this->assertSame( [ 'post_1' ], get_option( Sync_Keys::OPTION_SNAPSHOT ) );
	}

	public function test_the_step_is_registered_on_the_upgrade_runner(): void {
		$this->assertArrayHasKey(
			Delete_Legacy_Sync_Options::class,
			$this->plugin()->get_upgrade_runner()->all()
		);
	}

	/**
	 * The step ships at the current plugin version; a version above it would be
	 * filtered out of `pending()` and never run on any site.
	 */
	public function test_the_step_version_is_not_ahead_of_the_plugin(): void {
		$this->assertTrue(
			version_compare( ( new Delete_Legacy_Sync_Options() )->version(), $this->plugin()->plugin_version(), '<=' )
		);
	}

	/**
	 * A site deleted without ever reactivating never runs the upgrade step, so
	 * the opt-in "delete my data" path has to remove these too.
	 */
	public function test_uninstall_cleanup_deletes_the_legacy_options(): void {
		$this->seed_legacy_options();

		$cleanups = $this->plugin()->get_lifecycle_manager()->get_uninstall_manager()->all();

		$this->assertArrayHasKey( 'webhead_search_cloud_legacy_options', $cleanups );

		( $cleanups['webhead_search_cloud_legacy_options']['callback'] )();

		foreach ( Delete_Legacy_Sync_Options::option_keys() as $key ) {
			$this->assertFalse( get_option( $key ), sprintf( 'Option [%s] survived uninstall cleanup.', $key ) );
		}
	}

	/**
	 * The upgrade runner already executes inside each blog's context, so the
	 * step must never switch blogs itself.
	 */
	public function test_the_step_does_not_switch_blogs(): void {
		$switches = 0;
		$spy      = static function () use ( &$switches ): void {
			++$switches;
		};

		add_action( 'switch_blog', $spy );
		( new Delete_Legacy_Sync_Options() )->run();
		remove_action( 'switch_blog', $spy );

		$this->assertSame( 0, $switches );
	}

	/**
	 * The upgrade runner already executes inside each blog's context on
	 * multisite, so the step must stay scoped to the current site.
	 */
	public function test_the_step_only_touches_the_current_site(): void {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires a multisite install.' );
		}

		// WooCommerce (present in the wp-env container) still listens on the
		// deprecated `wpmu_new_blog` action, and `do_action_deprecated()` only
		// raises its notice when something is listening. Dropping those
		// callbacks keeps creating a fixture blog from tripping the suite's
		// deprecation guard; WP_UnitTestCase restores the hooks after the test.
		remove_all_actions( 'wpmu_new_blog' );

		$blog_id = self::factory()->blog->create();

		switch_to_blog( $blog_id );
		update_option( 'webhead_search_cloud_discovery_status', 'running' );
		restore_current_blog();

		$this->seed_legacy_options();

		( new Delete_Legacy_Sync_Options() )->run();

		$this->assertFalse( get_option( 'webhead_search_cloud_discovery_status' ) );

		switch_to_blog( $blog_id );
		$other_site_value = get_option( 'webhead_search_cloud_discovery_status' );
		restore_current_blog();

		$this->assertSame( 'running', $other_site_value );
	}
}
