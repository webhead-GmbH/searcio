<?php
/**
 * The settings page loads the Media Library for the quiz editor.
 *
 * The Product finder tab picks a question's picture in the WordPress Media
 * Library, which a page has only once `wp_enqueue_media()` ran on it. Someone
 * who may not upload gets no library, and the editor asks for an address.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Admin;

use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Settings_Page_Test extends Integration_Test_Case {
	public function test_the_page_loads_the_media_library_for_someone_who_may_upload(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$this->assertSame( 1, $this->media_loads_on_the_page() );
	}

	public function test_no_media_library_for_someone_who_may_not_upload(): void {
		$user = self::factory()->user->create( [ 'role' => 'administrator' ] );
		get_userdata( $user )->remove_cap( 'upload_files' );
		wp_set_current_user( $user );
		add_filter( 'map_meta_cap', static fn ( array $caps, string $cap ): array => 'upload_files' === $cap ? [ 'do_not_allow' ] : $caps, 10, 2 );

		$this->assertSame( 0, $this->media_loads_on_the_page() );
	}

	public function test_no_media_library_on_another_admin_page(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$page   = $this->registered_page();
		$before = did_action( 'wp_enqueue_media' );

		$page->enqueue_scripts( 'index.php' );

		$this->assertSame( $before, did_action( 'wp_enqueue_media' ) );
	}

	/**
	 * @return int How many times the page's assets loaded the Media Library.
	 */
	private function media_loads_on_the_page(): int {
		$page   = $this->registered_page();
		$before = did_action( 'wp_enqueue_media' );

		$page->enqueue_scripts( (string) $page->registered_hook_suffix() );

		return did_action( 'wp_enqueue_media' ) - $before;
	}

	private function registered_page(): \Webhead\WP\SearchCloud\Admin\Settings_Page {
		if ( ! function_exists( 'add_menu_page' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$page = $this->service( 'settings_page' );
		$page->add_page();

		return $page;
	}
}
