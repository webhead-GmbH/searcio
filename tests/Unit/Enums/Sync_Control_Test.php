<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Enums;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Enums\Sync_Control;

final class Sync_Control_Test extends TestCase {
	public function test_from_storage_resolves_known_values(): void {
		$this->assertSame( Sync_Control::Pause, Sync_Control::from_storage( 'pause' ) );
		$this->assertSame( Sync_Control::Cancel, Sync_Control::from_storage( 'cancel' ) );
		$this->assertSame( Sync_Control::None, Sync_Control::from_storage( '' ) );
	}

	public function test_from_storage_defaults_to_none_for_unknown_or_null_input(): void {
		$this->assertSame( Sync_Control::None, Sync_Control::from_storage( 'bogus' ) );
		$this->assertSame( Sync_Control::None, Sync_Control::from_storage( null ) );
	}
}
