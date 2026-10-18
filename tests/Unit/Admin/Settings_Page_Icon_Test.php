<?php
/**
 * The admin menu icon.
 *
 * WordPress paints a base64 SVG menu icon itself, in the colour of the admin
 * scheme: wp-admin/js/svg-painter.js decodes it with `atob()`, replaces every
 * `fill="…"` and every `style="…"` with that colour, and encodes it again. An
 * icon that drew its shape with a second colour comes out as a solid block, one
 * with a character outside ASCII is not painted at all, and neither says so.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Admin;

use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Webhead\WP\SearchCloud\Admin\Settings_Page;

final class Settings_Page_Icon_Test extends TestCase {
	private const PREFIX = 'data:image/svg+xml;base64,';

	public function test_the_icon_is_a_base64_svg_wordpress_can_paint(): void {
		$icon = $this->icon();

		$this->assertStringStartsWith( self::PREFIX, $icon );

		$svg = base64_decode( substr( $icon, strlen( self::PREFIX ) ), true );

		$this->assertIsString( $svg );
		$this->assertSame( 0, preg_match( '/[^\x20-\x7E]/', $svg ), 'atob() cannot decode what is not ASCII.' );

		$document = simplexml_load_string( $svg );

		$this->assertNotFalse( $document );
		$this->assertSame( 'svg', $document->getName() );

		$box = array_map( 'floatval', preg_split( '/\s+/', (string) $document['viewBox'] ) );

		$this->assertCount( 4, $box );
		$this->assertSame( $box[2], $box[3], 'A menu icon is drawn in a square.' );
	}

	/**
	 * One fill, and the "s" cut out of it, so painting every fill in one colour
	 * leaves the mark as it is.
	 */
	public function test_the_shape_survives_being_painted_in_one_colour(): void {
		$svg = base64_decode( substr( $this->icon(), strlen( self::PREFIX ) ), true );

		$this->assertSame( 1, preg_match_all( '/\sfill="/', $svg ), 'A second fill would be painted the same colour as the first.' );
		$this->assertStringNotContainsString( 'style', $svg, 'The painter replaces a whole style attribute and every fill in a <style>.' );
		$this->assertStringContainsString( 'fill-rule="evenodd"', $svg );

		// What svg-painter.js does to it, with the default scheme's icon colour.
		$painted = preg_replace( '/fill="(.+?)"/', 'fill="#a7aaad"', $svg );

		$this->assertStringContainsString( 'fill="#a7aaad"', $painted );
		$this->assertStringContainsString( 'fill-rule="evenodd"', $painted, 'Painting must not take the cut-out away.' );
	}

	private function icon(): string {
		$class = new ReflectionClass( Settings_Page::class );
		$page  = $class->newInstanceWithoutConstructor();

		return (string) $class->getMethod( 'get_icon' )->invoke( $page );
	}
}
