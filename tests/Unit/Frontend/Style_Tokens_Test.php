<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Frontend\Style_Tokens;

final class Style_Tokens_Test extends TestCase {
	public function test_writes_colours_lengths_and_the_animation_duration(): void {
		$this->assertSame(
			'--whsc-accent:#ff0000;--whsc-radius-panel:12px;--whsc-anim-duration:250ms',
			Style_Tokens::declarations( [ 'accentColor' => '#ff0000', 'radiusPanel' => 12, 'animationDuration' => 250 ] )
		);
	}

	public function test_leaves_out_what_is_not_set(): void {
		$this->assertSame( '', Style_Tokens::declarations( [ 'accentColor' => '  ', 'radiusPanel' => null, 'mode' => 'box' ] ) );
	}

	public function test_a_colour_keeps_only_what_a_colour_is_written_with(): void {
		$this->assertSame( 'rgb(0, 0, 0)', Style_Tokens::color( 'rgb(0, 0, 0)' ) );
		$this->assertSame( 'red', Style_Tokens::color( 'red;' ) );
		$this->assertSame( 'redstyle', Style_Tokens::color( 'red</style>' ) );
		$this->assertSame( '', Style_Tokens::color( [ '#fff' ] ) );
	}

	public function test_the_style_element_sets_the_declarations_on_the_instance(): void {
		$this->assertSame(
			'<style>.whsc-instance-abc{--whsc-floating-offset:80px}</style>',
			Style_Tokens::style_element( 'whsc-instance-abc', [ 'floatingOffset' => 80 ] )
		);
	}

	public function test_no_style_element_without_a_class_or_a_declaration(): void {
		$this->assertSame( '', Style_Tokens::style_element( '', [ 'accentColor' => '#000' ] ) );
		$this->assertSame( '', Style_Tokens::style_element( 'whsc-instance-abc', [] ) );
		$this->assertSame(
			'<style>.whsc-instance-xscript{--whsc-accent:#000}</style>',
			Style_Tokens::style_element( 'whsc-instance-x"><script>', [ 'accentColor' => '#000' ] )
		);
	}
}
