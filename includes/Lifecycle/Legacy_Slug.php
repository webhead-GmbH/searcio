<?php
/**
 * What a site stored under the plugin's first slug, moved to its own.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Cache_Key;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Namespace_Versions;

defined( 'ABSPATH' ) || exit;

/**
 * Until 1.4.0 everything the plugin stored was named after its first slug,
 * `webhead-search-cloud`: options, its two tables, the capabilities granted to
 * roles, its scheduled events, its blocks in a post and its widgets in
 * Elementor's data. The slug is `searcio` now, and the code reads every one of
 * those under the new name.
 *
 * This moves them, once per site, when the plugin's file loads: before the
 * framework reads its lifecycle state or creates its tables under the new
 * names, which would otherwise take an updated site for a new one. A marker
 * that is autoloaded says it is done, so a site pays no query for it again;
 * a site that never ran an earlier release gets the marker at once.
 *
 * Nothing here is deleted that was not first copied, except caches (the
 * plugin's transients, the old cache group's version and Elementor's rendered
 * CSS), which are written again.
 *
 * @since 1.4.0
 */
final class Legacy_Slug {
	public const OLD_SLUG = 'webhead-search-cloud';

	public const OLD_PREFIX = 'webhead_search_cloud';

	/** The slug now, which the main file defines before this runs. */
	public const NEW_SLUG = \Webhead\WP\SearchCloud\PLUGIN_SLUG;

	/** The slug where a name takes underscores; it has no hyphen to replace. */
	public const NEW_PREFIX = \Webhead\WP\SearchCloud\PLUGIN_SLUG;

	/** Autoloaded once the move is done, per site and once for the network. */
	public const MARKER = self::NEW_PREFIX . '_slug_moved';

	private const LOCK = self::NEW_PREFIX . '_slug_moving';

	/** A lock older than this is a request that died mid-way; another takes over. */
	private const LOCK_TIMEOUT = 300;

	private const TABLES = [ 'sync_runs', 'change_queue' ];

	private const CAPABILITIES = [ 'view', 'run_sync', 'manage_settings', 'manage_network_settings' ];

	private const ELEMENTOR_WIDGETS = [ 'search', 'products' ];

	/**
	 * Moves what this site, and on a network the network, stored under the
	 * first slug. Cheap when there is nothing to move.
	 */
	public static function migrate(): void {
		if ( is_multisite() ) {
			self::network();
		}

		if ( '1' === (string) get_option( self::MARKER, '' ) ) {
			return;
		}

		if ( ! self::has_old_options() ) {
			update_option( self::MARKER, '1', true );

			return;
		}

		if ( ! self::lock() ) {
			return;
		}

		try {
			self::tables();
			self::options();
			self::table_versions();
			self::capabilities();
			self::cron();
			self::content();
			update_option( self::MARKER, '1', true );
		} finally {
			delete_option( self::LOCK );
		}
	}

