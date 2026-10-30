<?php
/**
 * The plugin is called Searcio wherever a person reads its name.
 *
 * It was webhead Search Cloud, Search Cloud on screen, and its slug and text
 * domain are written searcio. A name a person reads starts with a capital:
 * the menu, the blocks, the widgets, the messages, the translations and the
 * readmes. The slug, the text domain, the folder, the file names, the
 * shortcode `[searcio]` and searcio.com stay as they are, and so does anything
 * that names them. These
 * tests read the template every translation starts from, each translation
 * and the script translations made from it, the blocks, the plugin header,
 * the readmes and the code itself, so a string written another way fails
 * here too.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;

final class Brand_Test extends TestCase {
	private const NAME = 'Searcio - Fast AI Product Search for WooCommerce';

	/**
	 * "searcio" as a word of its own, in lower case: not part of an identifier,
	 * a path, an address or a flag. A hyphen joins it to a German compound
	 * ("Searcio-Konto") and to a file name ("searcio-de_DE.po"); only the first
	 * is a word.
	 */
	private const LOWER_CASE = '/(?<![\w.\/@#$`=\\\\-])searcio(?![\w\/\\\\]|-(?![A-ZÄÖÜ])|\.[A-Za-z0-9_])/u';

	private const OLD_NAME = '/search cloud/i';

	/** The shortcode as it is written, `[searcio]` or `[searcio mode="box"]`: a tag, not the name. */
	private const SHORTCODE = '/\[searcio(?=[\s\]])/';

	public function test_the_plugin_carries_its_name(): void {
		$this->assertSame( self::NAME, $this->find( '/^ \* Plugin Name:\s*(.+?)\s*$/m', 'searcio.php' ) );
		$this->assertSame( self::NAME, $this->find( '/^=== (.+?) ===\s*$/m', 'readme.txt' ) );
		$this->assertSame( self::NAME, $this->find( '/<h1[^>]*>\s*(.+?)\s*<\/h1>/s', 'README.md' ) );
		$this->assertStringStartsWith( self::NAME . ' ', $this->find( '/^"Project-Id-Version: (.+?)\\\\n"$/m', 'languages/searcio.pot' ) );

		foreach ( $this->translations() as $file ) {
			$this->assertSame( self::NAME, $this->find( '/^"Project-Id-Version: (.+?)\\\\n"$/m', $file ) );
		}
	}

	public function test_the_blocks_are_named_after_it(): void {
		$titles = [];

		foreach ( glob( $this->root() . '/blocks/*/block.json' ) as $file ) {
			$block = json_decode( (string) file_get_contents( $file ), true );

			$titles[ basename( dirname( $file ) ) ] = $block['title'] ?? null;
			$this->assertNoOtherName( (string) ( $block['description'] ?? '' ), basename( dirname( $file ) ) . '/block.json' );
		}

		$this->assertSame( [ 'products' => 'Searcio Products', 'search' => 'Searcio Search' ], $titles );
	}

	public function test_every_string_writes_it_so(): void {
		$strings = $this->strings( 'languages/searcio.pot', 'msgid' );

		$this->assertGreaterThan( 500, count( $strings ) );

		foreach ( $strings as $string ) {
			$this->assertNoOtherName( $string, 'languages/searcio.pot' );
		}
	}

	public function test_every_translation_writes_it_so(): void {
		foreach ( $this->translations() as $file ) {
			$strings = $this->strings( $file, 'msgstr' );

			$this->assertGreaterThan( 500, count( $strings ), $file );

			foreach ( $strings as $string ) {
				$this->assertNoOtherName( $string, $file );
			}
		}
	}

	/**
	 * What the scripts show. `make-json` writes these apart from the PO files,
	 * so a PO file can be right and its scripts' translations not.
	 */
	public function test_every_script_translation_writes_it_so(): void {
		$files = glob( $this->root() . '/languages/searcio-*.json' );

		$this->assertNotEmpty( $files );

		foreach ( $files as $file ) {
			$messages = json_decode( (string) file_get_contents( $file ), true )['locale_data']['messages'] ?? [];
			unset( $messages[''] );

			$this->assertNotEmpty( $messages, basename( $file ) );

			foreach ( $messages as $msgid => $forms ) {
				$this->assertNoOtherName( $msgid . "\n" . implode( "\n", (array) $forms ), 'languages/' . basename( $file ) );
			}
		}
	}

	/**
	 * The code itself. A name no translation function reads - a Site Health
	 * badge, a fallback label, the WP-CLI help, a comment - never reaches the
	 * template, and neither does a string added since the template was made.
	 * The text domain is taken out first: it is the one place the code writes
	 * the name in lower case as a word of its own.
	 */
	public function test_the_code_writes_it_so(): void {
		$files = [ $this->root() . '/searcio.php', $this->root() . '/uninstall.php' ];

		foreach ( [ 'includes', 'src', 'blocks' ] as $directory ) {
			foreach ( new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $this->root() . '/' . $directory, \FilesystemIterator::SKIP_DOTS ) ) as $file ) {
				$path = str_replace( '\\', '/', $file->getPathname() );

				if ( ! str_contains( $path, '/includes/Dependencies/' ) && preg_match( '/\.(php|js|scss|json)$/', $path ) ) {
					$files[] = $path;
				}
			}
		}

		$this->assertGreaterThan( 100, count( $files ) );

		foreach ( $files as $file ) {
			$code = (string) preg_replace(
				[ '/,\s*([\'"])searcio\1/', '/"textdomain": "searcio"/', "/TAG = 'searcio'/", '/^ \* Text Domain: searcio\s*$/m' ],
				'',
				(string) file_get_contents( $file )
			);

			$this->assertNoOtherName( $code, substr( $file, strlen( $this->root() ) + 1 ) );
		}
	}

	/**
	 * The readmes and the guides, without their code: a command names the
	 * slug. The changelog says what each release was called when it shipped.
	 */
	public function test_the_readmes_write_it_so(): void {
		$files = array_merge( [ 'readme.txt', 'README.md' ], array_map( fn ( string $path ): string => 'docs/' . basename( $path ), glob( $this->root() . '/docs/*.md' ) ) );

		foreach ( $files as $file ) {
			$text = (string) file_get_contents( $this->root() . '/' . $file );
			$text = explode( '== Changelog ==', $text )[0];
			$text = (string) preg_replace( [ '/^```.*?^```/ms', '/`[^`\n]*`/' ], '', $text );

			$this->assertNoOtherName( $text, $file );
		}
	}

	private function assertNoOtherName( string $text, string $where ): void {
		$text = (string) preg_replace( self::SHORTCODE, '', $text );

		$this->assertDoesNotMatchRegularExpression( self::OLD_NAME, $text, sprintf( '%s still uses the old name: %s', $where, $this->excerpt( self::OLD_NAME, $text ) ) );
		$this->assertDoesNotMatchRegularExpression( self::LOWER_CASE, $text, sprintf( '%s writes the name in lower case: %s', $where, $this->excerpt( self::LOWER_CASE, $text ) ) );
	}

	private function excerpt( string $pattern, string $text ): string {
		if ( ! preg_match( $pattern, $text, $found, PREG_OFFSET_CAPTURE ) ) {
			return '';
		}

		return '"' . substr( $text, max( 0, $found[0][1] - 40 ), 100 ) . '"';
	}

	/**
	 * The `msgid` or every `msgstr` of each entry of a PO file but its header.
	 *
	 * @return list<string>
	 */
	private function strings( string $file, string $field ): array {
		$strings = [];
		$current = null;

		foreach ( explode( "\n", str_replace( "\r\n", "\n", (string) file_get_contents( $this->root() . '/' . $file ) ) ) as $line ) {
			if ( preg_match( '/^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?) "(.*)"$/', $line, $found ) ) {
				$current = str_starts_with( $found[1], $field ) ? count( $strings ) : null;

				if ( null !== $current ) {
					$strings[] = stripcslashes( $found[2] );
				}
			} elseif ( null !== $current && preg_match( '/^"(.*)"$/', $line, $found ) ) {
				$strings[ $current ] .= stripcslashes( $found[1] );
			}
		}

		return array_values( array_filter( $strings, fn ( string $string ): bool => '' !== $string && ! str_starts_with( $string, 'Project-Id-Version:' ) ) );
	}

	/**
	 * @return list<string>
	 */
	private function translations(): array {
		$files = array_map( fn ( string $path ): string => 'languages/' . basename( $path ), glob( $this->root() . '/languages/searcio-*.po' ) );

		$this->assertCount( 7, $files );

		return $files;
	}

	private function find( string $pattern, string $file ): string {
		$this->assertSame( 1, preg_match( $pattern, (string) file_get_contents( $this->root() . '/' . $file ), $found ), sprintf( '%s does not hold what %s looks for.', $file, $pattern ) );

		return $found[1];
	}

	private function root(): string {
		return dirname( __DIR__, 3 );
	}
}
