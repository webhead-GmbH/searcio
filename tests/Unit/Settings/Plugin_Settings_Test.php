<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Settings;

use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionClassConstant;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Setting;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;

final class Plugin_Settings_Test extends TestCase {
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

	/**
	 * On until the shop turns it off, and saved with the General tab, whose own
	 * card draws it.
	 */
	public function test_support_searcio_defaults_to_on_and_is_rest_exposed(): void {
		$instance = $this->setting( 'SUPPORT_SEARCIO' );

		$this->assertSame( 'boolean', $instance->type );
		$this->assertTrue( $instance->default );
		$this->assertTrue( $instance->show_in_rest );
	}

	/**
	 * A mirror of what Search Cloud says, written by the plugin and never by a
	 * settings form: an admin could otherwise call a Free plan paid.
	 */
	public function test_the_plan_tier_is_kept_out_of_rest_and_holds_only_a_tier(): void {
		$instance = $this->setting( 'PLAN_TIER' );

		$this->assertSame( 'string', $instance->type );
		$this->assertSame( '', $instance->default );
		$this->assertFalse( $instance->show_in_rest );
		$this->assertSame( [ '', 'free', 'paid' ], $instance->schema['enum'] );
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

	/**
	 * A text setting is stored as it is sent unless it says what it holds: a
	 * `format` in its schema, an `enum`, a `pattern`, or a sanitize callback.
	 * With none of them, markup posted to the settings endpoint is kept. A
	 * masked setting is the exception: a secret has to be stored unchanged.
	 */
	public function test_every_text_setting_says_what_it_holds(): void {
		foreach ( $this->declared_settings() as $name => $setting ) {
			if ( 'string' !== $setting->type || $setting->masked ) {
				continue;
			}

			$says = isset( $setting->schema['format'] )
				|| isset( $setting->schema['enum'] )
				|| isset( $setting->schema['pattern'] )
				|| null !== $setting->sanitize_callback;

			$this->assertTrue( $says, sprintf( 'Setting [%s] is text with no format, enum, pattern or sanitize callback: it stores whatever it is sent.', $name ) );
		}
	}

	/**
	 * The same for a list of texts, whose items are what is stored.
	 */
	public function test_every_list_of_texts_says_what_its_items_hold(): void {
		foreach ( $this->declared_settings() as $name => $setting ) {
			if ( 'array' !== $setting->type || 'string' !== ( $setting->schema['items']['type'] ?? null ) ) {
				continue;
			}

			$items = $setting->schema['items'];

			$this->assertTrue(
				isset( $items['format'] ) || isset( $items['enum'] ) || isset( $items['pattern'] ) || null !== $setting->sanitize_callback,
				sprintf( 'Setting [%s] is a list of texts whose items have no format, enum or pattern.', $name )
			);
		}
	}

	/**
	 * Two settings sharing an option key would silently overwrite each other.
	 */
	public function test_option_keys_are_unique(): void {
		$option_keys = array_values(
			array_filter(
				array_map( static fn ( Setting $setting ): ?string => $setting->option_key, $this->declared_settings() )
			)
		);

		$this->assertSame( array_values( array_unique( $option_keys ) ), $option_keys );
	}

	/**
	 * Every declared setting, keyed by its setting name.
	 *
	 * @return array<string, Setting>
	 */
	private function declared_settings(): array {
		$settings = [];

		foreach ( ( new ReflectionClass( Plugin_Settings::class ) )->getReflectionConstants() as $constant ) {
			foreach ( $constant->getAttributes( Setting::class ) as $attribute ) {
				$settings[ (string) $constant->getValue() ] = $attribute->newInstance();
			}
		}

		return $settings;
	}

	private function setting( string $constant ): Setting {
		$attributes = ( new ReflectionClassConstant( Plugin_Settings::class, $constant ) )->getAttributes( Setting::class );

		$this->assertCount( 1, $attributes );

		return $attributes[0]->newInstance();
	}
}
