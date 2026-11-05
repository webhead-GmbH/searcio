<?php
/**
 * The legal documents the consent checkboxes link to on their own.
 *
 * Searcio supplies the links, and the plugin's three are what the
 * Connection tab shows until they arrive and whenever the service cannot be
 * reached. They are the service's documents, so they are at the service's
 * address. Nothing compared the two: the service moved to another host and the
 * three links stayed on the old one, which asks for a password.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;

final class Legal_Links_Test extends TestCase {
	public function test_the_legal_links_are_at_the_address_of_the_service(): void {
		$service = $this->constant( 'SERVICE_URL' );

		foreach ( [ 'LEGAL_TERMS_URL', 'LEGAL_PRIVACY_URL', 'LEGAL_DPA_URL' ] as $name ) {
			$link = $this->constant( $name );

			$this->assertStringStartsWith( $service . '/', $link, sprintf( 'The service is at %s and %s is %s.', $service, $name, $link ) );
		}
	}

	/**
	 * The readme links the terms in English, which the plugin and Searcio
	 * link in German, and the other documents as they do.
	 */
	public function test_the_readme_names_the_same_documents(): void {
		$this->assertSame( $this->constant( 'LEGAL_PRIVACY_URL' ), $this->find( '/^Privacy policy: (\S+)\s*$/m', 'readme.txt' ) );
		$this->assertSame( $this->constant( 'LEGAL_DPA_URL' ), $this->find( '/^Data Processing Agreement: (\S+)\s*$/m', 'readme.txt' ) );
		$this->assertStringStartsWith( $this->constant( 'SERVICE_URL' ) . '/', $this->find( '/^Terms of use: (\S+)\s*$/m', 'readme.txt' ) );
	}

	/**
	 * What the plugin file defines a constant of its namespace as.
	 */
	private function constant( string $name ): string {
		return $this->find( "/SearchCloud." . $name . "',\s*'([^']+)'/", 'searcio.php' );
	}

	/**
	 * What the first group of `$pattern` holds in `$file`.
	 */
	private function find( string $pattern, string $file ): string {
		$path = dirname( __DIR__, 3 ) . '/' . $file;

		$this->assertFileExists( $path );
		$this->assertSame( 1, preg_match( $pattern, (string) file_get_contents( $path ), $found ), sprintf( '%s does not hold what %s looks for.', $file, $pattern ) );

		return $found[1];
	}
}
