<?php
/**
 * Site Health tests and diagnostics register at boot and translate nothing
 * until Site Health is opened.
 *
 * The plugin boots on `plugins_loaded`, on every request of the site. WordPress
 * 6.7+ reports any translation looked up before `after_setup_theme` with
 * `_doing_it_wrong( '_load_textdomain_just_in_time' )`, and a translation
 * looked up on `init` instead loads the text domain from disk on every
 * front-end page, for labels only the Site Health screen ever shows.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Health;

use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Health\Health_Tests;
use Webhead\WP\SearchCloud\Health\Runtime_Diagnostics;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Site_Health_Registration_Test extends Integration_Test_Case {
	private const DOMAIN = 'searcio';

	/**
	 * The suite booted the plugin during its bootstrap, before any test could
	 * listen, so this boots it again under the conditions of a real
	 * `plugins_loaded`. The hooks that boot attaches are discarded when the test
	 * tears down.
	 */
	public function test_booting_before_init_translates_nothing(): void {
		global $wp_actions, $l10n, $l10n_unloaded;

		$saved_actions  = $wp_actions;
		$saved_l10n     = $l10n;
		$saved_unloaded = $l10n_unloaded;
		$translated     = [];

		foreach ( [ 'gettext', 'gettext_with_context', 'ngettext', 'ngettext_with_context' ] as $filter ) {
			add_filter(
				$filter . '_' . self::DOMAIN,
				static function ( $translation, $text ) use ( &$translated ) {
					$translated[] = $text;

					return $translation;
				},
				10,
				2
			);
		}

		// The suite loads the plugin by hand, so WordPress never registered its
		// Domain Path the way it does for an active plugin. Without a path the
		// just-in-time loader bails out before it can report anything.
		add_filter(
			'lang_dir_for_domain',
			static fn ( $path, string $domain ) => self::DOMAIN === $domain
				? \Webhead\WP\SearchCloud\PLUGIN_DIR . 'languages/'
				: $path,
			10,
			2
		);

		unset( $wp_actions['after_setup_theme'], $wp_actions['init'], $l10n[ self::DOMAIN ], $l10n_unloaded[ self::DOMAIN ] );

		try {
			Plugin::forget_boot_state( Plugin::class );
			new Plugin();
		} finally {
			$wp_actions    = $saved_actions;
			$l10n          = $saved_l10n;
			$l10n_unloaded = $saved_unloaded;
		}

		$this->assertArrayNotHasKey( '_load_textdomain_just_in_time', $this->caught_doing_it_wrong );
		$this->assertSame( [], $translated, 'The plugin translated strings while it booted.' );
	}

	/**
	 * `init` runs on every request. Neither class may wait there to translate
	 * its labels: that is a text domain loaded for every visitor.
	 */
	public function test_nothing_waits_on_init_to_register(): void {
		global $wp_filter;

		$waiting = [];

		foreach ( $wp_filter['init']->callbacks ?? [] as $callbacks ) {
			foreach ( $callbacks as $callback ) {
				$object = is_array( $callback['function'] ) ? $callback['function'][0] : null;

				if ( $object instanceof Health_Tests || $object instanceof Runtime_Diagnostics ) {
					$waiting[] = $object::class;
				}
			}
		}

		$this->assertSame( [], $waiting );
	}

	public function test_the_names_are_translated_when_site_health_asks_for_them(): void {
		add_filter( 'gettext_' . self::DOMAIN, static fn ( string $translation, string $text ): string => 'DE: ' . $text, 10, 2 );

		$tests   = apply_filters( 'site_status_tests', [ 'direct' => [], 'async' => [] ] );
		$section = apply_filters( 'debug_information', [] )[ Runtime_Diagnostics::SECTION_ID ] ?? [];

		$this->assertSame( 'DE: webhead Search Cloud connection', $tests['direct']['webhead_search_cloud_connection_configured']['label'] ?? null );
		$this->assertSame( 'DE: webhead Search Cloud reachability', $tests['async']['webhead_search_cloud_connection_reachable']['label'] ?? null );
		$this->assertSame( 'DE: webhead Search Cloud runtime', $section['label'] ?? null );
		$this->assertStringStartsWith( 'DE: Connection, indexing', $section['description'] ?? '' );
		$this->assertSame( 'DE: Connection configured', $section['fields']['connection_configured']['label'] ?? null );
	}

	public function test_the_health_tests_are_registered_with_their_labels(): void {
		$tests = apply_filters( 'site_status_tests', [ 'direct' => [], 'async' => [] ] );

		$this->assertSame( 'webhead Search Cloud connection', $tests['direct']['webhead_search_cloud_connection_configured']['label'] ?? null );
		$this->assertSame( 'webhead Search Cloud indexing', $tests['direct']['webhead_search_cloud_indexing_configured']['label'] ?? null );
		$this->assertSame( 'webhead Search Cloud language coverage', $tests['direct']['webhead_search_cloud_language_coverage']['label'] ?? null );
		$this->assertSame( 'webhead Search Cloud reachability', $tests['async']['webhead_search_cloud_connection_reachable']['label'] ?? null );
	}

	/** Values are read when Site Health Info is built, not when the section is registered. */
	public function test_the_diagnostics_section_reads_its_values_when_built(): void {
		$this->settings()->delete( Plugin_Settings::WRITE_KEY );
		$this->settings()->delete( Plugin_Settings::WRITE_SECRET );

		$section = apply_filters( 'debug_information', [] )[ Runtime_Diagnostics::SECTION_ID ] ?? [];

		$this->assertSame( 'webhead Search Cloud runtime', $section['label'] ?? null );
		$this->assertSame(
			[
				'connection_configured',
				'indexable_post_types',
				'sync_retention_days',
				'active_sync_status',
				'delete_data_on_uninstall',
				'multilingual_active',
				'enabled_languages',
			],
			array_keys( $section['fields'] ?? [] )
		);
		$this->assertSame( 'Connection configured', $section['fields']['connection_configured']['label'] );
		$this->assertSame( 'No', $section['fields']['connection_configured']['value'] );

		$this->connect_client();

		$section = apply_filters( 'debug_information', [] )[ Runtime_Diagnostics::SECTION_ID ];

		$this->assertSame( 'Yes', $section['fields']['connection_configured']['value'] );
	}
}
