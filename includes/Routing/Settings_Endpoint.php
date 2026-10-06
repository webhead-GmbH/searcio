<?php
/**
 * Generic settings endpoint.
 *
 * Backs the shared React settings store (`SettingsProvider`) used by the
 * Connection, Popular Searches, and any schema-driven generic tabs. GET returns the
 * REST-exposed schema + current values; POST partially updates only the
 * REST-exposed settings and returns the same shape so the client can re-sync
 * in one round trip. Read/write goes entirely through the framework
 * Settings_Manager — no parallel store.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Settings_Endpoint extends Rest_API {
	/**
	 * Credentials that are written through this endpoint and never read back.
	 *
	 * They are REST-exposed only so a pasted key can be saved here. `masked: true`
	 * does not keep them out of a response - it is a display hint the settings
	 * export never consults - so without this the stored value reached every
	 * user with the view capability. Encrypted, but still the secret's only copy
	 * outside the database, sent to people who have no use for it.
	 */
	private const WRITE_ONLY = [ Plugin_Settings::WRITE_KEY, Plugin_Settings::WRITE_SECRET ];

	/**
	 * What a response carries in place of a stored credential: that one is
	 * saved, and nothing else. The screen only ever asks whether it is set.
	 */
	public const STORED = '__stored__';

	public function __construct(
		private Settings_Manager $settings
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/settings', methods: 'GET', permission_callback: 'can_view' )]
	public function get_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->prepare_for_rest( $this->settings->export_for_rest() ) );
	}

	#[Route( '/settings', methods: 'POST', permission_callback: 'can_manage_settings', args: [ 'settings' => [ 'type' => 'object' ] ] )]
	public function update_settings( WP_REST_Request $request ): WP_REST_Response {
		$incoming = $request->get_param( 'settings' );

		if ( ! is_array( $incoming ) ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Invalid settings payload.', 'webhead-search-cloud' ) ],
				400
			);
		}

		$this->settings->partial_update( self::without_unchanged_credentials( $incoming ), rest_only: true );

		return new WP_REST_Response( $this->prepare_for_rest( $this->settings->export_for_rest() ) );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}

	/**
	 * @param  array<string,mixed>  $payload
	 * @return array<string,mixed>
	 */
	private function prepare_for_rest( array $payload ): array {
		return self::redact_credentials( $this->normalize_boolean_values( $this->translate_schema( $payload ) ) );
	}

	/**
	 * @param  array<string,mixed>  $payload
	 * @return array<string,mixed>
	 */
	private static function redact_credentials( array $payload ): array {
		foreach ( self::WRITE_ONLY as $key ) {
			if ( isset( $payload['settings'] ) && is_array( $payload['settings'] ) && array_key_exists( $key, $payload['settings'] ) ) {
				$payload['settings'][ $key ] = '' === (string) $payload['settings'][ $key ] ? '' : self::STORED;
			}
		}

		return $payload;
	}

	/**
	 * The screen saves every setting at once, so a credential it did not touch
	 * comes back as the marker it was given. Saving that would overwrite the
	 * real key with the word standing in for it.
	 *
	 * An empty value is dropped too. The field says "leave blank to keep it",
	 * and typing a character and deleting it again used to send an empty
	 * string that erased the saved key. Disconnecting clears the credentials
	 * through Connection_State, not through here, so nothing needs an empty
	 * value to mean "remove".
	 *
	 * @param  array<string,mixed>  $incoming
	 * @return array<string,mixed>
	 */
	private static function without_unchanged_credentials( array $incoming ): array {
		foreach ( self::WRITE_ONLY as $key ) {
			if ( ! array_key_exists( $key, $incoming ) ) {
				continue;
			}

			$value = is_string( $incoming[ $key ] ) ? trim( $incoming[ $key ] ) : $incoming[ $key ];

			if ( '' === $value || self::STORED === $value || null === $value ) {
				unset( $incoming[ $key ] );
			}
		}

		return $incoming;
	}

	/**
	 * WordPress's `update_option()`/`get_option()` round-trips a PHP `false` as the literal
	 * string `''`. Left uncast, a boolean setting saved as `false` comes back from `GET` as
	 * `''`, and resubmitting it fails `rest_is_boolean()` validation — breaking every settings
	 * save on the page, not just that field.
	 *
	 * @param  array<string,mixed>  $payload
	 * @return array<string,mixed>
	 */
	private function normalize_boolean_values( array $payload ): array {
		foreach ( $payload['schema'] ?? [] as $key => $definition ) {
			if ( 'boolean' === ( $definition['type'] ?? null ) && array_key_exists( $key, $payload['settings'] ?? [] ) ) {
				$payload['settings'][ $key ] = (bool) $payload['settings'][ $key ];
			}
		}

		return $payload;
	}

	/**
	 * `#[Setting(label: ..., description: ...)]` values are compile-time PHP attribute
	 * constants and can never be wrapped in `__()` at their declaration site. This applies
	 * {@see Plugin_Settings::translated_schema_overrides()} for the settings that lack a
	 * hand-written translated tab component and render on the generic schema-driven tab.
	 *
	 * @param  array<string,mixed>  $payload
	 * @return array<string,mixed>
	 */
	private function translate_schema( array $payload ): array {
		foreach ( Plugin_Settings::translated_schema_overrides() as $key => $override ) {
			if ( isset( $payload['schema'][ $key ] ) ) {
				$payload['schema'][ $key ] = array_merge( $payload['schema'][ $key ], $override );
			}
		}

		return $payload;
	}
}
