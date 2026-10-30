<?php
/**
 * The site-wide placements of the Placement tab: the site's search forms
 * drawn as Searcio, the search loaded on every page for the ways that need
 * it, a page that links to `#searcio`, and the trigger they open.
 *
 * The tests that look at the enqueued entry skip without a build (`public/`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Frontend\Placement_Preview;
use Webhead\WP\SearchCloud\Frontend\Site_Placement;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Site_Placement_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		// A page of its own: nothing an earlier test rendered is still queued.
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;
	}

	public function tear_down(): void {
		unset( $_GET[ Placement_Preview::QUERY ] );

		parent::tear_down();
	}

	public function test_the_theme_search_form_is_the_themes_while_the_takeover_is_off(): void {
		$html = get_search_form( [ 'echo' => false ] );

		$this->assertStringNotContainsString( 'data-whsc-trigger', $html );
		$this->assertStringContainsString( 'name="s"', $html );
	}

	/**
	 * The form stays beside the box until the storefront has drawn it, so
	 * `?s=` searches WordPress without JavaScript.
	 */
	public function test_the_takeover_draws_a_box_and_keeps_the_form_for_a_visitor_without_javascript(): void {
		$this->config()->save( [ 'takeover' => true, 'search' => [ 'mode' => 'icon', 'placeholder' => 'Find it' ] ] );

		$html = get_search_form( [ 'echo' => false ] );

		$this->assertStringContainsString( 'data-mode="box"', $html );
		$this->assertStringContainsString( 'data-placeholder="Find it"', $html );
		$this->assertMatchesRegularExpression( '/class="webhead-search-cloud-fallback"><form[^>]+role="search"/', $html );
		$this->assertStringContainsString( 'name="s"', $html );
	}

	public function test_the_takeover_loads_the_search_where_it_draws_one(): void {
		$this->skip_without_a_build();
		$this->config()->save( [ 'takeover' => true ] );

		$this->enqueue_scripts();
		$this->assertFalse( wp_script_is( $this->handle(), 'enqueued' ), 'A form takeover alone loads nothing on a page without a form.' );

		get_search_form( [ 'echo' => false ] );
		$this->assertTrue( wp_script_is( $this->handle(), 'enqueued' ) );
	}

	public function test_the_product_search_form_searches_products(): void {
		if ( ! function_exists( 'get_product_search_form' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->config()->save( [ 'takeover' => true ] );

		$this->assertStringContainsString( 'data-type="product"', get_product_search_form( false ) );
	}

	public function test_a_type_the_defaults_name_holds_the_product_search_form_too(): void {
		if ( ! function_exists( 'get_product_search_form' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->config()->save( [ 'takeover' => true, 'search' => [ 'type' => 'post' ] ] );

		$this->assertStringContainsString( 'data-type="post"', get_product_search_form( false ) );
	}

	public function test_the_search_block_becomes_a_box_and_its_button_alone_a_magnifier(): void {
		$this->config()->save( [ 'takeover' => true ] );

		$field = render_block( $this->search_block( [] ) );
		$icon  = render_block( $this->search_block( [ 'buttonPosition' => 'button-only', 'buttonUseIcon' => true ] ) );

		$this->assertStringContainsString( 'data-mode="box"', $field );
		$this->assertStringContainsString( 'wp-block-search', $field, 'The block is kept as the fallback.' );
		$this->assertStringContainsString( 'data-mode="icon"', $icon );
	}

	public function test_the_search_block_is_the_blocks_while_the_takeover_is_off(): void {
		$this->assertStringNotContainsString( 'data-whsc-trigger', render_block( $this->search_block( [] ) ) );
	}

	/**
	 * @dataProvider every_page_modes
	 *
	 * @param  array<string,mixed>  $placement
	 */
	public function test_a_way_that_needs_every_page_loads_the_search_there( array $placement, bool $loads ): void {
		$this->skip_without_a_build();
		$this->config()->save( $placement );

		$this->enqueue_scripts();

		$this->assertSame( $loads, wp_script_is( $this->handle(), 'enqueued' ) );
	}

	/**
	 * @return array<string,array{0:array<string,mixed>,1:bool}>
	 */
	public static function every_page_modes(): array {
		return [
			'nothing on'               => [ [], false ],
			'selectors on, none named' => [ [ 'openers' => true ], false ],
			'selectors on and named'   => [ [ 'openers' => true, 'selectors' => [ '#menu-item-search > a' ] ], true ],
			'named, but off'           => [ [ 'selectors' => [ '#menu-item-search > a' ] ], false ],
			'keyboard shortcut'        => [ [ 'shortcut' => true ], true ],
			'floating button'          => [ [ 'floating' => [ 'enabled' => true ] ], true ],
		];
	}

	public function test_a_page_that_links_to_searcio_loads_the_search(): void {
		$this->skip_without_a_build();

		apply_filters( 'the_content', '<p>Nothing to open the search with.</p>' );
		$this->assertFalse( wp_script_is( $this->handle(), 'enqueued' ) );

		apply_filters( 'wp_nav_menu_items', '<li class="searcio-open"><a href="#searcio">Search</a></li>', (object) [] );
		$this->assertTrue( wp_script_is( $this->handle(), 'enqueued' ) );
	}

	public function test_a_page_that_loads_the_search_ends_with_the_trigger_the_site_wide_ways_open(): void {
		$this->skip_without_a_build();
		$this->plugin()->get_assets()->enqueue( Frontend_Config::ENTRY );

		$html = $this->site_trigger();

		$this->assertStringContainsString( 'data-whsc-site="hidden"', $html );
		$this->assertStringContainsString( 'data-mode="hidden"', $html );
	}

	public function test_the_floating_button_is_the_site_trigger_when_it_is_on(): void {
		$this->skip_without_a_build();
		$this->config()->save( [ 'floating' => [ 'enabled' => true, 'position' => 'start', 'offset' => 72, 'style' => 'label' ] ] );
		$this->plugin()->get_assets()->enqueue( Frontend_Config::ENTRY );

		$html = $this->site_trigger();

		$this->assertStringContainsString( 'data-whsc-site="floating" data-floating="label"', $html );
		$this->assertStringContainsString( 'whsc-trigger--floating whsc-floating--start whsc-floating--phones', $html );
		$this->assertStringContainsString( '--whsc-floating-offset:72px', $html );
	}

	public function test_a_page_that_does_not_load_the_search_ends_without_a_trigger(): void {
		$this->assertSame( '', $this->site_trigger() );
	}

	/**
	 * The Placement tab's preview shows what it was asked for and nothing a
	 * site-wide way would add.
	 */
	public function test_the_preview_is_left_alone(): void {
		$this->config()->save( [ 'takeover' => true ] );
		$_GET[ Placement_Preview::QUERY ] = '1';

		$this->assertStringNotContainsString( 'data-whsc-trigger', get_search_form( [ 'echo' => false ] ) );
	}

	/**
	 * Its searches are the admin's: once the storefront config carries the
	 * flag, they are marked `preview` and left out of the search statistics.
	 */
	public function test_the_preview_marks_its_searches_as_a_preview(): void {
		$this->assertFalse( (bool) apply_filters( 'webhead_search_cloud/storefront/is_preview', false ) );

		$_GET[ Placement_Preview::QUERY ] = '1';

		$this->assertTrue( (bool) apply_filters( 'webhead_search_cloud/storefront/is_preview', false ) );
	}

	public function test_the_storefront_is_told_the_selectors_only_while_they_are_on(): void {
		$this->config()->save( [ 'selectors' => [ '.search-toggle-open' ], 'shortcut' => true ] );
		$this->assertSame( [ 'selectors' => [], 'shortcut' => true ], $this->storefront_placement() );

		$this->config()->save( [ 'openers' => true, 'selectors' => [ '.search-toggle-open' ] ] );
		$this->assertSame( [ 'selectors' => [ '.search-toggle-open' ], 'shortcut' => false ], $this->storefront_placement() );
	}

	/**
	 * What `wp_enqueue_scripts` runs of this plugin. The whole action also
	 * runs Elementor's, which needs a kit the test site does not have.
	 */
	private function enqueue_scripts(): void {
		$this->service( 'site_placement' )->enqueue_on_every_page();
	}

	private function config(): Placement_Config {
		return $this->service( 'placement_config' );
	}

	private function site_trigger(): string {
		/** @var Site_Placement $placement */
		$placement = $this->service( 'site_placement' );

		ob_start();
		$placement->print_site_trigger();

		return (string) ob_get_clean();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function storefront_placement(): array {
		return $this->service( 'frontend_config' )->to_array()['placement'];
	}

	/**
	 * @param  array<string,mixed>  $attrs
	 * @return array<string,mixed>
	 */
	private function search_block( array $attrs ): array {
		return [
			'blockName'    => 'core/search',
			'attrs'        => [ 'label' => 'Search', 'buttonText' => 'Search' ] + $attrs,
			'innerBlocks'  => [],
			'innerHTML'    => '',
			'innerContent' => [],
		];
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
