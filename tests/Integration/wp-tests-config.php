<?php
/**
 * WordPress test-suite configuration for the wp-env integration suite.
 *
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * wp-phpunit needs a wp-tests-config.php that defines the database connection
 * and a few test constants. Inside the wp-env `tests-cli` container those
 * details arrive as WORDPRESS_DB_* environment variables and WordPress core
 * lives at /var/www/html, so this file reads the environment with wp-env
 * defaults and stays portable to any host that exports the same variables.
 *
 * WARNING: the WordPress test bootstrap DROPS AND RECREATES every table in the
 * configured database on each run. DB_NAME must point at a throwaway test
 * database — wp-env's `tests-*` database — and never at a real site.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

/**
 * Read an environment variable, falling back to a default.
 */
$webhead_search_cloud_env = static function ( string $name, string $default ): string {
	$value = getenv( $name );

	return false === $value || '' === $value ? $default : $value;
};

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', rtrim( $webhead_search_cloud_env( 'WP_TESTS_ABSPATH', '/var/www/html' ), '/\\' ) . '/' );
}

define( 'DB_NAME', $webhead_search_cloud_env( 'WORDPRESS_DB_NAME', 'tests-wordpress' ) );
define( 'DB_USER', $webhead_search_cloud_env( 'WORDPRESS_DB_USER', 'root' ) );
define( 'DB_PASSWORD', $webhead_search_cloud_env( 'WORDPRESS_DB_PASSWORD', 'password' ) );
define( 'DB_HOST', $webhead_search_cloud_env( 'WORDPRESS_DB_HOST', 'tests-mysql' ) );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = $webhead_search_cloud_env( 'WP_TESTS_TABLE_PREFIX', 'wptests_' );

define( 'WP_TESTS_DOMAIN', $webhead_search_cloud_env( 'WP_TESTS_DOMAIN', 'example.org' ) );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'webhead Search Cloud Tests' );

define( 'WP_PHP_BINARY', 'php' );

define( 'WP_DEBUG', true );
