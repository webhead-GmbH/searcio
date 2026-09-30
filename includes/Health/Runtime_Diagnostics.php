<?php
/**
 * Site Health Info section.
 *
 * Registered on `init` for the same reason as {@see Health_Tests}: the section
 * and field labels are translated, and the framework captures them as strings
 * when they are registered, which it would otherwise do on `plugins_loaded`.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Health;

use Closure;
use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;
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
	 * Values are closures, resolved only when Site Health Info is built, so the
	 * reads behind them — the sync status is a database query — cost nothing on
	 * the requests that never show it.
	 */
	#[Action( 'init' )]
	public function register(): void {
		$this->diagnostics_manager->register_section(
			self::SECTION_ID,
			__( 'webhead Search Cloud runtime', 'webhead-search-cloud' ),
			__( 'Connection, indexing, and sync state for support and debugging. Credentials are never included.', 'webhead-search-cloud' ),
			true
		);

		$this->add_field( 'connection_configured', __( 'Connection configured', 'webhead-search-cloud' ), fn (): bool => $this->client->is_configured() );
		$this->add_field( 'indexable_post_types', __( 'Indexable content types', 'webhead-search-cloud' ), fn (): array => $this->index_config->indexable_post_types() );
		$this->add_field( 'sync_retention_days', __( 'Sync history retention (days)', 'webhead-search-cloud' ), fn (): int => (int) $this->settings->get( Plugin_Settings::SYNC_RETENTION_DAYS ) );
		$this->add_field( 'active_sync_status', __( 'Active sync run status', 'webhead-search-cloud' ), fn (): mixed => $this->sync_service->status()['active']['status'] ?? null );
		$this->add_field( 'delete_data_on_uninstall', __( 'Delete data on uninstall', 'webhead-search-cloud' ), fn (): bool => (bool) $this->settings->get( Plugin_Settings::DELETE_DATA_ON_UNINSTALL ) );
		$this->add_field( 'multilingual_active', __( 'WPML/Polylang active', 'webhead-search-cloud' ), fn (): bool => $this->multilingual->is_active() );
		$this->add_field( 'enabled_languages', __( 'Enabled languages', 'webhead-search-cloud' ), fn (): array => $this->language_config->enabled_languages() );
	}

	private function add_field( string $field_id, string $label, Closure $value ): void {
		$this->diagnostics_manager->add_field( self::SECTION_ID, $field_id, $label, $value );
	}
}
