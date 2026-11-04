<?php
/**
 * A site that ran a release before 1.4.0 keeps everything it stored when the
 * plugin's names move from `webhead-search-cloud` to `searcio`.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Namespace_Versions;
use Webhead\WP\SearchCloud\Lifecycle\Legacy_Slug;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Legacy_Slug_Test extends Integration_Test_Case {
	/**
	 * A tests database an earlier release ran in still has its tables, and
	 * renaming one is a statement MySQL commits at once: the test's own rows
	 * would outlive it, the move's lock among them. So they go first, for good.
	 */
	public static function set_up_before_class(): void {
		global $wpdb;

		parent::set_up_before_class();

		foreach ( [ 'sync_runs', 'change_queue' ] as $table ) {
			$wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}webhead_search_cloud_{$table}`" );
		}

		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'webhead\\_search\\_cloud\\_%' OR option_name = 'searcio_slug_moving'" );
		$wpdb->query( 'COMMIT' );
		wp_cache_flush();
	}

	public function set_up(): void {
		parent::set_up();

		delete_option( Legacy_Slug::MARKER );
	}

	public function test_a_site_that_ran_an_earlier_release_keeps_its_settings(): void {
		update_option( 'webhead_search_cloud_search_key', 'sk_live_123' );
		update_option( 'webhead_search_cloud_placement', [ 'shortcut' => true ] );
		set_transient( 'webhead_search_cloud_cache', 'stale' );
		( new Namespace_Versions() )->current( 'webhead_search_cloud' );
		update_option( 'webhead_search_cloud_table_versions', [ 'webhead_search_cloud_sync_runs' => '1.1', 'webhead_search_cloud_change_queue' => '1.0' ] );
		delete_option( 'searcio_search_key' );

		Legacy_Slug::migrate();

		$this->assertSame( 'sk_live_123', get_option( 'searcio_search_key' ) );
		$this->assertSame( [ 'shortcut' => true ], get_option( 'searcio_placement' ) );
		$this->assertFalse( get_option( 'webhead_search_cloud_search_key' ) );
		$this->assertFalse( get_transient( 'webhead_search_cloud_cache' ), 'A cache is not carried over.' );
		$this->assertFalse( get_option( 'webhead_wpf_cache_ns_' . md5( 'site|webhead_search_cloud' ) ), 'Nor is the old cache group.' );
		$this->assertSame( [ 'searcio_sync_runs' => '1.1', 'searcio_change_queue' => '1.0' ], get_option( 'searcio_table_versions' ), 'The tables are not built again.' );
		$this->assertSame( '1', get_option( Legacy_Slug::MARKER ) );
	}

	public function test_the_sites_own_settings_win_over_new_ones(): void {
		update_option( 'webhead_search_cloud_plan_tier', 'paid' );
		update_option( 'searcio_plan_tier', 'free' );

		Legacy_Slug::migrate();

		$this->assertSame( 'paid', get_option( 'searcio_plan_tier' ) );
	}

	public function test_a_role_keeps_what_it_was_granted(): void {
		update_option( 'webhead_search_cloud_x', 1 );
		$editor = get_role( 'editor' );
		$editor->add_cap( 'webhead-search-cloud_run_sync' );
		$user = self::factory()->user->create_and_get( [ 'role' => 'author' ] );
		$user->add_cap( 'webhead-search-cloud_view' );

		Legacy_Slug::migrate();

		$this->assertTrue( get_role( 'editor' )->has_cap( 'searcio_run_sync' ) );
		$this->assertFalse( get_role( 'editor' )->has_cap( 'webhead-search-cloud_run_sync' ) );
		$this->assertTrue( ( new \WP_User( $user->ID ) )->has_cap( 'searcio_view' ) );

		get_role( 'editor' )->remove_cap( 'searcio_run_sync' );
	}

	public function test_a_scheduled_sync_goes_on_under_its_new_name(): void {
		update_option( 'webhead_search_cloud_x', 1 );
		$at = time() + 600;
		wp_schedule_single_event( $at, 'webhead_search_cloud_sync_tick', [ 42 ] );

		Legacy_Slug::migrate();

		$this->assertSame( $at, wp_next_scheduled( 'searcio_sync_tick', [ 42 ] ) );
		$this->assertFalse( wp_next_scheduled( 'webhead_search_cloud_sync_tick', [ 42 ] ) );

		wp_clear_scheduled_hook( 'searcio_sync_tick', [ 42 ] );
	}

	public function test_blocks_and_elementor_data_take_the_new_names(): void {
		update_option( 'webhead_search_cloud_x', 1 );
		$post = self::factory()->post->create( [ 'post_content' => '<!-- wp:webhead-search-cloud/search {"mode":"box"} /-->' . "\n" . '<!-- wp:webhead-search-cloud/products -->x<!-- /wp:webhead-search-cloud/products -->' ] );
		$page = self::factory()->post->create( [ 'post_type' => 'page' ] );
		update_post_meta( $page, '_elementor_data', wp_slash( '[{"elType":"widget","widgetType":"webhead-search-cloud-search","settings":{}}]' ) );
		update_post_meta( $page, '_elementor_css', [ 'old' ] );
		update_option( 'widget_block', [ 4 => [ 'content' => '<!-- wp:webhead-search-cloud/search /-->' ], '_multiwidget' => 1 ] );

		Legacy_Slug::migrate();

		$this->assertSame( '<!-- wp:searcio/search {"mode":"box"} /-->' . "\n" . '<!-- wp:searcio/products -->x<!-- /wp:searcio/products -->', get_post( $post )->post_content );
		$this->assertSame( '[{"elType":"widget","widgetType":"searcio-search","settings":{}}]', get_post_meta( $page, '_elementor_data', true ) );
		$this->assertSame( '', get_post_meta( $page, '_elementor_css', true ), 'Rendered CSS names the old widget, and is written again.' );
		$this->assertSame( '<!-- wp:searcio/search /-->', get_option( 'widget_block' )[4]['content'] );
	}

	public function test_a_site_that_never_ran_an_earlier_release_is_marked_at_once(): void {
		global $wpdb;

		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'webhead\\_search\\_cloud\\_%'" );
		wp_cache_flush();

		Legacy_Slug::migrate();

		$this->assertSame( '1', get_option( Legacy_Slug::MARKER ) );
	}
}
