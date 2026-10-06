<?php
/**
 * A stand-in for WP-CLI's `WP_CLI` class.
 *
 * The integration suite runs under PHPUnit, not under WP-CLI, so the class a
 * command reports through does not exist there. This one keeps what a command
 * says instead of printing it, and throws where the real `WP_CLI::error()`
 * ends the process with a non-zero status, so a test can tell the two ways a
 * command ends apart.
 *
 * It declares the class only, never the `WP_CLI` constant: the plugin decides
 * by the constant whether it is running under WP-CLI, and must go on deciding
 * that it is not.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

if ( class_exists( 'WP_CLI', false ) ) {
	return;
}

/**
 * Thrown where `WP_CLI::error()` would exit.
 */
final class WP_CLI_Double_Exit extends Exception {}

final class WP_CLI {
	/**
	 * What was said, in order, as `[ kind, message ]`.
	 *
	 * @var array<int,array{0:string,1:string}>
	 */
	public static array $said = [];

	public static function line( $message = '' ): void {
		self::$said[] = [ 'line', (string) $message ];
	}

	public static function log( $message ): void {
		self::$said[] = [ 'log', (string) $message ];
	}

	public static function warning( $message ): void {
		self::$said[] = [ 'warning', (string) $message ];
	}

	public static function success( $message ): void {
		self::$said[] = [ 'success', (string) $message ];
	}

	public static function error( $message ): void {
		self::$said[] = [ 'error', (string) $message ];

		throw new WP_CLI_Double_Exit( (string) $message );
	}

	/**
	 * Anything else of WP-CLI that code reaches for once the class exists.
	 *
	 * @param  array<int,mixed>  $arguments
	 */
	public static function __callStatic( string $name, array $arguments ): mixed {
		return null;
	}
}
