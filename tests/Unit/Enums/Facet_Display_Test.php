<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Facet_Display;

final class Facet_Display_Test extends TestCase {
	public function test_from_storage_resolves_every_display(): void {
		$this->assertSame( Facet_Display::List, Facet_Display::from_storage( 'list' ) );
		$this->assertSame( Facet_Display::Tiles, Facet_Display::from_storage( 'tiles' ) );
		$this->assertSame( Facet_Display::Color, Facet_Display::from_storage( ' Color ' ) );
		$this->assertSame( Facet_Display::Range, Facet_Display::from_storage( 'range' ) );
		$this->assertSame( Facet_Display::Auto, Facet_Display::from_storage( 'auto' ) );
	}

	public function test_anything_else_leaves_the_display_to_the_storefront(): void {
		$this->assertSame( Facet_Display::Auto, Facet_Display::from_storage( 'swatches' ) );
		$this->assertSame( Facet_Display::Auto, Facet_Display::from_storage( '' ) );
		$this->assertSame( Facet_Display::Auto, Facet_Display::from_storage( null ) );
		$this->assertSame( Facet_Display::Auto, Facet_Display::from_storage( [ 'list' ] ) );
	}
}