	/** The network's own options (`sitemeta`), once. */
	private static function network(): void {
		global $wpdb;

		if ( '1' === (string) get_site_option( self::MARKER, '' ) ) {
			return;
		}

		$like = $wpdb->esc_like( self::OLD_PREFIX . '_' ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a one-time move of the plugin's own rows.
		$names = (array) $wpdb->get_col( $wpdb->prepare( "SELECT meta_key FROM {$wpdb->sitemeta} WHERE site_id = %d AND meta_key LIKE %s", get_current_network_id(), $like ) );

		foreach ( $names as $name ) {
			$value = get_site_option( $name );
			$new   = self::NEW_PREFIX . substr( (string) $name, strlen( self::OLD_PREFIX ) );

			update_site_option( $new, $value );
			delete_site_option( $name );
		}

		// The plugin's network transients are a cache.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->sitemeta} WHERE site_id = %d AND ( meta_key LIKE %s OR meta_key LIKE %s )", get_current_network_id(), $wpdb->esc_like( '_site_transient_' . self::OLD_PREFIX . '_' ) . '%', $wpdb->esc_like( '_site_transient_timeout_' . self::OLD_PREFIX . '_' ) . '%' ) );

		( new Namespace_Versions() )->forget( self::OLD_PREFIX, Cache_Key::SCOPE_NETWORK );

		update_site_option( self::MARKER, '1' );
	}

	private static function has_old_options(): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- asked until the marker is set, then never again.
		return null !== $wpdb->get_var( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s LIMIT 1", $wpdb->esc_like( self::OLD_PREFIX . '_' ) . '%' ) );
	}

	private static function lock(): bool {
		if ( add_option( self::LOCK, (string) time(), '', false ) ) {
			return true;
		}

		if ( time() - (int) get_option( self::LOCK, 0 ) < self::LOCK_TIMEOUT ) {
			return false;
		}

		delete_option( self::LOCK );

		return add_option( self::LOCK, (string) time(), '', false );
	}

	/**
	 * Every option named after the first slug takes the new name, and its
	 * transients go: they are a cache. Where an option of the new name exists
	 * already, the site's own, older one wins.
	 */
	private static function options(): void {
		global $wpdb;

		$like = $wpdb->esc_like( self::OLD_PREFIX . '_' ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a one-time move of the plugin's own rows.
		$names = (array) $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s", $like ) );

		foreach ( $names as $name ) {
			$name = (string) $name;
			$new  = self::NEW_PREFIX . substr( $name, strlen( self::OLD_PREFIX ) );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
			$wpdb->delete( $wpdb->options, [ 'option_name' => $new ] );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
			$wpdb->update( $wpdb->options, [ 'option_name' => $new ], [ 'option_name' => $name ] );

			wp_cache_delete( $name, 'options' );
			wp_cache_delete( $new, 'options' );
		}

		foreach ( [ '_transient_', '_transient_timeout_' ] as $kind ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( $kind . self::OLD_PREFIX . '_' ) . '%' ) );
		}

		// The framework's version of the old cache group, which nothing reads.
		( new Namespace_Versions() )->forget( self::OLD_PREFIX );

		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );
	}

	/**
	 * The two tables take the new name. One that the new code already made
	 * beside an old one, which only happens empty, gives way to the old.
	 */
	private static function tables(): void {
		global $wpdb;

		foreach ( self::TABLES as $table ) {
			$old = $wpdb->prefix . self::OLD_PREFIX . '_' . $table;
			$new = $wpdb->prefix . self::NEW_PREFIX . '_' . $table;

			if ( ! self::table_exists( $old ) ) {
				continue;
			}

			if ( self::table_exists( $new ) ) {
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a table name, built from the prefix.
				if ( (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$new}`" ) > 0 ) {
					continue;
				}

				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- as above.
				$wpdb->query( "DROP TABLE `{$new}`" );
			}

			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- as above.
			$wpdb->query( "RENAME TABLE `{$old}` TO `{$new}`" );
		}
	}

	/**
	 * The framework knows a table's schema version by the table's name, which
	 * moved with it. Under the old name the version reads as none, and every
	 * table would be built again beside a stale entry.
	 */
	private static function table_versions(): void {
		$option   = self::NEW_PREFIX . '_table_versions';
		$versions = get_option( $option );

		if ( ! is_array( $versions ) ) {
			return;
		}

		$moved = [];

		foreach ( $versions as $table => $version ) {
			$moved[ self::new_name( (string) $table ) ] = $version;
		}

		update_option( $option, $moved );
	}

	private static function table_exists( string $table ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
		return $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
	}

	/** A capability a role or a user was given goes on under the new name. */
	private static function capabilities(): void {
		global $wpdb;

		$map = [];

		foreach ( self::CAPABILITIES as $capability ) {
			$map[ self::OLD_SLUG . '_' . $capability ] = self::NEW_SLUG . '_' . $capability;
		}

		foreach ( wp_roles()->role_objects as $role ) {
			foreach ( $map as $old => $new ) {
				if ( isset( $role->capabilities[ $old ] ) ) {
					$role->add_cap( $new, (bool) $role->capabilities[ $old ] );
					$role->remove_cap( $old );
				}
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- users given one of the plugin's capabilities on their own.
		$users = (array) $wpdb->get_col( $wpdb->prepare( "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value LIKE %s", $wpdb->get_blog_prefix() . 'capabilities', '%' . $wpdb->esc_like( self::OLD_SLUG . '_' ) . '%' ) );

		foreach ( $users as $user_id ) {
			$user = new \WP_User( (int) $user_id );

			foreach ( $map as $old => $new ) {
				if ( isset( $user->caps[ $old ] ) ) {
					$user->add_cap( $new, (bool) $user->caps[ $old ] );
					$user->remove_cap( $old );
				}
			}
		}
	}

	/**
	 * Scheduled events keep their time, their schedule and their arguments,
	 * under the new hook names, so a sync that is running goes on.
	 */
	private static function cron(): void {
		$crons = _get_cron_array();

		if ( ! is_array( $crons ) ) {
			return;
		}

		$changed = false;

		foreach ( $crons as $timestamp => $hooks ) {
			if ( ! is_array( $hooks ) ) {
				continue;
			}

			foreach ( $hooks as $hook => $events ) {
				if ( ! str_starts_with( (string) $hook, self::OLD_PREFIX ) ) {
					continue;
				}

				$new = self::NEW_PREFIX . substr( (string) $hook, strlen( self::OLD_PREFIX ) );

				$crons[ $timestamp ][ $new ] = array_merge( $crons[ $timestamp ][ $new ] ?? [], (array) $events );
				unset( $crons[ $timestamp ][ $hook ] );
				$changed = true;
			}
		}

		if ( $changed ) {
			_set_cron_array( $crons );
		}
	}

	/** A name under the first prefix, under the new one; any other as it is. */
	private static function new_name( string $name ): string {
		return str_starts_with( $name, self::OLD_PREFIX . '_' ) ? self::NEW_PREFIX . substr( $name, strlen( self::OLD_PREFIX ) ) : $name;
	}

	/**
	 * The blocks in posts, templates, patterns and block widgets, and the
	 * widgets in Elementor's data, take the new names. Elementor's rendered
	 * CSS and element cache name the old ones, so they go and are written
	 * again.
	 */
	private static function content(): void {
		global $wpdb;

		$old_block = 'wp:' . self::OLD_SLUG . '/';
		$new_block = 'wp:' . self::NEW_SLUG . '/';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one statement over the posts that hold one of the plugin's blocks.
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->posts} SET post_content = REPLACE( post_content, %s, %s ) WHERE post_content LIKE %s", $old_block, $new_block, '%' . $wpdb->esc_like( $old_block ) . '%' ) );

		$block_widgets = get_option( 'widget_block' );

		if ( is_array( $block_widgets ) ) {
			foreach ( $block_widgets as $key => $widget ) {
				if ( is_array( $widget ) && isset( $widget['content'] ) && is_string( $widget['content'] ) ) {
					$block_widgets[ $key ]['content'] = str_replace( $old_block, $new_block, $widget['content'] );
				}
			}

			update_option( 'widget_block', $block_widgets );
		}

		$touched = [];

		foreach ( self::ELEMENTOR_WIDGETS as $widget ) {
			$old = '"' . self::OLD_SLUG . '-' . $widget . '"';
			$new = '"' . self::NEW_SLUG . '-' . $widget . '"';
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
			$ids = (array) $wpdb->get_col( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_elementor_data' AND meta_value LIKE %s", '%' . $wpdb->esc_like( $old ) . '%' ) );

			if ( [] === $ids ) {
				continue;
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- as above.
			$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->postmeta} SET meta_value = REPLACE( meta_value, %s, %s ) WHERE meta_key = '_elementor_data' AND meta_value LIKE %s", $old, $new, '%' . $wpdb->esc_like( $old ) . '%' ) );

			$touched = array_merge( $touched, array_map( 'intval', $ids ) );
		}

		foreach ( array_unique( $touched ) as $post_id ) {
			delete_post_meta( $post_id, '_elementor_css' );
			delete_post_meta( $post_id, '_elementor_element_cache' );
			clean_post_cache( $post_id );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the posts whose blocks were renamed.
		foreach ( (array) $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_content LIKE %s", '%' . $wpdb->esc_like( $new_block ) . '%' ) ) as $post_id ) {
			clean_post_cache( (int) $post_id );
		}

		if ( [] !== $touched ) {
			// Elementor's own files of rendered CSS, once it has loaded.
			add_action(
				'init',
				static function (): void {
					if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
						\Elementor\Plugin::$instance->files_manager->clear_cache();
					}
				}
			);
		}
	}
}
