<?php
/**
 * Every name the plugin has follows its slug, searcio.
 *
 * The framework names the text domain, the hook prefix, the cache group, the
 * REST namespace and the keys it keeps the installed version under after the
 * slug. Until 1.4.0 only the text domain was searcio; a site that ran an
 * earlier release has its stored names moved by `Lifecycle\Legacy_Slug`, which
 * `Legacy_Slug_Test` covers.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration;

use Webhead\WP\SearchCloud\Plugin;

final class Text_Domain_Test extends Integration_Test_Case {
	public function test_every_name_is_searcio(): void {
		$plugin = $this->plugin();

		$this->assertSame( 'searcio', $plugin->text_domain() );
		$this->assertSame( 'searcio', $plugin->plugin_slug() );
		$this->assertSame( 'searcio', $plugin->hook_prefix() );
		$this->assertSame( 'searcio', $plugin->cache_group() );
		$this->assertContains( 'searcio/v1', rest_get_server()->get_namespaces() );
	}

	/**
	 * The installed version is kept under the slug, where the move of an
	 * earlier release's names puts it.
	 */
	public function test_the_installed_version_is_kept_where_it_was(): void {
		$this->assertSame( 'searcio_lifecycle_state', $this->call( 'get_lifecycle_state_key' ) );
		$this->assertSame( 'searcio_network_activated', $this->call( 'get_network_activation_state_key' ) );
	}

	/**
	 * The German the plugin ships is read from the folder the plugin is in,
	 * under searcio, wherever the plugin is installed.
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
	 * The settings screen, at `page=searcio`, has its script translated under
	 * the text domain.
	 */
	public function test_the_settings_screen_is_translated_under_searcio(): void {
		if ( ! function_exists( 'add_menu_page' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$GLOBALS['wp_scripts'] = null;
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$page = $this->plugin()->get_page_registry()->get( 'searcio' );
		$page->add_page();
		$page->enqueue_scripts( (string) $page->registered_hook_suffix() );

		$translated = array_filter( wp_scripts()->registered, static fn ( \_WP_Dependency $script ): bool => ! empty( $script->textdomain ) && str_starts_with( $script->handle, 'searcio' ) );

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
