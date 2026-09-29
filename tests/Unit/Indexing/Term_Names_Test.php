<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Indexing;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Indexing\Term_Names;

final class Term_Names_Test extends TestCase {
	/**
	 * `pre_term_name` escapes `&`, `<` and `>` on every save.
	 */
	public function test_decode_restores_what_wordpress_escaped(): void {
		$this->assertSame( 'Vergaser & Ansaugung', Term_Names::decode( 'Vergaser &amp; Ansaugung' ) );
		$this->assertSame( 'Size <40>', Term_Names::decode( 'Size &lt;40&gt;' ) );
	}

	/**
	 * An entity typed into the name field is kept as typed, so it is decoded
	 * too rather than shown to shoppers as markup.
	 */
	public function test_decode_resolves_named_and_numeric_entities(): void {
		$this->assertSame( 'Café', Term_Names::decode( 'Caf&eacute;' ) );
		$this->assertSame( "Kids' – Shoes", Term_Names::decode( 'Kids&#039; &#8211; Shoes' ) );
	}

	public function test_decode_leaves_a_plain_name_alone(): void {
		$this->assertSame( 'A & B', Term_Names::decode( 'A & B' ) );
		$this->assertSame( 'Outerwear', Term_Names::decode( 'Outerwear' ) );
	}
}
