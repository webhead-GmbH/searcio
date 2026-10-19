<?php
/**
 * Only the translations follow the plugin's slug on wordpress.org.
 *
 * The framework names its text domain, its hook prefix, its cache group and
 * the keys it keeps the installed version under after one slug. The plugin
 * translates under searcio and keeps every other name it had, so a site that
 * updates finds its settings, its sync history and its installed version
 * where they were, and the service finds the REST routes it calls.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration;

use Webhead\WP\SearchCloud\Plugin;

final class Text_Domain_Test extends Integration_Test_Case {
	public function test_only_the_text_domain_is_searcio(): void {
		$plugin = $this->plugin();

		$this->assertSame( 'searcio', $plugin->text_domain() );
		$this->assertSame( 'webhead-search-cloud', $plugin->plugin_slug() );
		$this->assertSame( 'webhead_search_cloud', $plugin->hook_prefix() );
		$this->assertSame( 'webhead_search_cloud', $plugin->cache_group() );
		$this->assertContains( 'webhead-search-cloud/v1', rest_get_server()->get_namespaces() );
	}

	/**
	 * The framework names these after the text domain. Named after searcio,
	 * they would make a site that ran an earlier release look like a new
	 * install.
	 */
	public function test_the_installed_version_is_kept_where_it_was(): void {
		$this->assertSame( 'webhead_search_cloud_lifecycle_state', $this->call( 'get_lifecycle_state_key' ) );
		$this->assertSame( 'webhead_search_cloud_network_activated', $this->call( 'get_network_activation_state_key' ) );
	}

	/**
	 * The German the plugin ships is read from the folder the plugin is in,
	 * under searcio. wordpress.org installs it in a `searcio/` folder, and the
	 * framework would look in one named after the plugin slug.
	 */
	public function test_the_translations_it_ships_load_under_searcio(): void {
		$german = static fn (): string => 'de_DE';

		// Since WordPress 6.7 the plugin only names the folder, and the first
		// string translated under the domain loads the file, in the locale of
		// the request. Unloaded as reloadable, so that load can happen again.
		add_filter( 'determine_locale', $german );
		unload_textdomain( 'searcio', true );

		try {
			$this->plugin()->load_textdomain();

			$this->assertSame( 'Suche von %s (öffnet in einem neuen Tab)', __( 'Search by %s (opens in a new tab)', 'searcio' ) );
		} finally {
			remove_filter( 'determine_locale', $german );
			unload_textdomain( 'searcio', true );
		}
	}

	/**
	 * The settings screen keeps its address, `page=webhead-search-cloud`, and
	 * the framework translates a page's script under its menu slug. Under that
	 * name the screen was English for every language.
	 */
	public function test_the_settings_screen_is_translated_under_searcio(): void {
		if ( ! function_exists( 'add_menu_page' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$GLOBALS['wp_scripts'] = null;
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$page = $this->service( 'settings_page' );
		$page->add_page();
		$page->enqueue_scripts( (string) $page->registered_hook_suffix() );

		$translated = array_filter( wp_scripts()->registered, static fn ( \_WP_Dependency $script ): bool => ! empty( $script->textdomain ) && str_starts_with( $script->handle, 'webhead-search-cloud' ) );

		if ( [] === $translated && ! is_file( \Webhead\WP\SearchCloud\PLUGIN_DIR . 'public/bundle.settings.asset.php' ) ) {
			$this->markTestSkipped( 'The settings screen has not been built: run npm run build.' );
		}

		$this->assertNotEmpty( $translated );

		foreach ( $translated as $script ) {
			$this->assertSame( 'searcio', $script->textdomain, $script->handle );
		}
	}

	private function call( string $method ): string {
		$reflection = new \ReflectionMethod( Plugin::class, $method );
		$reflection->setAccessible( true );

		return $reflection->invoke( $this->plugin() );
	}
}
