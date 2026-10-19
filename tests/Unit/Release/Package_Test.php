<?php
/**
 * What a release package can run without.
 *
 * A package holds no `vendor` directory and no `composer.json`: `.distignore`
 * leaves both out. A file WordPress loads that still asked for `vendor` would
 * stop the site it is installed on with a fatal error, and no suite would say
 * so, because `vendor` is on disk wherever the suites run. So what is read
 * here is the files themselves.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

final class Package_Test extends TestCase {
	public function test_the_package_leaves_out_what_composer_installed(): void {
		$names = array_map( 'trim', (array) file( $this->root() . '/.distignore' ) );

		foreach ( [ 'vendor', 'composer.json', 'composer.lock' ] as $name ) {
			$this->assertContains( $name, $names, sprintf( '.distignore does not name %s.', $name ) );
		}
	}

	public function test_the_plugin_file_loads_the_plugins_own_autoloader(): void {
		$this->assertStringContainsString(
			"require_once __DIR__ . '/includes/autoload.php';",
			(string) file_get_contents( $this->root() . '/searcio.php' )
		);
	}

	public function test_nothing_wordpress_loads_asks_for_vendor(): void {
		$asking = [];

		foreach ( $this->shipped_php() as $file ) {
			if ( 1 === preg_match( '/^\s*(require|include)(_once)?\b.*vendor/m', (string) file_get_contents( $file ) ) ) {
				$asking[] = str_replace( '\\', '/', substr( $file, strlen( $this->root() ) + 1 ) );
			}
		}

		$this->assertSame( [], $asking, 'A release package has no vendor directory, and these files load from it.' );
	}

	public function test_the_release_workflow_makes_one_install(): void {
		$workflow = (string) file_get_contents( $this->root() . '/.github/workflows/deploy.yml' );

		$this->assertStringContainsString( '--exclude-from=".distignore"', $workflow );
		$this->assertSame( 0, preg_match( '/^\s*run:.*--no-dev/m', $workflow ), 'deploy.yml makes a production install, which was there to empty a vendor directory the package no longer holds.' );
	}

	/**
	 * The PHP of the plugin that a package holds, without the bundle Mozart
	 * writes: the main file, the uninstall routine, `includes` and the blocks.
	 *
	 * @return string[]
	 */
	private function shipped_php(): array {
		$files = [ $this->root() . '/searcio.php', $this->root() . '/uninstall.php' ];

		foreach ( [ 'includes', 'blocks' ] as $directory ) {
			$found = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $this->root() . '/' . $directory, RecursiveDirectoryIterator::SKIP_DOTS ) );

			/** @var SplFileInfo $file */
			foreach ( $found as $file ) {
				$path = str_replace( '\\', '/', $file->getPathname() );

				if ( 'php' === $file->getExtension() && ! str_contains( $path, '/includes/Dependencies/' ) ) {
					$files[] = $file->getPathname();
				}
			}
		}

		return $files;
	}

	private function root(): string {
		return dirname( __DIR__, 3 );
	}
}
