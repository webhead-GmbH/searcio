<?php
/**
 * The classic widgets "Searcio Search" and "Searcio Products", and the
 * "Searcio" box of Appearance > Menus.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Admin\Menu_Item;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;
use Webhead\WP\SearchCloud\Widgets\Classic_Products_Widget;
use Webhead\WP\SearchCloud\Widgets\Classic_Search_Widget;

final class Classic_Widgets_Test extends Integration_Test_Case {
	public function test_both_widgets_are_registered(): void {
		global $wp_widget_factory;

		$this->assertArrayHasKey( Classic_Search_Widget::class, $wp_widget_factory->widgets );
		$this->assertArrayHasKey( Classic_Products_Widget::class, $wp_widget_factory->widgets );
	}

	public function test_the_search_widget_draws_its_title_and_the_search(): void {
		$this->service( 'placement_config' )->save( [ 'search' => [ 'placeholder' => 'Search the shop' ] ] );

		$html = $this->widget( Classic_Search_Widget::class, [ 'title' => 'Find', 'mode' => 'box' ] );

		$this->assertStringContainsString( '<h2 class="widgettitle">Find</h2>', $html );
		$this->assertStringContainsString( 'data-mode="box"', $html );
		$this->assertStringContainsString( 'data-placeholder="Search the shop"', $html, 'An empty placeholder takes the default.' );
	}

	public function test_the_products_widget_prints_nothing_on_a_page_without_a_product(): void {
		$this->assertSame( '', $this->widget( Classic_Products_Widget::class, [ 'title' => 'More' ] ) );
	}

	public function test_the_forms_keep_only_what_they_offer(): void {
		$search   = new Classic_Search_Widget();
		$products = new Classic_Products_Widget();

		$this->assertSame(
			[ 'title' => 'Find', 'mode' => '', 'placeholder' => 'Type here' ],
			$search->update( [ 'title' => '<b>Find</b>', 'mode' => 'carousel', 'placeholder' => 'Type here' ], [] )
		);
		$this->assertSame(
			[ 'title' => '', 'source' => 'category', 'layout' => '', 'limit' => '24', 'heading' => '' ],
			$products->update( [ 'source' => 'category', 'layout' => 'list', 'limit' => '99' ], [] )
		);
	}

	public function test_the_widgets_are_named_on_the_screens_that_list_them(): void {
		global $wp_widget_factory;

		$this->service( 'widget_registrar' )->translate();

		$this->assertSame( Classic_Search_Widget::labels()['name'], $wp_widget_factory->widgets[ Classic_Search_Widget::class ]->name );
		$this->assertSame( Classic_Products_Widget::labels()['description'], $wp_widget_factory->widgets[ Classic_Products_Widget::class ]->widget_options['description'] );
	}

	public function test_the_menu_box_adds_a_link_to_searcio_with_its_class(): void {
		ob_start();
		( new Menu_Item() )->render();
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'id="posttype-webhead-search-cloud"', $html );
		$this->assertStringContainsString( 'id="submit-posttype-webhead-search-cloud"', $html );
		$this->assertStringContainsString( 'name="menu-item[-1][menu-item-url]" value="#searcio"', $html );
		$this->assertStringContainsString( 'name="menu-item[-1][menu-item-classes]" value="searcio-open"', $html );
	}

	/**
	 * @param  class-string         $widget
	 * @param  array<string,mixed>  $instance
	 */
	private function widget( string $widget, array $instance ): string {
		ob_start();
		the_widget( $widget, $instance );

		return (string) ob_get_clean();
	}
}
