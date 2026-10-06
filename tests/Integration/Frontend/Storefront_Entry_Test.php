<?php
/**
 * The storefront bundle, and when a page receives it.
 *
 * A search trigger or a product row is drawn by one webpack entry, printed
 * through the plugin's asset registry by whatever renders the surface. A page
 * that renders none must not register it, and must not pay for the
 * configuration the entry's script is given: reading it is a query, and its
 * labels load the text domain.
 *
 * Needs a build: the tests that look at the registered entry skip without
 * `public/`.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Storefront_Entry_Test extends Integration_Test_Case {
	private const DOMAIN = 'webhead-search-cloud';

	public function set_up(): void {
		parent::set_up();

		// A page of its own: nothing an earlier test rendered is still queued.
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;
	}

	/**
	 * The plugin boots on every front-end page. With no surface on the page,
	 * the entry stays unknown to WordPress, nothing of the plugin is
	 * translated, and nothing of it waits on a hook every page fires.
	 */
	public function test_a_page_without_a_surface_registers_and_translates_nothing(): void {
		global $wp_filter;

		$translated = 0;

		add_filter(
			'gettext_' . self::DOMAIN,
			static function ( string $translation ) use ( &$translated ): string {
				++$translated;

				return $translation;
			}
		);

		new Plugin();

		$this->assertFalse( wp_script_is( $this->handle(), 'registered' ) );
		$this->assertSame( 0, $translated );

		foreach ( [ 'init', 'wp_enqueue_scripts' ] as $hook ) {
			foreach ( $wp_filter[ $hook ]->callbacks ?? [] as $callbacks ) {
				foreach ( $callbacks as $callback ) {
					$object = is_array( $callback['function'] ) ? $callback['function'][0] : null;

					$this->assertNotInstanceOf( Frontend_Config::class, $object, $hook );
				}
			}
		}
	}

	public function test_the_search_block_prints_the_entry_with_its_configuration(): void {
		$this->skip_without_a_build();

		render_block( [ 'blockName' => 'webhead-search-cloud/search', 'attrs' => [], 'innerBlocks' => [], 'innerHTML' => '', 'innerContent' => [] ] );

		$handle = $this->handle();

		$this->assertTrue( wp_script_is( $handle, 'enqueued' ) );
		$this->assertStringContainsString( 'var ' . Frontend_Config::OBJECT_NAME . ' = ', (string) wp_scripts()->get_data( $handle, 'data' ) );

		$styles = $this->plugin()->get_assets()->style_handles( Frontend_Config::ENTRY );

		$this->assertNotSame( [], $styles );

		foreach ( $styles as $style ) {
			$this->assertTrue( wp_style_is( $style, 'enqueued' ), $style );
		}

		// The modal is WordPress's own component, drawn with its stylesheet.
		$this->assertContains( 'wp-components', wp_styles()->registered[ $styles[0] ]->deps );
	}

	/**
	 * A product row with nothing to list prints nothing, and so needs nothing.
	 */
	public function test_a_product_row_that_prints_nothing_does_not_print_the_entry(): void {
		$this->skip_without_a_build();

		$html = render_block( [ 'blockName' => 'webhead-search-cloud/products', 'attrs' => [ 'source' => 'similar' ], 'innerBlocks' => [], 'innerHTML' => '', 'innerContent' => [] ] );

		$this->assertSame( '', trim( $html ) );
		$this->assertFalse( wp_script_is( $this->handle(), 'enqueued' ) );
	}

	private function handle(): string {
		return $this->plugin()->get_assets()->handle( Frontend_Config::ENTRY );
	}

	private function skip_without_a_build(): void {
		if ( ! $this->plugin()->get_assets()->exists( Frontend_Config::ENTRY ) ) {
			$this->markTestSkipped( 'The storefront bundle is not built; run `npm run build`.' );
		}
	}
}
