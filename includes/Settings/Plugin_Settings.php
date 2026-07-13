<?php
/**
 * Plugin Settings.
 *
 * Single source of truth for option keys, defaults, schema, and REST exposure.
 * The Search Cloud connection credentials live here as masked settings. The
 * write key and write secret are encrypted at rest through an idempotent
 * sanitize callback (so a re-saved, unchanged masked value is not encrypted
 * twice) and decrypted at the point of use with {@see self::decrypt_secret()}.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Settings;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Setting;

defined( 'ABSPATH' ) || exit;

final class Plugin_Settings {
	public const GROUP = 'webhead_search_cloud_settings';

	private const CIPHER     = 'aes-256-gcm';
	private const ENC_PREFIX = 'whsc1:';

	#[Setting(
		type: 'string',
		default: '',
		option_key: 'webhead_search_cloud_search_key',
		show_in_rest: true,
		label: 'Search key',
		description: 'Public search key (sk_...) used by the browser. Restricted by your domain allowlist.'
	)]
	public const SEARCH_KEY = 'search_key';

	#[Setting(
		type: 'string',
		default: '',
		option_key: 'webhead_search_cloud_write_key',
		show_in_rest: true,
		masked: true,
		label: 'Write key',
		description: 'Server-side write key (wk_...). Stored encrypted; never sent to the browser in clear text.',
		sanitize_callback: 'encrypt_secret'
	)]
	public const WRITE_KEY = 'write_key';

	#[Setting(
		type: 'string',
		default: '',
		option_key: 'webhead_search_cloud_write_secret',
		show_in_rest: true,
		masked: true,
		label: 'Write secret',
		description: 'Server-side write secret. Stored encrypted; never sent to the browser in clear text.',
		sanitize_callback: 'encrypt_secret'
	)]
	public const WRITE_SECRET = 'write_secret';

	/**
	 * Persisted once per site the first time the zero-friction connect flow
	 * runs (see {@see \Webhead\WP\SearchCloud\Connection\Connection_State}) and
	 * reused on every retry, per docs/api/building-a-plugin.md: "Generate
	 * idempotency_key once per site and store it alongside the keys." Kept out
	 * of REST — it is never read or written by the browser.
	 */
	#[Setting(
		type: 'string',
		default: '',
		option_key: 'webhead_search_cloud_connect_idempotency_key',
		show_in_rest: false,
		label: 'Connect idempotency key',
		description: 'UUID generated once and replayed on every /connect retry for this site.'
	)]
	public const CONNECT_IDEMPOTENCY_KEY = 'connect_idempotency_key';

	/**
	 * Set when `/connect` returns `pending_claim` (the admin email already has a
	 * Search Cloud account) so the Connection tab can keep showing the
	 * "check your inbox" notice across page reloads. Cleared once working
	 * credentials are saved and pass a health check.
	 */
	#[Setting(
		type: 'boolean',
		default: false,
		option_key: 'webhead_search_cloud_connect_pending_claim',
		show_in_rest: true,
		label: 'Connect pending claim',
		description: 'Whether a /connect attempt is waiting on the owner to claim an existing account by email.'
	)]
	public const CONNECT_PENDING_CLAIM = 'connect_pending_claim';

	/**
	 * The email address a pending claim notice was sent to, so the reloaded
	 * notice can name the inbox to check instead of a generic message.
	 */
	#[Setting(
		type: 'string',
		default: '',
		option_key: 'webhead_search_cloud_connect_pending_email',
		show_in_rest: true,
		label: 'Connect pending claim email',
		description: 'The email address the pending-claim confirmation link was sent to.'
	)]
	public const CONNECT_PENDING_EMAIL = 'connect_pending_email';

	/**
	 * Per-post-type indexing configuration (see {@see \Webhead\WP\SearchCloud\Indexing\Index_Config}).
	 * Kept out of REST (`show_in_rest: false`) because it is read/written through
	 * the dedicated Indexing endpoint, not the generic settings screen.
	 */
	#[Setting(
		type: 'object',
		default: [],
		option_key: 'webhead_search_cloud_index_config',
		show_in_rest: false,
		label: 'Indexing configuration',
		description: 'Per-post-type field mapping pushed to Search Cloud.'
	)]
	public const INDEX_CONFIG = 'index_config';

	/**
	 * Bumped by {@see \Webhead\WP\SearchCloud\Indexing\Index_Config::save()} whenever
	 * the mapping changes. Participates in dirty detection so a mapping change
	 * re-syncs affected documents.
	 */
	#[Setting(
		type: 'integer',
		default: 1,
		option_key: 'webhead_search_cloud_config_version',
		show_in_rest: false,
		label: 'Config version',
		description: 'Internal mapping revision used for dirty detection.'
	)]
	public const CONFIG_VERSION = 'config_version';

	/**
	 * Sync-history retention in days. `0` keeps history forever. REST-exposed
	 * so it renders on the generic schema-driven "General" settings tab;
	 * applied by {@see \Webhead\WP\SearchCloud\Sync\Sync_Service::run_scheduled()}
	 * on every scheduled sync (not eagerly on save — see Sync_Service).
	 */
	#[Setting(
		type: 'integer',
		default: 90,
		option_key: 'webhead_search_cloud_sync_retention_days',
		show_in_rest: true,
		label: 'Keep history for (days)',
		description: 'How long finished sync runs are kept. Use 0 to keep them forever.'
	)]
	public const SYNC_RETENTION_DAYS = 'sync_retention_days';

	/**
	 * Local mirror of Search Cloud's own `search-config.languages`, refreshed
	 * by {@see \Webhead\WP\SearchCloud\Routing\Search_Config_Endpoint} on every
	 * read/write of that resource. Kept out of REST since it isn't managed
	 * directly on the generic settings screen; mirroring it locally lets
	 * {@see \Webhead\WP\SearchCloud\Indexing\Document_Builder} and the
	 * front-end language filter avoid a live API call on every document build
	 * or page load. Empty = unrestricted.
	 */
	#[Setting(
		type: 'array',
		default: [],
		option_key: 'webhead_search_cloud_enabled_languages',
		show_in_rest: false,
		label: 'Enabled languages',
		description: "Local mirror of Search Cloud's configured languages.",
		schema: [ 'items' => [ 'type' => 'string' ] ]
	)]
	public const ENABLED_LANGUAGES = 'enabled_languages';

	/**
	 * Curated fallback queries shown in the modal's empty-query state until the
	 * Search Cloud API ships a popular/trending-searches endpoint.
	 */
	#[Setting(
		type: 'array',
		default: [],
		option_key: 'webhead_search_cloud_popular_searches',
		show_in_rest: true,
		label: 'Popular searches',
		description: 'Curated list of queries shown as suggestions before the visitor types anything.',
		schema: [ 'items' => [ 'type' => 'string' ] ]
	)]
	public const POPULAR_SEARCHES = 'popular_searches';

	/**
	 * Opt-in uninstall policy, read by {@see \Webhead\WP\SearchCloud\Plugin::configure_uninstall()}.
	 * Off by default: uninstalling the plugin keeps its settings, tables, and
	 * per-post sync metadata untouched. Turning this on only affects data
	 * stored in this WordPress site; it never deletes documents already sent
	 * to Search Cloud.
	 */
	#[Setting(
		type: 'boolean',
		default: false,
		option_key: 'webhead_search_cloud_delete_data_on_uninstall',
		show_in_rest: true,
		label: 'Delete plugin data on uninstall',
		description: 'When enabled, deleting this plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Search Cloud.'
	)]
	public const DELETE_DATA_ON_UNINSTALL = 'delete_data_on_uninstall';

	/**
	 * Translated label/description overrides for settings that render on the
	 * generic schema-driven "General" tab. `#[Setting(label: ..., description:
	 * ...)]` arguments must be compile-time constant expressions, so they can
	 * never be wrapped in `__()` at the point where they're declared above —
	 * PHP raises a fatal error for a function call in an attribute argument.
	 * Every other REST-exposed setting has a hand-written, translated tab
	 * component that overrides the generic rendering; these two do not, so
	 * {@see \Webhead\WP\SearchCloud\Routing\Settings_Endpoint} applies this
	 * override to the exported schema before it reaches the browser.
	 *
	 * @return array<string,array{label:string,description:string}>
	 */
	public static function translated_schema_overrides(): array {
		return [
			self::SYNC_RETENTION_DAYS => [
				'label'       => __( 'Keep history for (days)', 'webhead-search-cloud' ),
				'description' => __( 'How long finished sync runs are kept. Use 0 to keep them forever.', 'webhead-search-cloud' ),
			],
			self::DELETE_DATA_ON_UNINSTALL => [
				'label'       => __( 'Delete plugin data on uninstall', 'webhead-search-cloud' ),
				'description' => __( 'When enabled, deleting this plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Search Cloud.', 'webhead-search-cloud' ),
			],
		];
	}

	/**
	 * Idempotent encrypt-on-save. Empty or already-encrypted values pass through
	 * unchanged so a re-saved masked field is not double-encrypted.
	 */
	public static function encrypt_secret( mixed $value ): string {
		$value = is_string( $value ) ? trim( $value ) : '';

		if ( '' === $value || str_starts_with( $value, self::ENC_PREFIX ) || ! function_exists( 'openssl_encrypt' ) ) {
			return $value;
		}

		$iv_length  = openssl_cipher_iv_length( self::CIPHER );
		$iv         = random_bytes( false === $iv_length ? 12 : $iv_length );
		$tag        = '';
		$ciphertext = openssl_encrypt( $value, self::CIPHER, self::encryption_key(), OPENSSL_RAW_DATA, $iv, $tag );

		if ( false === $ciphertext ) {
			return $value;
		}

		return self::ENC_PREFIX . base64_encode( $iv . $tag . $ciphertext );
	}

	/**
	 * Decrypt a value stored by {@see self::encrypt_secret()} for server-side use.
	 * Returns plain (non-prefixed) values unchanged for forward compatibility.
	 */
	public static function decrypt_secret( mixed $value ): string {
		$value = is_string( $value ) ? $value : '';

		if ( '' === $value || ! str_starts_with( $value, self::ENC_PREFIX ) || ! function_exists( 'openssl_decrypt' ) ) {
			return $value;
		}

		$raw = base64_decode( substr( $value, strlen( self::ENC_PREFIX ) ), true );

		if ( false === $raw ) {
			return '';
		}

		$iv_length  = openssl_cipher_iv_length( self::CIPHER );
		$iv_length  = false === $iv_length ? 12 : $iv_length;
		$tag_length = 16;

		if ( strlen( $raw ) < $iv_length + $tag_length ) {
			return '';
		}

		$iv         = substr( $raw, 0, $iv_length );
		$tag        = substr( $raw, $iv_length, $tag_length );
		$ciphertext = substr( $raw, $iv_length + $tag_length );

		$plaintext = openssl_decrypt( $ciphertext, self::CIPHER, self::encryption_key(), OPENSSL_RAW_DATA, $iv, $tag );

		return false === $plaintext ? '' : $plaintext;
	}

	/**
	 * Derive a stable 32-byte key from WordPress salts.
	 */
	private static function encryption_key(): string {
		$salt = function_exists( 'wp_salt' ) ? wp_salt( 'secure_auth' ) : ( defined( 'SECURE_AUTH_SALT' ) ? SECURE_AUTH_SALT : 'webhead-search-cloud' );

		return hash( 'sha256', 'webhead-search-cloud|' . $salt, true );
	}
}
