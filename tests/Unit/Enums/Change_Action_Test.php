<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Change_Action;

final class Change_Action_Test extends TestCase {
	public function test_from_storage_resolves_known_values(): void {
		$this->assertSame( Change_Action::Upsert, Change_Action::from_storage( 'upsert' ) );
		$this->assertSame( Change_Action::Delete, Change_Action::from_storage( 'delete' ) );
	}

	public function test_from_storage_defaults_to_upsert_for_unknown_or_null_input(): void {
		$this->assertSame( Change_Action::Upsert, Change_Action::from_storage( 'unpublish' ) );
		$this->assertSame( Change_Action::Upsert, Change_Action::from_storage( '' ) );
		$this->assertSame( Change_Action::Upsert, Change_Action::from_storage( null ) );
	}
}
