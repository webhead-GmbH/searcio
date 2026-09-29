<?php
/**
 * Plugin.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Foundation\Plugin as Base_Plugin;
use Webhead\WP\SearchCloud\Dependencies\League\Container\Container;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Admin\Page_Registry;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Blocks\Blocks_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Capabilities\Capability_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Database_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Diagnostics_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Health_Result;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Site_Health_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Hooks\Hooks_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Jobs\Jobs_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Jobs\Job_Definition;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Lifecycle\Uninstall_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Lifecycle\Upgrade_Runner;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Cache_Manager;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps\Delete_Legacy_Site_Id_Option;
use Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps\Delete_Legacy_Sync_Options;
use Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps\Resync_Capabilities;
use Webhead\WP\SearchCloud\Jobs\Scheduled_Sync_Job;
use Webhead\WP\SearchCloud\Jobs\Sync_Tick_Job;
use Webhead\WP\SearchCloud\Jobs\Change_Drain_Job;
use Webhead\WP\SearchCloud\Admin\Settings_Page;
use Webhead\WP\SearchCloud\Admin\Rtl_Style_Fix;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Database\Tables\Sync_Runs_Table;
use Webhead\WP\SearchCloud\Database\Tables\Change_Queue_Table;
use Webhead\WP\SearchCloud\Routing\Connection_Endpoint;
use Webhead\WP\SearchCloud\Routing\Verify_Endpoint;
use Webhead\WP\SearchCloud\Routing\Indexing_Endpoint;
use Webhead\WP\SearchCloud\Routing\Sync_Endpoint;
use Webhead\WP\SearchCloud\Routing\Settings_Endpoint;
use Webhead\WP\SearchCloud\Routing\Cache_Endpoint;
use Webhead\WP\SearchCloud\Routing\Search_Config_Endpoint;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Indexing\Field_Source_Resolver;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Compatibility\Woo_Compatibility;
use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Sync\Sync_State;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Sync\Dirty_Tracker;
use Webhead\WP\SearchCloud\Sync\Failed_Deletes;
use Webhead\WP\SearchCloud\Sync\Change_Listener;
use Webhead\WP\SearchCloud\Sync\Incremental_Service;
use Webhead\WP\SearchCloud\WP_CLI\Sync_Command;
use Webhead\WP\SearchCloud\WP_CLI\Command_Registrar;
use Webhead\WP\SearchCloud\Frontend\Frontend_Assets;
use Webhead\WP\SearchCloud\Frontend\Elementor_Widget;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Plugin extends Base_Plugin {
	protected function register_capabilities( Capability_Manager $capability_manager, Container $container ): void {
		$capability_manager->register_provider( Plugin_Capabilities::class );
	}

	protected function register_settings( Settings_Manager $settings_manager, Container $container ): void {
		$settings_manager->register_provider( Plugin_Settings::class );
	}

	/**
	 * `Capability_Manager::sync()` only adds capabilities, never removes stale
	 * ones, so replaying it here is safe. Resyncs the {@see Plugin_Capabilities::VIEW}
	 * / {@see Plugin_Capabilities::RUN_SYNC} split onto sites that activated
	 * before that split existed.
	 */
	protected function register_upgrade_steps( Upgrade_Runner $upgrade_runner, Container $container ): void {
		$upgrade_runner->register( new Resync_Capabilities( $container->get( 'capability_manager' ) ) );
		$upgrade_runner->register( new Delete_Legacy_Site_Id_Option() );
		$upgrade_runner->register( new Delete_Legacy_Sync_Options() );
	}

	protected function register_jobs( Jobs_Manager $jobs_manager, Container $container ): void {
		$jobs_manager->register_provider( $container->get( 'scheduled_sync_job' ) );

		// One-off, self-rescheduling job: sync service drives the cadence via
		// Jobs_Manager::schedule_single(), framework owns the lock.
		$jobs_manager->register(
			Job_Definition::one_off(
				hook: Sync_Keys::HOOK_TICK,
				callback: $container->get( 'sync_tick_job' ),
				use_lock: true,
				lock_ttl: 600
			)
		);

		// Same one-off, lock-aware pattern as the full-sync tick.
		$jobs_manager->register(
			Job_Definition::one_off(
				hook: Sync_Keys::HOOK_DRAIN,
				callback: $container->get( 'change_drain_job' ),
				use_lock: true,
				lock_ttl: 300
			)
		);
	}

	protected function register_service_providers( Container $container ): void {
		$container->add(
			'settings_page',
			static function () use ( $container ): Settings_Page {
				return new Settings_Page(
					$container->get( 'search_cloud_client' ),
					$container->get( 'connection_state' )
				);
			}
		);
		$container->add(
			'settings_endpoint',
			static function () use ( $container ): Settings_Endpoint {
				return new Settings_Endpoint( $container->get( Settings_Manager::class ) );
			}
		);
		$container->add(
			'search_cloud_client',
			static function () use ( $container ): Search_Cloud_Client {
				return new Search_Cloud_Client(
					$container->get( Settings_Manager::class ),
					$container->get( Cache_Manager::class )
				);
			}
		);
		$container->add(
			'connection_state',
			static function () use ( $container ): Connection_State {
				return new Connection_State( $container->get( Settings_Manager::class ) );
			}
		);
		$container->add( 'woo', Woo::class );
		$container->add(
			'connection_endpoint',
			static function () use ( $container ): Connection_Endpoint {
				return new Connection_Endpoint(
					$container->get( 'search_cloud_client' ),
					$container->get( 'connection_state' ),
					$container->get( 'woo' )
				);
			}
		);
		$container->add(
			'verify_endpoint',
			static function () use ( $container ): Verify_Endpoint {
				return new Verify_Endpoint(
					$container->get( 'search_cloud_client' ),
					$container->get( 'connection_state' )
				);
			}
		);
		$container->add( 'field_source_resolver', Field_Source_Resolver::class );
		$container->add(
			'multilingual_support',
			static function () use ( $container ): Multilingual_Support {
				return new Multilingual_Support( $container->get( 'compatibility_manager' ) );
			}
		);
		$container->add(
			'language_config',
			static function () use ( $container ): Language_Config {
				return new Language_Config( $container->get( Settings_Manager::class ) );
			}
		);
		$container->add(
			'index_config',
			static function () use ( $container ): Index_Config {
				return new Index_Config(
					$container->get( Settings_Manager::class ),
					$container->get( 'woo' ),
					$container->get( 'multilingual_support' )
				);
			}
		);
		$container->add(
			'document_builder',
			static function () use ( $container ): Document_Builder {
				return new Document_Builder(
					$container->get( 'index_config' ),
					$container->get( 'field_source_resolver' ),
					$container->get( 'woo' ),
					$container->get( 'multilingual_support' ),
					$container->get( 'language_config' )
				);
			}
		);
		$container->add(
			'indexing_endpoint',
			static function () use ( $container ): Indexing_Endpoint {
				return new Indexing_Endpoint( $container->get( 'index_config' ) );
			}
		);
		$container->add(
			'woo_compatibility',
			static function () use ( $container ): Woo_Compatibility {
				return new Woo_Compatibility( $container->get( 'woo' ) );
			}
		);
		$container->add( 'sync_runs_table', Sync_Runs_Table::class );
		$container->add( 'change_queue_table', Change_Queue_Table::class );
		$container->add( 'dirty_tracker', Dirty_Tracker::class );
		$container->add( 'failed_deletes', Failed_Deletes::class );
		$container->add(
			'sync_state',
			static function () use ( $container ): Sync_State {
				return new Sync_State( $container->get( 'sync_runs_table' ) );
			}
		);
		$container->add(
			'sync_service',
			static function () use ( $container ): Sync_Service {
				return new Sync_Service(
					$container->get( 'index_config' ),
					$container->get( 'document_builder' ),
					$container->get( 'search_cloud_client' ),
					$container->get( 'sync_state' ),
					$container->get( 'dirty_tracker' ),
					$container->get( 'failed_deletes' ),
					$container->get( Jobs_Manager::class ),
					$container->get( Settings_Manager::class )
				);
			}
		);
		$container->add(
			'incremental_service',
			static function () use ( $container ): Incremental_Service {
				return new Incremental_Service(
					$container->get( 'index_config' ),
					$container->get( 'document_builder' ),
					$container->get( 'search_cloud_client' ),
					$container->get( 'dirty_tracker' ),
					$container->get( 'failed_deletes' ),
					$container->get( 'change_queue_table' ),
					$container->get( 'sync_state' ),
					$container->get( Jobs_Manager::class )
				);
			}
		);
		$container->add(
			'change_listener',
			static function () use ( $container ): Change_Listener {
				return new Change_Listener(
					$container->get( 'index_config' ),
					$container->get( 'document_builder' ),
					$container->get( 'dirty_tracker' ),
					$container->get( 'change_queue_table' ),
					$container->get( Jobs_Manager::class )
				);
			}
		);
		$container->add(
			'change_drain_job',
			static function () use ( $container ): Change_Drain_Job {
				return new Change_Drain_Job( $container->get( 'incremental_service' ) );
			}
		);
		$container->add(
			'scheduled_sync_job',
			static function () use ( $container ): Scheduled_Sync_Job {
				return new Scheduled_Sync_Job( $container->get( 'sync_service' ) );
			}
		);
		$container->add(
			'sync_tick_job',
			static function () use ( $container ): Sync_Tick_Job {
				return new Sync_Tick_Job( $container->get( 'sync_service' ) );
			}
		);
		$container->add(
			'sync_endpoint',
			static function () use ( $container ): Sync_Endpoint {
				return new Sync_Endpoint( $container->get( 'sync_service' ), $container->get( 'sync_state' ) );
			}
		);
		$container->add(
			'cache_endpoint',
			static function () use ( $container ): Cache_Endpoint {
				return new Cache_Endpoint( $container->get( Cache_Manager::class ) );
			}
		);
		$container->add(
			'search_config_endpoint',
			static function () use ( $container ): Search_Config_Endpoint {
				return new Search_Config_Endpoint(
					$container->get( 'search_cloud_client' ),
					$container->get( 'language_config' )
				);
			}
		);
		$container->add(
			'sync_command',
			static function () use ( $container ): Sync_Command {
				return new Sync_Command( $container->get( 'sync_service' ), $container->get( 'sync_state' ) );
			}
		);
		$container->add(
			'command_registrar',
			static function () use ( $container ): Command_Registrar {
				return new Command_Registrar( $container->get( 'sync_command' ) );
			}
		);
		$container->add(
			'frontend_assets',
			static function () use ( $container ): Frontend_Assets {
				return new Frontend_Assets(
					$container->get( Settings_Manager::class ),
					$container->get( 'index_config' ),
					$container->get( 'language' ),
					$container->get( 'language_config' )
				);
			}
		);
		$container->add( 'elementor_widget', Elementor_Widget::class );
		$container->add( 'admin_rtl_style_fix', Rtl_Style_Fix::class );
	}

	protected function register_admin_pages( Page_Registry $page_registry, Container $container ): void {
		$page_registry->add( $container->get( 'settings_page' ) );
	}

	protected function register_hooks( Hooks_Manager $hooks_manager, Container $container ): void {
		$hooks_manager->register( $container->get( 'settings_endpoint' ) );
		$hooks_manager->register( $container->get( 'connection_endpoint' ) );
		$hooks_manager->register( $container->get( 'verify_endpoint' ) );
		$hooks_manager->register( $container->get( 'indexing_endpoint' ) );
		$hooks_manager->register( $container->get( 'woo_compatibility' ) );
		$hooks_manager->register( $container->get( 'sync_endpoint' ) );
		$hooks_manager->register( $container->get( 'cache_endpoint' ) );
		$hooks_manager->register( $container->get( 'search_config_endpoint' ) );
		$hooks_manager->register( $container->get( 'command_registrar' ) );
		$hooks_manager->register( $container->get( 'change_listener' ) );
		$hooks_manager->register( $container->get( 'frontend_assets' ) );
		$hooks_manager->register( $container->get( 'elementor_widget' ) );
		$hooks_manager->register( $container->get( 'admin_rtl_style_fix' ) );
	}

	protected function register_tables( Database_Manager $database_manager, Container $container ): void {
		$database_manager->register_table( $container->get( 'sync_runs_table' ) );
		$database_manager->register_table( $container->get( 'change_queue_table' ) );
	}

	protected function register_blocks( Blocks_Manager $blocks_manager, Container $container ): void {
		$blocks_manager->register_metadata_directory( \Webhead\WP\SearchCloud\PLUGIN_DIR . 'blocks/search' );
		$blocks_manager->register_metadata_directory( \Webhead\WP\SearchCloud\PLUGIN_DIR . 'blocks/products' );
	}

	/**
	 * Default policy is "keep data", so uninstalling with the opt-in setting
	 * off touches nothing registered here. Turning it on removes this plugin's
	 * tables, options, and per-post metadata locally; it never calls the
	 * Search Cloud API, so already-synced documents remain in the remote index.
	 */
	protected function configure_uninstall( Uninstall_Manager $uninstall_manager, Container $container ): void {
		$settings_manager = $container->get( Settings_Manager::class );
		$delete_data      = (bool) $settings_manager->get( Plugin_Settings::DELETE_DATA_ON_UNINSTALL );

		$uninstall_manager->set_policy(
			$delete_data ? Uninstall_Manager::POLICY_DELETE_DATA : Uninstall_Manager::POLICY_KEEP_DATA
		);

		$uninstall_manager->register_cleanup(
			'webhead_search_cloud_scheduled_hooks',
			static function (): void {
				wp_clear_scheduled_hook( Sync_Keys::HOOK_TICK );
				wp_clear_scheduled_hook( Sync_Keys::HOOK_DRAIN );
			},
			Uninstall_Manager::GROUP_CACHE
		);

		$uninstall_manager->register_cleanup(
			'webhead_search_cloud_sync_options',
			static function (): void {
				delete_option( Sync_Keys::OPTION_SNAPSHOT );
				delete_option( Sync_Keys::OPTION_SEEN );
				delete_option( Sync_Keys::OPTION_PRUNE );
				delete_option( Sync_Keys::OPTION_FAILED_DELETES );
			},
			Uninstall_Manager::GROUP_DATA
		);

		/*
		 * Options the plugin no longer reads but that older installs still
		 * carry: the pre-key-relative `SITE_ID`, and the standalone sync and
		 * onboarding progress keys the current engine replaced. Upgrade steps
		 * remove these, but a site uninstalled without ever reactivating never
		 * runs an upgrade step — so the opt-in "delete my data" path clears them
		 * too. Framework settings cleanup doesn't know about them.
		 */
		$uninstall_manager->register_cleanup(
			'webhead_search_cloud_legacy_options',
			static function (): void {
				delete_option( 'webhead_search_cloud_site_id' );
				delete_option( 'webhead_search_cloud_site_id_metadata' );

				Delete_Legacy_Sync_Options::delete();
			},
			Uninstall_Manager::GROUP_DATA
		);

		$uninstall_manager->register_metadata_cleanup(
			$this->get_database_manager(),
			'post',
			[ Sync_Keys::META_SYNCED_AT, Sync_Keys::META_DOC_HASH, Sync_Keys::META_CONFIG_VER ],
			'webhead_search_cloud_post_meta'
		);

		$uninstall_manager->register_database_tables_cleanup(
			$this->get_database_manager(),
			'webhead_search_cloud_tables'
		);
	}

	/**
	 * Reachability is an async REST test, not a direct test, so it only makes
	 * a live HTTP call when a user opens the Site Health page.
	 */
	protected function register_health_tests( Site_Health_Manager $site_health_manager, Container $container ): void {
		$site_health_manager->register_direct_test(
			'webhead_search_cloud_connection_configured',
			__( 'webhead Search Cloud connection', 'webhead-search-cloud' ),
			function () use ( $container ): array {
				if ( ! $container->get( 'search_cloud_client' )->is_configured() ) {
					return Health_Result::recommended(
						test: 'webhead_search_cloud_connection_configured',
						label: __( 'webhead Search Cloud is not connected yet', 'webhead-search-cloud' ),
						badge_label: 'Search Cloud',
						description: '<p>' . esc_html__( 'Add your site ID, write key, and write secret on the Connection tab before syncing content.', 'webhead-search-cloud' ) . '</p>'
					)->to_wordpress_result();
				}

				return Health_Result::good(
					test: 'webhead_search_cloud_connection_configured',
					label: __( 'webhead Search Cloud connection is configured', 'webhead-search-cloud' ),
					badge_label: 'Search Cloud',
					description: '<p>' . esc_html__( 'Connection credentials are saved.', 'webhead-search-cloud' ) . '</p>'
				)->to_wordpress_result();
			}
		);

		$site_health_manager->register_async_rest_test(
			'webhead_search_cloud_connection_reachable',
			__( 'webhead Search Cloud reachability', 'webhead-search-cloud' ),
			function () use ( $container ): array {
				$client = $container->get( 'search_cloud_client' );

				if ( ! $client->is_configured() ) {
					return Health_Result::recommended(
						test: 'webhead_search_cloud_connection_reachable',
						label: __( 'webhead Search Cloud is not connected yet', 'webhead-search-cloud' ),
						badge_label: 'Search Cloud',
						description: '<p>' . esc_html__( 'Connect the plugin on the Connection tab, then re-run this check.', 'webhead-search-cloud' ) . '</p>'
					)->to_wordpress_result();
				}

				$response = $client->health();

				if ( $response->transport_error || ! $response->ok() ) {
					return Health_Result::critical(
						test: 'webhead_search_cloud_connection_reachable',
						label: __( 'webhead Search Cloud could not be reached', 'webhead-search-cloud' ),
						badge_label: 'Search Cloud',
						description: '<p>' . esc_html__( 'The health check to Search Cloud failed. Check the Connection tab and verify your credentials.', 'webhead-search-cloud' ) . '</p>'
					)->to_wordpress_result();
				}

				return Health_Result::good(
					test: 'webhead_search_cloud_connection_reachable',
					label: __( 'webhead Search Cloud is reachable', 'webhead-search-cloud' ),
					badge_label: 'Search Cloud',
					description: '<p>' . esc_html__( 'The last health check succeeded.', 'webhead-search-cloud' ) . '</p>'
				)->to_wordpress_result();
			}
		);

		$site_health_manager->register_direct_test(
			'webhead_search_cloud_indexing_configured',
			__( 'webhead Search Cloud indexing', 'webhead-search-cloud' ),
			function () use ( $container ): array {
				$indexable = $container->get( 'index_config' )->indexable_post_types();

				if ( [] === $indexable ) {
					return Health_Result::recommended(
						test: 'webhead_search_cloud_indexing_configured',
						label: __( 'No content types are enabled for indexing', 'webhead-search-cloud' ),
						badge_label: 'Search Cloud',
						description: '<p>' . esc_html__( 'Enable at least one post type or WooCommerce products on the Indexing tab so sync has something to send.', 'webhead-search-cloud' ) . '</p>'
					)->to_wordpress_result();
				}

				return Health_Result::good(
					test: 'webhead_search_cloud_indexing_configured',
					label: __( 'Content types are enabled for indexing', 'webhead-search-cloud' ),
					badge_label: 'Search Cloud',
					description: sprintf(
						/* translators: %d: number of enabled content types. */
						'<p>' . esc_html__( '%d content type(s) are enabled for indexing.', 'webhead-search-cloud' ) . '</p>',
						count( $indexable )
					)
				)->to_wordpress_result();
			}
		);

		// Surface content left out of the index by language restriction instead
		// of letting it go silently missing.
		$site_health_manager->register_direct_test(
			'webhead_search_cloud_language_coverage',
			__( 'webhead Search Cloud language coverage', 'webhead-search-cloud' ),
			function () use ( $container ): array {
				$history = $container->get( 'sync_state' )->history(
					[ 'per_page' => 1, 'order_by' => 'id', 'order' => 'desc' ]
				);
				$skipped = (int) ( $history['items'][0]['language_skipped'] ?? 0 );

				if ( $skipped > 0 ) {
					return Health_Result::recommended(
						test: 'webhead_search_cloud_language_coverage',
						label: sprintf(
							/* translators: %d: number of posts skipped. */
							__( '%d post(s) were skipped from the last sync due to language', 'webhead-search-cloud' ),
							$skipped
						),
						badge_label: 'Search Cloud',
						description: '<p>' . esc_html__( "These posts are in a language that isn't enabled on the Search Config tab. Enable their language there, or leave them out of search intentionally.", 'webhead-search-cloud' ) . '</p>'
					)->to_wordpress_result();
				}

				return Health_Result::good(
					test: 'webhead_search_cloud_language_coverage',
					label: __( 'No content was skipped due to language', 'webhead-search-cloud' ),
					badge_label: 'Search Cloud',
					description: '<p>' . esc_html__( 'Every indexable post is in an enabled language, or the site has not restricted languages.', 'webhead-search-cloud' ) . '</p>'
				)->to_wordpress_result();
			}
		);
	}

	/**
	 * Support/debug fields only; write key, write secret, and search key are
	 * deliberately never added here.
	 */
	protected function register_diagnostics( Diagnostics_Manager $diagnostics_manager, Container $container ): void {
		$section_id = 'webhead-search-cloud-runtime';

		$diagnostics_manager->register_section(
			$section_id,
			__( 'webhead Search Cloud runtime', 'webhead-search-cloud' ),
			__( 'Connection, indexing, and sync state for support and debugging. Credentials are never included.', 'webhead-search-cloud' ),
			true
		);

		$client       = $container->get( 'search_cloud_client' );
		$index_config = $container->get( 'index_config' );
		$sync_service = $container->get( 'sync_service' );
		$settings     = $container->get( Settings_Manager::class );
		$status       = $sync_service->status();

		$diagnostics_manager->add_field( $section_id, 'connection_configured', __( 'Connection configured', 'webhead-search-cloud' ), $client->is_configured() );
		$diagnostics_manager->add_field( $section_id, 'indexable_post_types', __( 'Indexable content types', 'webhead-search-cloud' ), $index_config->indexable_post_types() );
		$diagnostics_manager->add_field( $section_id, 'sync_retention_days', __( 'Sync history retention (days)', 'webhead-search-cloud' ), (int) $settings->get( Plugin_Settings::SYNC_RETENTION_DAYS ) );
		$diagnostics_manager->add_field( $section_id, 'active_sync_status', __( 'Active sync run status', 'webhead-search-cloud' ), $status['active']['status'] ?? null );
		$diagnostics_manager->add_field( $section_id, 'delete_data_on_uninstall', __( 'Delete data on uninstall', 'webhead-search-cloud' ), (bool) $settings->get( Plugin_Settings::DELETE_DATA_ON_UNINSTALL ) );

		$multilingual = $container->get( 'multilingual_support' );

		$diagnostics_manager->add_field( $section_id, 'multilingual_active', __( 'WPML/Polylang active', 'webhead-search-cloud' ), $multilingual->is_active() );
		$diagnostics_manager->add_field( $section_id, 'enabled_languages', __( 'Enabled languages', 'webhead-search-cloud' ), $container->get( 'language_config' )->enabled_languages() );
	}

}
