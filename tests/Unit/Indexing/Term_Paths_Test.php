<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Indexing;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Indexing\Term_Paths;

final class Term_Paths_Test extends TestCase {
	public function test_a_level_is_the_name_as_typed(): void {
		$this->assertSame( 'Vergaser & Ansaugung', Term_Paths::level( 'Vergaser &amp; Ansaugung' ) );
		$this->assertSame( 'MTS Technik', Term_Paths::level( ' MTS Technik ' ) );
	}

	/**
	 * Searcio splits a path at " > ". A ">" that stands alone in a name would
	 * split it into two levels, so it is written as "›".
	 */
	public function test_a_greater_than_sign_that_stands_alone_is_written_as_a_quote(): void {
		$this->assertSame( 'Größe › 40', Term_Paths::level( 'Größe &gt; 40' ) );
		$this->assertSame( '› 40 cm', Term_Paths::level( '> 40 cm' ) );
		$this->assertSame( 'Weit ›', Term_Paths::level( 'Weit >' ) );
		$this->assertSame( 'A › › B', Term_Paths::level( 'A > > B' ) );
	}

	public function test_a_greater_than_sign_inside_a_word_stays(): void {
		$this->assertSame( 'Size >40', Term_Paths::level( 'Size >40' ) );
		$this->assertSame( 'a->b', Term_Paths::level( 'a->b' ) );
	}
}
