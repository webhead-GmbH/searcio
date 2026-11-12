<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\DTO;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\DTO\Storefront_Facet;
use Webhead\WP\SearchCloud\Enums\Category_Order;
use Webhead\WP\SearchCloud\Enums\Facet_Display;

final class Storefront_Facet_Test extends TestCase {
	public function test_a_field_is_handed_over_with_its_place_and_display(): void {
		$facet = new Storefront_Facet( 'attr_size', 4 );

		$this->assertSame(
			[
				'field'   => 'attr_size',
				'order'   => 4,
				'display' => 'auto',
			],
			$facet->to_array()
		);
	}

	public function test_colours_go_with_it_only_when_there_are_some(): void {
		$facet = new Storefront_Facet( 'attr_color', 2, Facet_Display::Color, [ 'Oliv' => '#6f7a3a' ] );

		$this->assertSame(
			[
				'field'   => 'attr_color',
				'order'   => 2,
				'display' => 'color',
				'colors'  => [ 'Oliv' => '#6f7a3a' ],
			],
			$facet->to_array()
		);
	}

	/**
	 * A colour map keyed by numbers ("38") must still reach the storefront as
	 * an object, never as a list.
	 */
	public function test_colours_keyed_by_numbers_stay_an_object(): void {
		$facet = new Storefront_Facet( 'attr_size', 0, Facet_Display::Auto, [ '38' => '#000000' ] );

		$this->assertSame( '{"38":"#000000"}', json_encode( $facet->to_array()['colors'] ) );
	}

	public function test_what_a_swatches_plugin_gave_goes_with_it_only_when_there_is_some(): void {
		$facet = new Storefront_Facet(
			'attr_color',
			1,
			Facet_Display::Auto,
			[ 'Zebra' => '#000000' ],
			[ 'Zebra' => '#ffffff' ],
			[ 'Leinen' => 'https://shop.test/leinen.jpg' ],
			[ 'Extra Large' => 'XL' ]
		);

		$this->assertSame(
			[
				'field'        => 'attr_color',
				'order'        => 1,
				'display'      => 'auto',
				'colors'       => [ 'Zebra' => '#000000' ],
				'secondColors' => [ 'Zebra' => '#ffffff' ],
				'images'       => [ 'Leinen' => 'https://shop.test/leinen.jpg' ],
				'labels'       => [ 'Extra Large' => 'XL' ],
			],
			$facet->to_array()
		);
	}

	public function test_a_tree_goes_with_it_when_there_is_one(): void {
		$tree  = [ 'depth' => 2, 'parents' => [ 'Jacken' => 'Kleidung' ] ];
		$facet = new Storefront_Facet( 'categories', 0, tree: $tree );

		$this->assertSame( $tree, $facet->to_array()['tree'] );
		$this->assertArrayNotHasKey( 'tree', ( new Storefront_Facet( 'categories', 0 ) )->to_array() );
	}

	public function test_the_category_filter_carries_its_order_and_whether_it_is_drawn(): void {
		$facet = new Storefront_Facet( 'categories', 0, hidden: true, sort: Category_Order::Shop, values_order: [ 2 => 'Felgen', 5 => 'Fahrwerke' ] );
		$out   = $facet->to_array();

		$this->assertTrue( $out['hidden'] );
		$this->assertSame( 'shop', $out['sort'] );
		$this->assertSame( [ 'Felgen', 'Fahrwerke' ], $out['valuesOrder'], 'A list, never an object.' );
	}

	public function test_any_other_filter_carries_none_of_it(): void {
		$out = ( new Storefront_Facet( 'brand', 1 ) )->to_array();

		$this->assertArrayNotHasKey( 'hidden', $out );
		$this->assertArrayNotHasKey( 'sort', $out );
		$this->assertArrayNotHasKey( 'valuesOrder', $out );
	}
}
