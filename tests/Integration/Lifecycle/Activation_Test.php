<?php
/**
 * Activation / lifecycle integration tests.
 *
 * The integration bootstrap runs the real activation routine once, so these
 * assert its observable results against the live database: the plugin's custom
 * tables exist and the capability split is granted to the administrator role.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Activation_Test extends Integration_Test_Case {

	public function test_sync_runs_table_is_created(): void {
		$this->assertTrue( $this->service( 'sync_runs_table' )->table_exists() );
	}

	public function test_change_queue_table_is_created(): void {
		$this->assertTrue( $this->service( 'change_queue_table' )->table_exists() );
	}

	public function test_activation_is_idempotent(): void {
		// Re-running activation must not error or drop the existing tables.
		$this->plugin()->activate( false );

		$this->assertTrue( $this->service( 'sync_runs_table' )->table_exists() );
		$this->assertTrue( $this->service( 'change_queue_table' )->table_exists() );
	}

	public function test_administrator_gets_the_capability_split(): void {
		$admin = get_role( 'administrator' );

		$this->assertNotNull( $admin );
		$this->assertTrue( $admin->has_cap( Plugin_Capabilities::VIEW ) );
		$this->assertTrue( $admin->has_cap( Plugin_Capabilities::RUN_SYNC ) );
		$this->assertTrue( $admin->has_cap( Plugin_Capabilities::MANAGE_SETTINGS ) );
	}

	public function test_subscriber_has_no_plugin_capabilities(): void {
		$subscriber = get_role( 'subscriber' );

		$this->assertNotNull( $subscriber );
		$this->assertFalse( $subscriber->has_cap( Plugin_Capabilities::VIEW ) );
		$this->assertFalse( $subscriber->has_cap( Plugin_Capabilities::RUN_SYNC ) );
	}
}
