<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\DTO;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\DTO\Placement_Options;
use Webhead\WP\SearchCloud\DTO\Products_Placement;
use Webhead\WP\SearchCloud\Enums\Floating_Devices;
use Webhead\WP\SearchCloud\Enums\Floating_Position;
use Webhead\WP\SearchCloud\Enums\Floating_Style;

final class Placement_Options_Test extends TestCase {
	/**
	 * A site that updates looks and loads as it did.
	 */
	public function test_every_site_wide_way_is_off_until_it_is_turned_on(): void {
		$options = Placement_Options::from_array( [] );

		$this->assertFalse( $options->takeover );
		$this->assertFalse( $options->openers );
		$this->assertFalse( $options->shortcut );
		$this->assertFalse( $options->floating->enabled );
		$this->assertFalse( $options->needs_every_page() );
	}

	public function test_a_form_takeover_alone_does_not_load_the_search_on_every_page(): void {
		$this->assertFalse( Placement_Options::from_array( [ 'takeover' => true ] )->needs_every_page() );
	}

	public function test_openers_need_a_selector_to_load_on_every_page(): void {
		$this->assertFalse( Placement_Options::from_array( [ 'openers' => true ] )->needs_every_page() );
		$this->assertTrue( Placement_Options::from_array( [ 'openers' => true, 'selectors' => [ '.x' ] ] )->needs_every_page() );
	}

	public function test_the_shortcut_and_the_floating_button_load_on_every_page(): void {
		$this->assertTrue( Placement_Options::from_array( [ 'shortcut' => true ] )->needs_every_page() );
		$this->assertTrue( Placement_Options::from_array( [ 'floating' => [ 'enabled' => true ] ] )->needs_every_page() );
	}

	public function test_selectors_keep_combinators_quotes_and_brackets(): void {
		$this->assertSame(
			[ '#menu-item-search > a', 'a[href="?s="]', '[data-gpmodal-trigger="gp-search"]' ],
			Placement_Options::clean_selectors( [ ' #menu-item-search > a ', 'a[href="?s="]', '[data-gpmodal-trigger="gp-search"]' ] )
		);
	}

	public function test_selectors_lose_what_could_end_the_selector_or_the_script(): void {
		$this->assertSame(
			[ '.a color: red', 'x', 'b' ],
			Placement_Options::clean_selectors( [ '.a{color: red;}', 'x</script>', "\\b" ] )
		);
	}

	public function test_selectors_are_read_from_lines_without_blanks_or_twins(): void {
		$this->assertSame(
			[ '.one', '.two' ],
			Placement_Options::clean_selectors( "  .one \n\n.two\r\n.one\n" )
		);
	}

	public function test_selectors_are_held_to_a_number_and_a_length(): void {
		$many = array_map( static fn ( int $i ): string => '.s' . $i, range( 1, 30 ) );

		$this->assertCount( Placement_Options::SELECTORS_MAX, Placement_Options::clean_selectors( $many ) );
		$this->assertSame( [], Placement_Options::clean_selectors( [ '.' . str_repeat( 'a', 300 ) ] ) );
		$this->assertSame( [], Placement_Options::clean_selectors( 42 ) );
	}

	public function test_the_floating_button_reads_its_corner_screens_style_and_offset(): void {
		$floating = Placement_Options::from_array(
			[ 'floating' => [ 'enabled' => 'yes', 'position' => 'START', 'devices' => 'all', 'style' => 'label', 'offset' => '88' ] ]
		)->floating;

		$this->assertTrue( $floating->enabled );
		$this->assertSame( Floating_Position::Start, $floating->position );
		$this->assertSame( Floating_Devices::All, $floating->devices );
		$this->assertSame( Floating_Style::Label, $floating->style );
		$this->assertSame( 88, $floating->offset );
	}

	public function test_the_floating_button_defaults_to_the_end_corner_on_phones(): void {
		$floating = Placement_Options::from_array( [ 'floating' => [ 'position' => 'top', 'devices' => 'tv', 'offset' => 'high' ] ] )->floating;

		$this->assertSame( Floating_Position::End, $floating->position );
		$this->assertSame( Floating_Devices::Phones, $floating->devices );
		$this->assertSame( 24, $floating->offset );
	}

	public function test_what_is_stored_reads_back_the_same(): void {
		$options = Placement_Options::from_array(
			[
				'takeover'  => true,
				'openers'   => true,
				'selectors' => [ '#menu-item-search > a' ],
				'shortcut'  => true,
				'floating'  => [ 'enabled' => true, 'offset' => 96 ],
				'search'    => [ 'mode' => 'box', 'placeholder' => 'Find', 'accent' => '#101010' ],
				'products'  => [ 'layout' => 'grid', 'limit' => 8, 'heading' => 'More' ],
			]
		);

		$this->assertEquals( $options, Placement_Options::from_array( $options->to_array() ) );
	}

	public function test_a_product_row_limit_of_nothing_is_the_storefront_number(): void {
		$this->assertNull( Products_Placement::from_array( [ 'limit' => '0' ] )->limit );
		$this->assertNull( Products_Placement::from_array( [ 'limit' => '' ] )->limit );
		$this->assertSame( 24, Products_Placement::from_array( [ 'limit' => 99 ] )->limit );
		$this->assertFalse( Products_Placement::from_array( [ 'banner' => 'no' ] )->banner );
	}
}
