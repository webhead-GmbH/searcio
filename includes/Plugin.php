<?php
/**
 * Plugin.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud;

// Ahead of the imports: the list is long enough that a guard after it falls
// outside the first 50 lines, which is all Plugin Check reads for one.
defined( 'ABSPATH' ) || exit;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Foundation\Plugin as Base_Plugin;
use Webhead\WP\SearchCloud\Dependencies\League\Container\Container;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Admin\Page_Registry;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Blocks\Blocks_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Capabilities\Capability_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Database\Database_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Elementor\Elementor_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Diagnostics_Manager;
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
use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Elementor\Widgets\Products_Widget;
use Webhead\WP\SearchCloud\Elementor\Widgets\Search_Widget;
use Webhead\WP\SearchCloud\Health\Health_Tests;
use Webhead\WP\SearchCloud\Health\Runtime_Diagnostics;

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
		// Shared: a table is registered with the Database_Manager once, and
		// every service that is handed one has to be handed that same object.
		$container->addShared( 'sync_runs_table', Sync_Runs_Table::class );
		$container->addShared( 'change_queue_table', Change_Queue_Table::class );
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
				return new Scheduled_Sync_Job(
					$container->get( 'sync_service' ),
					$container->get( 'search_cloud_client' ),
					$container->get( 'connection_state' )
				);
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
			'frontend_config',
			static function () use ( $container ): Frontend_Config {
				return new Frontend_Config(
					$container->get( Settings_Manager::class ),
					$container->get( 'index_config' ),
					$container->get( 'language' ),
					$container->get( 'language_config' )
				);
			}
		);

		// How the storefront entry is registered, said before anything asks for
		// it. The configuration is a callback: it is built when a block or a
		// widget on the page enqueues the entry, and on no other request.
		$this->get_assets()
			->configure( Frontend_Config::ENTRY, [ 'style_dependencies' => [ 'wp-components' ] ] )
			->localize(
				Frontend_Config::ENTRY,
				Frontend_Config::OBJECT_NAME,
				static fn (): array => $container->get( 'frontend_config' )->to_array()
			);
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
	}

	/**
	 * Named by class and never built: a widget extends a class of Elementor's
	 * and cannot be loaded on a site without it. The category title is asked
	 * for when Elementor builds its panel, not while the plugin boots.
	 */
	protected function register_elementor( Elementor_Manager $elementor_manager, Container $container ): void {
		$elementor_manager
			->set_category( static fn (): string => __( 'webhead Search Cloud', 'webhead-search-cloud' ), 'eicon-search' )
			->register_widget( Search_Widget::class )
			->register_widget( Products_Widget::class );
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
	 *
	 * The policy itself is chosen in {@see self::uninstall_current_site()}: this
	 * method runs on every request of the site, and the setting is only worth
	 * a query when the plugin is actually being removed.
	 */
	protected function configure_uninstall( Uninstall_Manager $uninstall_manager, Container $container ): void {
		$uninstall_manager->set_policy( Uninstall_Manager::POLICY_KEEP_DATA );

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
		 * runs an upgrade step - so the opt-in "delete my data" path clears them
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
	 * Read the opt-in setting for the site being cleaned, then clean it. On a
	 * network each site is asked about its own setting.
	 */
	protected function uninstall_current_site(): void {
		$this->get_uninstall_manager()->set_policy( $this->uninstall_policy() );

		parent::uninstall_current_site();
	}

	/**
	 * What the current site asked to have done with its data on uninstall.
	 */
	public function uninstall_policy(): string {
		return (bool) $this->get_settings_manager()->get( Plugin_Settings::DELETE_DATA_ON_UNINSTALL )
			? Uninstall_Manager::POLICY_DELETE_DATA
			: Uninstall_Manager::POLICY_KEEP_DATA;
	}

	/**
	 * The framework calls this while the plugin boots, on every request and
	 * before a text domain may load. {@see Health_Tests::register()} translates
	 * nothing; its one hook puts the tests' names into the reader's language
	 * when WordPress lists them.
	 */
	protected function register_health_tests( Site_Health_Manager $site_health_manager, Container $container ): void {
		$health_tests = new Health_Tests(
			$site_health_manager,
			$container->get( 'search_cloud_client' ),
			$container->get( 'index_config' ),
			$container->get( 'sync_state' )
		);

		$health_tests->register();
		$this->get_hooks_manager()->register( $health_tests );
	}

	/**
	 * As {@see self::register_health_tests()}: the section is registered here
	 * and its fields are read when Site Health Info is built.
	 */
	protected function register_diagnostics( Diagnostics_Manager $diagnostics_manager, Container $container ): void {
		$diagnostics = new Runtime_Diagnostics(
			$diagnostics_manager,
			$container->get( 'search_cloud_client' ),
			$container->get( 'index_config' ),
			$container->get( 'sync_service' ),
			$container->get( Settings_Manager::class ),
			$container->get( 'multilingual_support' ),
			$container->get( 'language_config' )
		);

		$diagnostics->register();
		$this->get_hooks_manager()->register( $diagnostics );
	}

}
