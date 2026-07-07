<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Capabilities;

use PHPUnit\Framework\TestCase;
use ReflectionClassConstant;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Capability;

final class Plugin_CapabilitiesTest extends TestCase {
	public function test_view_run_sync_and_manage_settings_are_distinct_capability_strings(): void {
		$capabilities = [
			Plugin_Capabilities::VIEW,
			Plugin_Capabilities::RUN_SYNC,
			Plugin_Capabilities::MANAGE_SETTINGS,
		];

		$this->assertCount( 3, array_unique( $capabilities ) );

		foreach ( $capabilities as $capability ) {
			$this->assertIsString( $capability );
			$this->assertNotSame( '', $capability );
		}
	}

	/**
	 * @dataProvider capability_constant_provider
	 */
	public function test_capability_constant_grants_to_administrator_by_default( string $constant_name ): void {
		$reflection = new ReflectionClassConstant( Plugin_Capabilities::class, $constant_name );
		$attributes = $reflection->getAttributes( Capability::class );

		$this->assertCount( 1, $attributes );

		/** @var Capability $instance */
		$instance = $attributes[0]->newInstance();

		$this->assertContains( 'administrator', (array) $instance->roles );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function capability_constant_provider(): array {
		return [
			'view'            => [ 'VIEW' ],
			'run_sync'        => [ 'RUN_SYNC' ],
			'manage_settings' => [ 'MANAGE_SETTINGS' ],
		];
	}
}
