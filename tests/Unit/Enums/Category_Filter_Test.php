<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Category_Filter;

final class Category_Filter_Test extends TestCase {
	public function test_a_stored_value_is_read_as_it_was_saved(): void {
		$this->assertSame( Category_Filter::All, Category_Filter::from_storage( 'all' ) );
		$this->assertSame( Category_Filter::Main, Category_Filter::from_storage( 'main' ) );
		$this->assertSame( Category_Filter::Nested, Category_Filter::from_storage( ' Nested ' ) );
	}

	public function test_anything_else_is_the_list_as_it_always_was(): void {
		$this->assertSame( Category_Filter::All, Category_Filter::from_storage( 'tree' ) );
		$this->assertSame( Category_Filter::All, Category_Filter::from_storage( '' ) );
		$this->assertSame( Category_Filter::All, Category_Filter::from_storage( null ) );
	}
}
