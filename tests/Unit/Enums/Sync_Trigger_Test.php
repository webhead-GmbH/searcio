<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;

final class Sync_Trigger_Test extends TestCase {
	public function test_values_lists_every_case_as_its_stored_string(): void {
		$this->assertSame( [ 'manual', 'scheduled', 'incremental' ], Sync_Trigger::values() );
	}
}
