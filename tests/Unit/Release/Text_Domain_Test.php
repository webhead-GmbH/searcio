<?php
/**
 * The text domain is searcio, the plugin's slug on wordpress.org.
 *
 * wordpress.org installs the plugin as `searcio/` and files its translations
 * under that name, and Plugin Check holds a plugin's text domain to its slug.
 * A string translated under another domain is left in English by every
 * language pack, and nothing on screen says so until a second locale is
 * tried. These tests read the files the domain is written in.
 *
 * Everything else the framework names after the plugin keeps the first slug,
 * webhead-search-cloud, which the main file sets whatever folder the plugin
 * is in.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;

final class Text_Domain_Test extends TestCase {
	private const DOMAIN = 'searcio';

	/** The translation functions of WordPress and of `@wordpress/i18n`. */
	private const FUNCTIONS = '__|_e|_x|_ex|_n|_nx|_n_noop|_nx_noop|esc_html__|esc_attr__|esc_html_e|esc_attr_e|esc_html_x|esc_attr_x';

	public function test_the_plugin_header_names_it(): void {
		$this->assertSame( self::DOMAIN, $this->find( '/^ \* Text Domain:\s*(\S+)\s*$/m', 'searcio.php' ) );
	}

	public function test_the_blocks_are_translated_under_it(): void {
		$files = glob( $this->root() . '/blocks/*/block.json' );

		$this->assertNotEmpty( $files );

		foreach ( $files as $file ) {
			$block = json_decode( (string) file_get_contents( $file ), true );

			$this->assertSame( self::DOMAIN, $block['textdomain'] ?? null, basename( dirname( $file ) ) . '/block.json' );
		}
	}

	public function test_the_translation_files_carry_its_name(): void {
		$this->assertSame( self::DOMAIN, $this->find( '/^"X-Domain: (\S+)\\\\n"$/m', 'languages/' . self::DOMAIN . '.pot' ) );
		$this->assertSame( self::DOMAIN, $this->find( '/^"X-Domain: (\S+)\\\\n"$/m', 'languages/' . self::DOMAIN . '-de_DE.po' ) );
		$this->assertFileExists( $this->root() . '/languages/' . self::DOMAIN . '-de_DE.mo' );

		foreach ( scandir( $this->root() . '/languages' ) as $file ) {
			if ( '.' === $file[0] || 'script-translation-map.json' === $file ) {
				continue;
			}

			$this->assertStringStartsWith( self::DOMAIN, $file, 'WordPress looks for a translation file by the text domain.' );
		}
	}

	/**
	 * Every call to a translation function in the plugin's own PHP and JS ends
	 * with the domain, as a string, and it is searcio.
	 */
	public function test_every_string_is_translated_under_it(): void {
		$calls = 0;

		foreach ( $this->sources() as $file ) {
			$code = $this->without_comments( (string) file_get_contents( $file ) );

			preg_match_all( '/(?<![\w$>:])(?:' . self::FUNCTIONS . ')\s*\(/', $code, $matches, PREG_OFFSET_CAPTURE );

			foreach ( $matches[0] as [ $call, $offset ] ) {
				$strings = $this->string_arguments( $code, $offset + strlen( $call ) );

				// A method of something else that happens to be called `__`.
				if ( [] === $strings ) {
					continue;
				}

				++$calls;
				$line = substr_count( substr( $code, 0, $offset ), "\n" ) + 1;

				$this->assertSame( self::DOMAIN, end( $strings ), sprintf( '%s:%d translates under another domain.', $this->relative( $file ), $line ) );
			}
		}

		// A scan that matched nothing would pass on any code at all.
		$this->assertGreaterThan( 500, $calls );
	}

	/**
	 * wordpress.org knows a plugin as `slug/slug.php`, and its page is at the
	 * slug. The test bootstrap loads the main file and PHPCS lints it, both by
	 * name, so they name it too. The first slug went with the old name of the
	 * file: a site that had it active finds it gone and activates the plugin
	 * again.
	 */
	public function test_the_main_file_is_named_after_it(): void {
		$this->assertFileExists( $this->root() . '/' . self::DOMAIN . '.php' );
		$this->assertFileDoesNotExist( $this->root() . '/webhead-search-cloud.php' );
		$this->assertSame( 'https://wordpress.org/plugins/' . self::DOMAIN . '/', $this->find( '/^ \* Plugin URI:\s*(\S+)\s*$/m', self::DOMAIN . '.php' ) );
		$this->assertStringContainsString( "require dirname( __DIR__, 2 ) . '/" . self::DOMAIN . ".php';", (string) file_get_contents( $this->root() . '/tests/Integration/bootstrap.php' ) );
		$this->assertStringContainsString( '<file>' . self::DOMAIN . '.php</file>', (string) file_get_contents( $this->root() . '/phpcs.xml' ) );
		$this->assertStringContainsString( "require_once __DIR__ . '/" . self::DOMAIN . ".php';", (string) file_get_contents( $this->root() . '/uninstall.php' ) );
	}

	public function test_everything_else_keeps_the_first_slug(): void {
		$this->assertSame( 'webhead-search-cloud', $this->find( "/'Webhead\\\\WP\\\\SearchCloud\\\\PLUGIN_SLUG',\s*'([^']+)'/", 'searcio.php' ) );
		$this->assertSame( 'webhead_search_cloud', $this->find( "/'Webhead\\\\WP\\\\SearchCloud\\\\CACHE_GROUP', '([^']+)'/", 'searcio.php' ) );
	}

	/**
	 * The code with its comments blanked out, so a usage example in a docblock
	 * (`__( 'Reports', 'text-domain' )`) is not taken for a call. Strings are
	 * stepped over, so `//` in a URL is not taken for a comment, and every
	 * newline stays where it was, so line numbers still match.
	 */
	private function without_comments( string $code ): string {
		$length = strlen( $code );
		$out    = '';

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $code[ $i ];
			$next = $code[ $i + 1 ] ?? '';

			if ( "'" === $char || '"' === $char || '`' === $char ) {
				$end = $i + 1;

				while ( $end < $length && $code[ $end ] !== $char ) {
					$end += '\\' === $code[ $end ] ? 2 : 1;
				}

				$out .= substr( $code, $i, $end - $i + 1 );
				$i    = $end;
				continue;
			}

			if ( '/' === $char && ( '/' === $next || '*' === $next ) ) {
				$end = '/' === $next ? strpos( $code, "\n", $i ) : strpos( $code, '*/', $i + 2 );
				$end = false === $end ? $length : ( '/' === $next ? $end : $end + 2 );

				$out .= preg_replace( '/[^\n]/', ' ', substr( $code, $i, $end - $i ) );
				$i    = $end - 1;
				continue;
			}

			$out .= $char;
		}

		return $out;
	}

	/**
	 * The string literals among the top-level arguments of a call whose
	 * arguments begin at `$start`, in order.
	 *
	 * @return string[]
	 */
	private function string_arguments( string $code, int $start ): array {
		$strings = [];
		$depth   = 0;
		$length  = strlen( $code );

		for ( $i = $start; $i < $length; $i++ ) {
			$char = $code[ $i ];

			if ( "'" === $char || '"' === $char ) {
				$end = $i + 1;

				while ( $end < $length && $code[ $end ] !== $char ) {
					$end += '\\' === $code[ $end ] ? 2 : 1;
				}

				if ( 0 === $depth ) {
					$strings[] = substr( $code, $i + 1, $end - $i - 1 );
				}

				$i = $end;
				continue;
			}

			if ( '(' === $char || '[' === $char || '{' === $char ) {
				++$depth;
			} elseif ( ')' === $char || ']' === $char || '}' === $char ) {
				if ( 0 === $depth ) {
					break;
				}

				--$depth;
			}
		}

		return $strings;
	}

	/**
	 * @return string[]
	 */
	private function sources(): array {
		$files = [ $this->root() . '/searcio.php', $this->root() . '/uninstall.php' ];

		foreach ( [ 'includes', 'src' ] as $directory ) {
			$tree = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $this->root() . '/' . $directory, \FilesystemIterator::SKIP_DOTS ) );

			foreach ( $tree as $file ) {
				$path = str_replace( '\\', '/', $file->getPathname() );

				if ( str_contains( $path, '/includes/Dependencies/' ) || str_ends_with( $path, '.test.js' ) || ! preg_match( '/\.(php|js)$/', $path ) ) {
					continue;
				}

				$files[] = $path;
			}
		}

		return $files;
	}

	private function find( string $pattern, string $file ): string {
		$path = $this->root() . '/' . $file;

		$this->assertFileExists( $path );
		$this->assertSame( 1, preg_match( $pattern, str_replace( "\r\n", "\n", (string) file_get_contents( $path ) ), $found ), sprintf( '%s does not hold what %s looks for.', $file, $pattern ) );

		return $found[1];
	}

	private function relative( string $file ): string {
		return ltrim( substr( str_replace( '\\', '/', $file ), strlen( $this->root() ) ), '/' );
	}

	private function root(): string {
		return str_replace( '\\', '/', dirname( __DIR__, 3 ) );
	}
}
