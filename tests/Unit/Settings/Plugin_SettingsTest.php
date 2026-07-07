<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Settings;

use PHPUnit\Framework\TestCase;
use ReflectionClassConstant;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Setting;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;

final class Plugin_SettingsTest extends TestCase {
	public function test_encrypt_secret_round_trips_through_decrypt_secret(): void {
		$encrypted = Plugin_Settings::encrypt_secret( 'wk_live_super_secret' );

		$this->assertNotSame( 'wk_live_super_secret', $encrypted );
		$this->assertSame( 'wk_live_super_secret', Plugin_Settings::decrypt_secret( $encrypted ) );
	}

	public function test_encrypt_secret_is_idempotent_on_an_already_encrypted_value(): void {
		$encrypted        = Plugin_Settings::encrypt_secret( 'wk_live_super_secret' );
		$encrypted_again  = Plugin_Settings::encrypt_secret( $encrypted );

		$this->assertSame( $encrypted, $encrypted_again );
	}

	public function test_encrypt_secret_passes_through_empty_values(): void {
		$this->assertSame( '', Plugin_Settings::encrypt_secret( '' ) );
	}

	public function test_decrypt_secret_passes_through_unprefixed_plaintext_unchanged(): void {
		// Forward-compatibility: a value saved before encryption was added
		// (or a plain default) has no `whsc1:` prefix and must round-trip as-is.
		$this->assertSame( 'not-an-encrypted-value', Plugin_Settings::decrypt_secret( 'not-an-encrypted-value' ) );
	}

	public function test_decrypt_secret_returns_empty_string_for_empty_input(): void {
		$this->assertSame( '', Plugin_Settings::decrypt_secret( '' ) );
	}

	public function test_decrypt_secret_returns_empty_string_for_corrupted_payload(): void {
		$this->assertSame( '', Plugin_Settings::decrypt_secret( 'whsc1:not-valid-base64-payload-too-short' ) );
	}

	public function test_delete_data_on_uninstall_defaults_to_off_and_is_rest_exposed(): void {
		$reflection = new ReflectionClassConstant( Plugin_Settings::class, 'DELETE_DATA_ON_UNINSTALL' );
		$attributes = $reflection->getAttributes( Setting::class );

		$this->assertCount( 1, $attributes );

		/** @var Setting $instance */
		$instance = $attributes[0]->newInstance();

		$this->assertSame( 'boolean', $instance->type );
		$this->assertFalse( $instance->default );
		$this->assertTrue( $instance->show_in_rest );
	}

	public function test_translated_schema_overrides_covers_every_setting_without_its_own_tab_component(): void {
		$overrides = Plugin_Settings::translated_schema_overrides();

		// SYNC_RETENTION_DAYS and DELETE_DATA_ON_UNINSTALL are the only two
		// REST-exposed settings with no hand-written tab component of their
		// own, so they're the only two settings that ever render on the
		// generic schema-driven tab using the raw (untranslatable) attribute
		// label/description.
		$this->assertSame(
			[ Plugin_Settings::SYNC_RETENTION_DAYS, Plugin_Settings::DELETE_DATA_ON_UNINSTALL ],
			array_keys( $overrides )
		);

		foreach ( $overrides as $override ) {
			$this->assertArrayHasKey( 'label', $override );
			$this->assertArrayHasKey( 'description', $override );
			$this->assertNotSame( '', $override['label'] );
			$this->assertNotSame( '', $override['description'] );
		}
	}
}
