<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\DTO;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\DTO\Search_Placement;

final class Search_Placement_Test extends TestCase {
	public function test_the_plugin_defaults_are_an_icon_that_searches_on_enter(): void {
		$placement = new Search_Placement();

		$this->assertSame( 'icon', $placement->mode );
		$this->assertSame( 'submit', $placement->trigger );
		$this->assertTrue( $placement->count );
		$this->assertSame( 5, $placement->filters );
		$this->assertSame( 0, $placement->width );
		$this->assertNull( $placement->radius );
	}

	/**
	 * A shortcode hands every attribute over as the string an editor wrote.
	 */
	public function test_reads_shortcode_attributes_written_as_words(): void {
		$placement = Search_Placement::from_array(
			[
				'mode'    => ' Box ',
				'voice'   => 'yes',
				'count'   => 'no',
				'trigger' => 'TYPE',
				'filters' => '3',
				'width'   => '320',
				'align'   => 'center',
				'radius'  => '12',
				'accent'  => '#ff6600',
			]
		);

		$this->assertSame( 'box', $placement->mode );
		$this->assertTrue( $placement->voice );
		$this->assertFalse( $placement->count );
		$this->assertSame( 'type', $placement->trigger );
		$this->assertSame( 3, $placement->filters );
		$this->assertSame( 320, $placement->width );
		$this->assertSame( 'center', $placement->align );
		$this->assertSame( 12, $placement->radius );
		$this->assertSame( [ 'accent' => '#ff6600' ], $placement->colors );
	}

	public function test_what_it_cannot_read_comes_from_the_fallback(): void {
		$settings  = Search_Placement::from_array( [ 'mode' => 'box', 'filters' => 2, 'voice' => true, 'align' => 'end' ] );
		$placement = Search_Placement::from_array(
			[
				'mode'    => 'carousel',
				'filters' => 'many',
				'voice'   => 'perhaps',
				'align'   => 'middle',
			],
			$settings
		);

		$this->assertSame( 'box', $placement->mode );
		$this->assertSame( 2, $placement->filters );
		$this->assertTrue( $placement->voice );
		$this->assertSame( 'end', $placement->align );
	}

	public function test_numbers_are_held_to_their_bounds(): void {
		$placement = Search_Placement::from_array( [ 'filters' => 30, 'width' => -5, 'radius' => 400 ] );

		$this->assertSame( 8, $placement->filters );
		$this->assertSame( 0, $placement->width );
		$this->assertSame( 48, $placement->radius );
	}

	public function test_a_fraction_is_not_a_number_of_filters(): void {
		$this->assertSame( 5, Search_Placement::from_array( [ 'filters' => '2.5' ] )->filters );
	}

	public function test_text_is_one_line_without_markup(): void {
		$placement = Search_Placement::from_array( [ 'placeholder' => "  <b>Find</b>\n jackets  ", 'type' => 'Product<script>' ] );

		$this->assertSame( 'Find jackets', $placement->placeholder );
		$this->assertSame( 'productscript', $placement->type );
	}

	public function test_an_empty_colour_or_radius_clears_the_fallbacks(): void {
		$settings  = Search_Placement::from_array( [ 'accent' => '#000000', 'radius' => 10 ] );
		$placement = Search_Placement::from_array( [ 'accent' => '', 'radius' => '' ], $settings );

		$this->assertSame( [], $placement->colors );
		$this->assertNull( $placement->radius );
	}

	public function test_a_colour_cannot_end_its_declaration(): void {
		$placement = Search_Placement::from_array( [ 'background' => 'red;}body{display:none' ] );

		$this->assertSame( 'redbodydisplaynone', $placement->colors['background'] );
	}

	public function test_block_attributes_carry_the_block_names(): void {
		$attributes = Search_Placement::from_array(
			[ 'mode' => 'box', 'voice' => true, 'type' => 'product', 'accent' => '#123456', 'radius' => 8 ]
		)->to_block_attributes();

		$this->assertSame( 'box', $attributes['mode'] );
		$this->assertTrue( $attributes['enableVoice'] );
		$this->assertSame( 'product', $attributes['scopeType'] );
		$this->assertSame( '#123456', $attributes['accentColor'] );
		$this->assertSame( 8, $attributes['radiusPanel'] );
		$this->assertArrayNotHasKey( 'bgColor', $attributes );
	}

	/**
	 * What `shortcode_atts()` is given: an attribute left out of a shortcode
	 * then reads back as the setting it came from.
	 */
	public function test_shortcode_defaults_read_back_as_the_same_placement(): void {
		$settings = Search_Placement::from_array( [ 'mode' => 'box', 'voice' => true, 'radius' => 6, 'text' => '#333333' ] );
		$defaults = $settings->to_shortcode_defaults();

		$this->assertSame( 'yes', $defaults['voice'] );
		$this->assertSame( 'yes', $defaults['count'] );
		$this->assertSame( '', $defaults['accent'] );
		$this->assertSame( '6', $defaults['radius'] );
		$this->assertEquals( $settings, Search_Placement::from_array( $defaults, $settings ) );
	}
}
