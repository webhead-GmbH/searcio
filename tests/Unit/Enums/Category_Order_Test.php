<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Category_Order;

final class Category_Order_Test extends TestCase {
	public function test_a_stored_value_is_read_as_it_was_saved(): void {
		$this->assertSame( Category_Order::Shop, Category_Order::from_storage( 'shop' ) );
		$this->assertSame( Category_Order::Name, Category_Order::from_storage( ' Name ' ) );
		$this->assertSame( Category_Order::Count, Category_Order::from_storage( 'count' ) );
	}

	/** A site that never chose one gets the order its shop sorted. */
	public function test_anything_else_is_the_shops_own_order(): void {
		$this->assertSame( Category_Order::Shop, Category_Order::from_storage( 'random' ) );
		$this->assertSame( Category_Order::Shop, Category_Order::from_storage( '' ) );
		$this->assertSame( Category_Order::Shop, Category_Order::from_storage( null ) );
	}
}
