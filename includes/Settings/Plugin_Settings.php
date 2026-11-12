<?php
/**
 * Plugin Settings.
 *
 * Single source of truth for option keys, defaults, schema, and REST exposure.
 * The Searcio connection credentials live here as masked settings. The
 * write key and write secret are encrypted at rest through an idempotent
 * sanitize callback (so a re-saved, unchanged masked value is not encrypted
 * twice) and decrypted at the point of use with {@see self::decrypt_secret()}.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Settings;

use Webhead\WP\SearchCloud\Indexing\Term_Names;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Setting;

defined( 'ABSPATH' ) || exit;

final class Plugin_Settings {
	public const GROUP = 'searcio_settings';

	private const CIPHER     = 'aes-256-gcm';
	private const ENC_PREFIX = 'whsc1:';

	/**
	 * What the encryption key is derived from, with the site's salt. Written
	 * out rather than taken from the slug: a change to it turns every saved
	 * write key and secret into nothing.
	 */
	private const ENCRYPTION_CONTEXT = 'searcio';

	#[Setting(
		type: 'string',
		default: '',
		option_key: 'searcio_search_key',
		show_in_rest: true,
		label: 'Search key',
		description: 'Public search key (sk_...) used by the browser. Restricted by your domain allowlist.',
		schema: [ 'format' => 'text-field' ]
	)]
	public const SEARCH_KEY = 'search_key';

	#[Setting(
		type: 'string',
		default: '',
		option_key: 'searcio_write_key',
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
		option_key: 'searcio_write_secret',
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
	 * of REST - it is never read or written by the browser.
	 */
	#[Setting(
		type: 'string',
		default: '',
		option_key: 'searcio_connect_idempotency_key',
		show_in_rest: false,
		label: 'Connect idempotency key',
		description: 'UUID generated once and replayed on every /connect retry for this site.',
		schema: [ 'format' => 'text-field' ]
	)]
	public const CONNECT_IDEMPOTENCY_KEY = 'connect_idempotency_key';

	/**
	 * When this site last asked Searcio to connect it, as a Unix timestamp.
	 *
	 * The domain-ownership ping arrives a couple of minutes later and is the
	 * only legitimate caller of the public `/verify` route, so this bounds how
	 * long that route will hand the write key out. See {@see \Webhead\WP\SearchCloud\Routing\Verify_Endpoint}.
	 */
	#[Setting(
		type: 'integer',
		default: 0,
		show_in_rest: false,
		label: 'Verification window opened at',
		description: 'Unix timestamp of the last /connect attempt; bounds how long /verify answers.'
	)]
	public const VERIFICATION_OPENED_AT = 'verification_opened_at';

	/**
	 * The one-time code in the `verify_url` this site last sent Searcio, which
	 * the ownership ping has to carry back in the route's path. Only Searcio
	 * was told it, so only Searcio can have the write key read back to it.
	 * Emptied once the ping is answered. See {@see \Webhead\WP\SearchCloud\Routing\Verify_Endpoint}.
	 */
	#[Setting(
		type: 'string',
		default: '',
		show_in_rest: false,
		label: 'Verification code',
		description: 'One-time code in the verify URL sent with the last /connect attempt.',
		schema: [ 'format' => 'text-field' ]
	)]
	public const VERIFICATION_CODE = 'verification_code';

	/**
	 * Set when `/connect` returns `pending_claim` (the admin email already has a
	 * Searcio account) so the Connection tab can keep showing the
	 * "check your inbox" notice across page reloads. Cleared once working
	 * credentials are saved and pass a health check.
	 */
	#[Setting(
		type: 'boolean',
		default: false,
		option_key: 'searcio_connect_pending_claim',
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
		option_key: 'searcio_connect_pending_email',
		show_in_rest: true,
		label: 'Connect pending claim email',
		description: 'The email address the pending-claim confirmation link was sent to.',
		schema: [ 'format' => 'text-field' ]
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
		option_key: 'searcio_index_config',
		show_in_rest: false,
		label: 'Indexing configuration',
		description: 'Per-post-type field mapping pushed to Searcio.'
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
		option_key: 'searcio_config_version',
		show_in_rest: false,
		label: 'Config version',
		description: 'Internal mapping revision used for dirty detection.'
	)]
	public const CONFIG_VERSION = 'config_version';

	/**
	 * Sync-history retention in days. `0` keeps history forever. REST-exposed
	 * so it renders on the generic schema-driven "General" settings tab;
	 * applied by {@see \Webhead\WP\SearchCloud\Sync\Sync_Service::run_scheduled()}
	 * on every scheduled sync (not eagerly on save - see Sync_Service).
	 */
	#[Setting(
		type: 'integer',
		default: 90,
		option_key: 'searcio_sync_retention_days',
		show_in_rest: true,
		label: 'Keep history for (days)',
		description: 'How long finished sync runs are kept. Use 0 to keep them forever.'
	)]
	public const SYNC_RETENTION_DAYS = 'sync_retention_days';

	/**
	 * Local mirror of Searcio's own `search-config.languages`, refreshed
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
		option_key: 'searcio_enabled_languages',
		show_in_rest: false,
		label: 'Enabled languages',
		description: "Local mirror of Searcio's configured languages.",
		schema: [ 'items' => [ 'type' => 'string', 'format' => 'text-field' ] ]
	)]
	public const ENABLED_LANGUAGES = 'enabled_languages';

	/**
	 * Local mirror of Searcio's own `search-config.facet_fields`, refreshed
	 * with the languages above. The search window lays its filters out in this
	 * order; reading it from the service would cost every page that prints the
	 * window a request. Empty until an admin opens Search Config: the window
	 * then keeps the order the search answers with.
	 */
	#[Setting(
		type: 'array',
		default: [],
		option_key: 'searcio_facet_fields',
		show_in_rest: false,
		label: 'Facet fields',
		description: "Local mirror of Searcio's configured facet fields, in their order.",
		schema: [ 'items' => [ 'type' => 'string', 'format' => 'text-field' ] ]
	)]
	public const FACET_FIELDS = 'facet_fields';

	/**
	 * Curated fallback queries shown in the modal's empty-query state until the
	 * Searcio API ships a popular/trending-searches endpoint.
	 */
	#[Setting(
		type: 'array',
		default: [],
		option_key: 'searcio_popular_searches',
		show_in_rest: true,
		label: 'Popular searches',
		description: 'Curated list of queries shown as suggestions before the visitor types anything.',
		schema: [ 'items' => [ 'type' => 'string', 'format' => 'text-field' ] ],
		sanitize_callback: 'plain_text_list'
	)]
	public const POPULAR_SEARCHES = 'popular_searches';

	/**
	 * How the search window's category filter lists the categories, one of
	 * {@see \Webhead\WP\SearchCloud\Enums\Category_Filter}. Drawn on the Search
	 * Config tab beside the facet fields, so not by the schema-driven grid.
	 */
	#[Setting(
		type: 'string',
		default: 'all',
		option_key: 'searcio_category_filter',
		show_in_rest: true,
		label: 'Categories in the filter',
		description: 'All categories in one list, the main categories alone, or the main categories with their subcategories under them.',
		schema: [ 'enum' => [ 'all', 'main', 'nested' ] ]
	)]
	public const CATEGORY_FILTER = 'category_filter';

	/**
	 * How many levels of categories the filter shows when it nests them, the
	 * main categories being the first.
	 */
	#[Setting(
		type: 'integer',
		default: 2,
		option_key: 'searcio_category_filter_depth',
		show_in_rest: true,
		label: 'Category levels',
		description: 'How many levels of categories the filter shows.'
	)]
	public const CATEGORY_FILTER_DEPTH = 'category_filter_depth';

	/**
	 * The order the category filter lists the categories in, one of
	 * {@see \Webhead\WP\SearchCloud\Enums\Category_Order}. Drawn on the Search
	 * Config tab with the other two.
	 */
	#[Setting(
		type: 'string',
		default: 'shop',
		option_key: 'searcio_category_filter_order',
		show_in_rest: true,
		label: 'Category order',
		description: 'The order of the categories in the filter: as sorted in WooCommerce, by name, or by number of products.',
		schema: [ 'enum' => [ 'shop', 'name', 'count' ] ]
	)]
	public const CATEGORY_FILTER_ORDER = 'category_filter_order';

	/**
	 * Where the search is placed without a block or a widget, and how a
	 * shortcode, a classic widget and a site-wide placement look by default
	 * (see {@see \Webhead\WP\SearchCloud\DTO\Placement_Options}). Read and
	 * written through the Placement endpoint, which cleans it, so it is kept
	 * out of the generic settings screen.
	 */
	#[Setting(
		type: 'object',
		default: [],
		option_key: 'searcio_placement',
		show_in_rest: false,
		label: 'Placement',
		description: 'Site-wide search placements and the defaults of the shortcodes and classic widgets.'
	)]
	public const PLACEMENT = 'placement';

	/**
	 * Opt-in uninstall policy, read by {@see \Webhead\WP\SearchCloud\Plugin::configure_uninstall()}.
	 * Off by default: uninstalling the plugin keeps its settings, tables, and
	 * per-post sync metadata untouched. Turning this on only affects data
	 * stored in this WordPress site; it never deletes documents already sent
	 * to Searcio.
	 */
	#[Setting(
		type: 'boolean',
		default: false,
		option_key: 'searcio_delete_data_on_uninstall',
		show_in_rest: true,
		label: 'Delete plugin data on uninstall',
		description: 'When enabled, deleting this plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Searcio.'
	)]
	public const DELETE_DATA_ON_UNINSTALL = 'delete_data_on_uninstall';

	/**
	 * Whether the search window shows the Searcio logo, linked to searcio.com.
	 * Off until the shop turns it on, on every plan: a credit on a shop's pages
	 * is the shop's choice (WordPress.org plugin guideline 10), and no plan may
	 * take that choice away (guideline 5). The General tab draws it in a card
	 * of its own, so it is not one of the settings the schema-driven grid
	 * renders.
	 */
	#[Setting(
		type: 'boolean',
		default: false,
		option_key: 'searcio_support_searcio',
		show_in_rest: true,
		label: 'Support Searcio',
		description: 'Show the Searcio logo, linked to searcio.com, in the search window.'
	)]
	public const SUPPORT_SEARCIO = 'support_searcio';

	/**
	 * The plan tier Searcio last named in `/health`, `free` or `paid`, so a
	 * storefront page can tell without asking the service. Empty until the
	 * first health check after connecting, and again after disconnecting.
	 * Written by {@see \Webhead\WP\SearchCloud\Connection\Connection_State::remember_plan()}.
	 */
	#[Setting(
		type: 'string',
		default: '',
		option_key: 'searcio_plan_tier',
		show_in_rest: false,
		label: 'Plan tier',
		description: 'Local mirror of the Searcio plan tier.',
		schema: [ 'enum' => [ '', 'free', 'paid' ] ]
	)]
	public const PLAN_TIER = 'plan_tier';

	/**
	 * Translated label/description overrides for settings that render on the
	 * generic schema-driven "General" tab. `#[Setting(label: ..., description:
	 * ...)]` arguments must be compile-time constant expressions, so they can
	 * never be wrapped in `__()` at the point where they're declared above -
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
				'label'       => __( 'Keep history for (days)', 'searcio' ),
				'description' => __( 'How long finished sync runs are kept. Use 0 to keep them forever.', 'searcio' ),
			],
			self::DELETE_DATA_ON_UNINSTALL => [
				'label'       => __( 'Delete plugin data on uninstall', 'searcio' ),
				'description' => __( 'When enabled, deleting this plugin also removes its settings, sync tables, and per-post sync metadata from this site. It never deletes documents already sent to Searcio.', 'searcio' ),
			],
		];
	}

	/**
	 * The items of a list of text as they were typed. The schema's text-field
	 * sanitizing writes a "<" with no ">" after it, and every "&" behind it, as
	 * entities, so "Kabel <2m" was kept as "Kabel &lt;2m", which the admin read
	 * in the field and the search window searched for. Every reader of such a
	 * list prints it as text.
	 *
	 * @return array<int,string>
	 */
	public static function plain_text_list( mixed $value ): array {
		return array_values(
			array_map(
				static fn ( mixed $item ): string => Term_Names::decode( (string) $item ),
				array_filter( is_array( $value ) ? $value : [], 'is_scalar' )
			)
		);
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
		$salt = function_exists( 'wp_salt' ) ? wp_salt( 'secure_auth' ) : ( defined( 'SECURE_AUTH_SALT' ) ? SECURE_AUTH_SALT : self::ENCRYPTION_CONTEXT );

		return hash( 'sha256', self::ENCRYPTION_CONTEXT . '|' . $salt, true );
	}
}
