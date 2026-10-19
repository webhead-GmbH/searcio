<?php
/**
 * Site Health Info section.
 *
 * Registered while the plugin boots, like {@see Health_Tests}, and for the
 * same reason it translates nothing and reads nothing there: the fields are
 * handed over as a callback the framework calls when the section is read, and
 * the section's own heading is put into the reader's language just before
 * WordPress builds the screen.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Health;

use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Diagnostics_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * Support/debug fields only; write key, write secret, and search key are
 * deliberately never added here.
 *
 * @since 1.1.0
 */
final class Runtime_Diagnostics {
	public const SECTION_ID = 'webhead-search-cloud-runtime';

	public function __construct(
		private Diagnostics_Manager $diagnostics_manager,
		private Search_Cloud_Client $client,
		private Index_Config $index_config,
		private Sync_Service $sync_service,
		private Settings_Manager $settings,
		private Multilingual_Support $multilingual,
		private Language_Config $language_config
	) {}

	/**
	 * The fields are a callback, called only when Site Health Info or the
	 * `health` WP-CLI command reads the section, so the reads behind them - the
	 * sync status is a database query - and their translated labels cost
	 * nothing on the requests that never show it.
	 */
	public function register(): void {
		$this->diagnostics_manager->register_section(
			self::SECTION_ID,
			'webhead Search Cloud runtime',
			'Connection, indexing, and sync state for support and debugging. Credentials are never included.',
			true
		);

		$this->diagnostics_manager->add_deferred_fields(
			self::SECTION_ID,
			fn (): array => [
				'connection_configured'    => [ __( 'Connection configured', 'webhead-search-cloud' ), $this->client->is_configured() ],
				'indexable_post_types'     => [ __( 'Indexable content types', 'webhead-search-cloud' ), $this->index_config->indexable_post_types() ],
				'sync_retention_days'      => [ __( 'Sync history retention (days)', 'webhead-search-cloud' ), (int) $this->settings->get( Plugin_Settings::SYNC_RETENTION_DAYS ) ],
				'active_sync_status'       => [ __( 'Active sync run status', 'webhead-search-cloud' ), $this->sync_service->status()['active']['status'] ?? null ],
				'delete_data_on_uninstall' => [ __( 'Delete data on uninstall', 'webhead-search-cloud' ), (bool) $this->settings->get( Plugin_Settings::DELETE_DATA_ON_UNINSTALL ) ],
				'multilingual_active'      => [ __( 'WPML/Polylang active', 'webhead-search-cloud' ), $this->multilingual->is_active() ],
				'enabled_languages'        => [ __( 'Enabled languages', 'webhead-search-cloud' ), $this->language_config->enabled_languages() ],
			]
		);
	}

	/**
	 * Before the framework hands its sections to WordPress (priority 10).
	 * Registering a section again replaces its heading and keeps its fields.
	 *
	 * @param  array<string,mixed>  $info
	 * @return array<string,mixed>
	 */
	#[Filter( 'debug_information', priority: 9 )]
	public function translate_section( array $info ): array {
		$this->diagnostics_manager->register_section(
			self::SECTION_ID,
			__( 'webhead Search Cloud runtime', 'webhead-search-cloud' ),
			__( 'Connection, indexing, and sync state for support and debugging. Credentials are never included.', 'webhead-search-cloud' ),
			true
		);

		return $info;
	}
}
