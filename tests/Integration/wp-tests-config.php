<?php
/**
 * WordPress test-suite configuration for the wp-env integration suite.
 *
 * The WordPress PHPUnit library (wp-phpunit) requires a `wp-tests-config.php`
 * that defines the database connection plus a few test constants. Inside the
 * wp-env `tests-cli` container the connection details arrive as `WORDPRESS_DB_*`
 * environment variables and WordPress core lives at `/var/www/html`, so this
 * file reads those with sensible wp-env defaults and stays portable to any host
 * that exports the same variables.
 *
 * WARNING: the WordPress test bootstrap DROPS AND RECREATES every table in the
 * configured database on each run. `DB_NAME` must therefore point at a
 * throwaway test database (wp-env's `tests-*` database), never a real site.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

/**
 * Read an environment variable with a fallback default.
 */
$whsc_env = static function ( string $name, string $default ): string {
	$value = getenv( $name );

	return false === $value || '' === $value ? $default : $value;
};

// Path to the WordPress core install under test. wp-env mounts it at
// /var/www/html inside the container.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', rtrim( $whsc_env( 'WP_TESTS_ABSPATH', '/var/www/html' ), '/\\' ) . '/' );
}

// Database connection. wp-env exports these into the tests-cli container.
define( 'DB_NAME', $whsc_env( 'WORDPRESS_DB_NAME', 'tests-wordpress' ) );
define( 'DB_USER', $whsc_env( 'WORDPRESS_DB_USER', 'root' ) );
define( 'DB_PASSWORD', $whsc_env( 'WORDPRESS_DB_PASSWORD', 'password' ) );
define( 'DB_HOST', $whsc_env( 'WORDPRESS_DB_HOST', 'tests-mysql' ) );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = $whsc_env( 'WP_TESTS_TABLE_PREFIX', 'wptests_' );

define( 'WP_TESTS_DOMAIN', $whsc_env( 'WP_TESTS_DOMAIN', 'example.org' ) );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'webhead Search Cloud Tests' );

define( 'WP_PHP_BINARY', 'php' );

define( 'WP_DEBUG', true );
