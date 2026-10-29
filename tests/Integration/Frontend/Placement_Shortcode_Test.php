<?php
/**
 * `[searcio]` and `[searcio_products]`: drawn with the Placement tab's
 * defaults, changed by their attributes, loading the search as they are
 * drawn, and drawn wherever WordPress runs shortcodes.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Placement_Shortcode_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;
	}

	public function test_both_shortcodes_are_registered(): void {
		$this->assertTrue( shortcode_exists( 'searcio' ) );
		$this->assertTrue( shortcode_exists( 'searcio_products' ) );
	}

	public function test_a_bare_shortcode_takes_the_placement_tabs_defaults(): void {
		$this->config()->save( [ 'search' => [ 'mode' => 'box', 'placeholder' => 'Search the shop', 'filters' => 3, 'align' => 'center' ] ] );

		$html = do_shortcode( '[searcio]' );

		$this->assertStringContainsString( 'webhead-search-cloud-placement--center', $html );
		$this->assertStringContainsString( 'data-mode="box"', $html );
		$this->assertStringContainsString( 'data-placeholder="Search the shop"', $html );
		$this->assertStringContainsString( 'data-facet-bar-limit="3"', $html );
		$this->assertStringContainsString( 'whsc-trigger--box', $html );
	}

	public function test_attributes_change_what_they_name_and_nothing_else(): void {
		$this->config()->save( [ 'search' => [ 'mode' => 'box', 'placeholder' => 'Search the shop' ] ] );

		$html = do_shortcode( '[searcio mode="icon" voice="yes" type="product" count="no"]' );

		$this->assertStringContainsString( 'data-mode="icon"', $html );
		$this->assertStringContainsString( 'data-voice="1"', $html );
		$this->assertStringContainsString( 'data-type="product"', $html );
		$this->assertStringContainsString( 'data-show-count="0"', $html );
		$this->assertStringContainsString( 'data-placeholder="Search the shop"', $html );
	}

	public function test_an_attribute_it_cannot_read_takes_the_default(): void {
		$this->config()->save( [ 'search' => [ 'animation' => 'zoom' ] ] );

		$this->assertStringContainsString( 'data-animation="zoom"', do_shortcode( '[searcio animation="explode" filters="lots"]' ) );
	}

	public function test_a_width_and_colours_are_set_on_the_trigger_alone(): void {
		$html = do_shortcode( '[searcio mode="box" width="288" accent="#123abc" class="my-search two"]' );

		$this->assertMatchesRegularExpression( '/<style>\.whsc-instance-p[0-9a-f]{8}\{[^}]*--whsc-accent:#123abc[^}]*--whsc-trigger-box-width:288px/', $html );
		$this->assertStringContainsString( 'whsc-trigger--box my-search two', $html );
	}

	public function test_the_shortcode_loads_the_search_as_it_is_drawn(): void {
		if ( ! $this->plugin()->get_assets()->exists( Frontend_Config::ENTRY ) ) {
			$this->markTestSkipped( 'The storefront bundle is not built; run `npm run build`.' );
		}

		do_shortcode( '[searcio]' );

		$this->assertTrue( wp_script_is( $this->plugin()->get_assets()->handle( Frontend_Config::ENTRY ), 'enqueued' ) );
	}

	/**
	 * Shortcodes run in a classic Text widget since WordPress 4.9.
	 */
	public function test_a_classic_text_widget_draws_it(): void {
		ob_start();
		the_widget( 'WP_Widget_Text', [ 'text' => '[searcio]', 'filter' => true, 'visual' => true ] );
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'data-whsc-trigger', $html );
	}

	/**
	 * Elementor keeps an element's output for a day; one that holds a
	 * shortcode the framework registered is run on every visit instead, so
	 * its script is printed every time.
	 */
	public function test_elementor_runs_an_element_that_holds_it_on_every_visit(): void {
		$manager = $this->service( 'shortcode_manager' );

		$this->assertTrue( $manager->is_dynamic_elementor_content( false, [ 'settings' => [ 'editor' => '<p>[searcio mode="box"]</p>' ] ] ) );
		$this->assertTrue( $manager->is_dynamic_elementor_content( false, [ 'settings' => [ 'shortcode' => '[searcio_products]' ] ] ) );
		$this->assertFalse( $manager->is_dynamic_elementor_content( false, [ 'settings' => [ 'editor' => '[searcio-other]' ] ] ) );
	}

	public function test_a_product_row_without_a_product_or_a_category_prints_nothing(): void {
		$this->assertSame( '', do_shortcode( '[searcio_products]' ) );
		$this->assertSame( '', do_shortcode( '[searcio_products source="category"]' ) );
	}

	public function test_a_product_row_with_its_own_subject_takes_the_rest_from_the_defaults(): void {
		$this->config()->save( [ 'products' => [ 'layout' => 'grid', 'limit' => 8, 'heading' => 'You may also like' ] ] );

		$html = do_shortcode( '[searcio_products id="product-12"]' );

		$this->assertStringContainsString( 'data-whsc-list', $html );
		$this->assertStringContainsString( 'data-doc-id="product-12"', $html );
		$this->assertStringContainsString( 'data-layout="grid"', $html );
		$this->assertStringContainsString( 'data-limit="8"', $html );
		$this->assertStringContainsString( 'data-heading="You may also like"', $html );
	}

	public function test_a_category_row_names_its_field_and_value(): void {
		$html = do_shortcode( '[searcio_products source="category" field="brand" value="Fjellmark" layout="carousel" banner="no"]' );

		$this->assertStringContainsString( 'data-filter-field="brand"', $html );
		$this->assertStringContainsString( 'data-filter-value="Fjellmark"', $html );
		$this->assertStringContainsString( 'data-show-banner="0"', $html );
	}

	private function config(): Placement_Config {
		return $this->service( 'placement_config' );
	}
}
