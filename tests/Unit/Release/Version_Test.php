<?php
/**
 * The version, and the versions the plugin asks for, wherever they are written.
 *
 * A release writes the version in the plugin header, its constant, the readme,
 * both changelogs, the package manifests, the blocks and the translation
 * template, and the README shows it in a badge. Nothing compared them: the
 * README's badge said 1.0.2 through four releases, and "tested with WordPress
 * 7.0" beside a readme that said 7.1. These tests are that comparison, so a
 * place that was missed fails the suite instead of waiting to be noticed.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Indexing\Woo;

final class Version_Test extends TestCase {
	public function test_the_version_is_the_same_wherever_it_is_written(): void {
		$version = $this->header( 'Version' );

		$this->assertMatchesRegularExpression( '/^\d+\.\d+\.\d+$/', $version );

		$written = [
			'the VERSION constant'                 => $this->find( "/SearchCloud.VERSION',\s*'([^']+)'/", 'searcio.php' ),
			'Stable tag in readme.txt'             => $this->find( '/^Stable tag:\s*(\S+)\s*$/m', 'readme.txt' ),
			'package.json'                         => $this->json( 'package.json' )['version'] ?? null,
			'package-lock.json'                    => $this->json( 'package-lock.json' )['version'] ?? null,
			'the root package of package-lock.json' => $this->json( 'package-lock.json' )['packages']['']['version'] ?? null,
			'blocks/search/block.json'             => $this->json( 'blocks/search/block.json' )['version'] ?? null,
			'blocks/products/block.json'           => $this->json( 'blocks/products/block.json' )['version'] ?? null,
			'Project-Id-Version of the POT'        => $this->find( '/"Project-Id-Version: Searcio - Fast AI Product Search for WooCommerce (\S+?)\\\\n"/', 'languages/searcio.pot' ),
			'the version badge of README.md'       => $this->find( '/img\.shields\.io\/badge\/plugin-v([0-9.]+)-/', 'README.md' ),
		];

		foreach ( $written as $place => $found ) {
			$this->assertSame( $version, $found, sprintf( 'The plugin header says %s and %s says %s.', $version, $place, (string) $found ) );
		}
	}

	/**
	 * Between two releases the changelog opens with an Unreleased section and
	 * the version stays that of the last release, so the first numbered
	 * heading is the version either way.
	 */
	public function test_both_changelogs_have_the_version_as_their_newest_entry(): void {
		$version = $this->header( 'Version' );

		$this->assertSame( $version, $this->find( '/^## (\d+\.\d+\.\d+)\s*$/m', 'CHANGELOG.md' ) );
		$this->assertSame( $version, $this->find( '/^= (\d+\.\d+\.\d+) =\s*$/m', 'readme.txt' ) );
	}

	public function test_the_wordpress_the_plugin_asks_for_is_the_same_wherever_it_is_written(): void {
		$minimum = $this->header( 'Requires at least' );

		$this->assertSame( $minimum, $this->find( '/^Requires at least:\s*(\S+)\s*$/m', 'readme.txt' ) );
		$this->assertSame( $minimum, $this->find( '/img\.shields\.io\/badge\/wordpress-%3E%3D([0-9.]+)-/', 'README.md' ) );
		$this->assertSame( $minimum, $this->find( '/^- WordPress ([0-9.]+) or later\s*$/m', 'README.md' ) );
		$this->assertSame( $minimum, $this->find( '/^- WordPress ([0-9.]+) or later\s*$/m', 'docs/installation.md' ) );
	}

	public function test_the_php_the_plugin_asks_for_is_the_same_wherever_it_is_written(): void {
		$minimum = $this->header( 'Requires PHP' );

		$this->assertSame( $minimum, $this->find( '/^Requires PHP:\s*(\S+)\s*$/m', 'readme.txt' ) );
		$this->assertSame( $minimum, $this->find( '/img\.shields\.io\/badge\/php-%3E%3D([0-9.]+)-/', 'README.md' ) );
		$this->assertSame( $minimum, $this->find( '/^- PHP ([0-9.]+) or later\s*$/m', 'README.md' ) );
		$this->assertSame( $minimum, $this->find( '/^- PHP ([0-9.]+) or later\s*$/m', 'docs/installation.md' ) );
	}

	public function test_the_readme_badge_names_the_wordpress_the_plugin_was_tested_with(): void {
		$this->assertSame(
			$this->find( '/^Tested up to:\s*(\S+)\s*$/m', 'readme.txt' ),
			$this->find( '/img\.shields\.io\/badge\/tested_up_to-wordpress_([0-9.]+)-/', 'README.md' )
		);
	}

	public function test_the_documents_name_the_woocommerce_the_plugin_asks_for(): void {
		$this->assertSame( Woo::MIN_VERSION, $this->find( '/^- WooCommerce ([0-9.]+)\+/m', 'README.md' ) );
		$this->assertSame( Woo::MIN_VERSION, $this->find( '/^- WooCommerce ([0-9.]+) or later/m', 'docs/installation.md' ) );
		$this->assertSame( Woo::MIN_VERSION, $this->find( '/minimum supported version \(([0-9.]+)\)/', 'docs/faq.md' ) );
	}

	/**
	 * A field of the plugin header, such as `Version` or `Requires PHP`.
	 */
	private function header( string $field ): string {
		return $this->find( '/^ \* ' . preg_quote( $field, '/' ) . ':\s*(\S+)\s*$/m', 'searcio.php' );
	}

	/**
	 * What the first group of `$pattern` holds in `$file`.
	 */
	private function find( string $pattern, string $file ): string {
		$this->assertSame( 1, preg_match( $pattern, $this->read( $file ), $found ), sprintf( '%s does not hold what %s looks for.', $file, $pattern ) );

		return $found[1];
	}

	/**
	 * @return array<string,mixed>
	 */
	private function json( string $file ): array {
		$decoded = json_decode( $this->read( $file ), true );

		$this->assertIsArray( $decoded, $file . ' is not JSON.' );

		return $decoded;
	}

	private function read( string $file ): string {
		$path = dirname( __DIR__, 3 ) . '/' . $file;

		$this->assertFileExists( $path );

		// Read as text whatever the checkout's line endings are.
		return str_replace( "\r\n", "\n", (string) file_get_contents( $path ) );
	}
}
