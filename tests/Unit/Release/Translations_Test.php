<?php
/**
 * The translations the plugin ships.
 *
 * A translation that loses a placeholder prints a warning or a sentence with
 * a hole in it, one that loses a tag breaks the markup around it, and one
 * with the wrong number of plural forms shows the wrong form for some
 * numbers. None of that shows in English, so these tests read every PO file
 * in `languages/` against the template it was made from.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Release;

use PHPUnit\Framework\TestCase;

final class Translations_Test extends TestCase {
	private const PLACEHOLDER = '/%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?[bcdeEfFgGosuxX]|%%/';
	private const TAG         = '/<\/?[a-zA-Z][^>]*>/';

	/**
	 * @return array<string, array{string}>
	 */
	public static function locales(): array {
		$locales = [];

		foreach ( glob( dirname( __DIR__, 3 ) . '/languages/searcio-*.po' ) as $file ) {
			$locale             = substr( basename( $file, '.po' ), strlen( 'searcio-' ) );
			$locales[ $locale ] = [ $locale ];
		}

		return $locales;
	}

	public function test_the_plugin_ships_the_languages_it_names(): void {
		$this->assertEqualsCanonicalizing(
			[ 'de_DE', 'de_AT', 'de_CH', 'fr_FR', 'es_ES', 'it_IT', 'pl_PL' ],
			array_keys( self::locales() )
		);
	}

	/**
	 * @dataProvider locales
	 */
	public function test_the_header_names_the_language_and_the_text_domain( string $locale ): void {
		$header = $this->header( $locale );

		$this->assertSame( $locale, $header['Language'] ?? null );
		$this->assertSame( 'searcio', $header['X-Domain'] ?? null );
		$this->assertMatchesRegularExpression( '/^nplurals=\d+; plural=.+;$/', $header['Plural-Forms'] ?? '' );
	}

	/**
	 * @dataProvider locales
	 */
	public function test_every_translation_keeps_what_the_code_fills_in( string $locale ): void {
		$plurals = $this->plural_count( $locale );
		$checked = 0;

		foreach ( $this->entries( 'languages/searcio-' . $locale . '.po' ) as $entry ) {
			$forms = array_filter( $entry['msgstr'], static fn ( string $form ): bool => '' !== $form );

			if ( [] === $forms ) {
				continue;
			}

			$label = sprintf( '%s: "%s"', $locale, $entry['msgid'] );

			if ( null !== $entry['msgid_plural'] ) {
				$this->assertCount( $plurals, $entry['msgstr'], $label . ' needs one form for each plural of the language.' );
			}

			foreach ( $forms as $index => $form ) {
				$original = null === $entry['msgid_plural'] || 0 === $index ? $entry['msgid'] : $entry['msgid_plural'];
				$expected = $this->found( self::PLACEHOLDER, $original );
				$actual   = $this->found( self::PLACEHOLDER, $form );

				// A singular may say the number in words ("one item") and drop it.
				if ( null !== $entry['msgid_plural'] ) {
					$this->assertEmpty( array_diff( $actual, $this->found( self::PLACEHOLDER, $entry['msgid_plural'] ) ), $label );
				} else {
					$this->assertSame( $expected, $actual, $label . ' changes its placeholders.' );
				}

				$this->assertSame( $this->found( self::TAG, $original ), $this->found( self::TAG, $form ), $label . ' changes its HTML.' );
				$this->assertDoesNotMatchRegularExpression( '/[\x{2013}\x{2014}]/u', $form, $label . ' has a dash: write "-".' );
				++$checked;
			}
		}

		$this->assertGreaterThan( 0, $checked );
	}

	/**
	 * @dataProvider locales
	 */
	public function test_every_string_it_translates_is_in_the_template( string $locale ): void {
		$template = array_map( [ $this, 'key' ], $this->entries( 'languages/searcio.pot' ) );

		foreach ( $this->entries( 'languages/searcio-' . $locale . '.po' ) as $entry ) {
			$this->assertContains( $this->key( $entry ), $template, sprintf( '%s translates "%s", which the plugin no longer has.', $locale, $entry['msgid'] ) );
		}
	}

	/**
	 * WordPress reads the compiled file, and the scripts read one JSON file
	 * per built bundle, named after the bundle's path.
	 *
	 * @dataProvider locales
	 */
	public function test_each_language_is_compiled_for_php_and_for_the_scripts( string $locale ): void {
		$languages = dirname( __DIR__, 3 ) . '/languages/';

		$this->assertFileExists( $languages . 'searcio-' . $locale . '.mo' );

		$map     = json_decode( (string) file_get_contents( $languages . 'script-translation-map.json' ), true );
		$bundles = array_unique( array_merge( ...array_values( $map ) ) );

		foreach ( $bundles as $bundle ) {
			$this->assertFileExists( $languages . 'searcio-' . $locale . '-' . md5( $bundle ) . '.json', $locale . ' has no translations for ' . $bundle );
		}
	}

	private function plural_count( string $locale ): int {
		preg_match( '/nplurals=(\d+)/', $this->header( $locale )['Plural-Forms'] ?? '', $found );

		return (int) ( $found[1] ?? 0 );
	}

	/**
	 * @return array<string, string>
	 */
	private function header( string $locale ): array {
		$raw = '';

		foreach ( $this->entries( 'languages/searcio-' . $locale . '.po', true ) as $entry ) {
			if ( '' === $entry['msgid'] ) {
				$raw = $entry['msgstr'][0] ?? '';
				break;
			}
		}

		$header = [];

		foreach ( explode( "\n", $raw ) as $line ) {
			if ( str_contains( $line, ':' ) ) {
				[ $name, $value ]         = explode( ':', $line, 2 );
				$header[ trim( $name ) ] = trim( $value );
			}
		}

		return $header;
	}

	/**
	 * @return string[]
	 */
	private function found( string $pattern, string $text ): array {
		preg_match_all( $pattern, $text, $matches );
		$found = $matches[0];
		sort( $found );

		return $found;
	}

	/**
	 * @param array{msgctxt: ?string, msgid: string} $entry
	 */
	private function key( array $entry ): string {
		return ( $entry['msgctxt'] ?? '' ) . "\x04" . $entry['msgid'];
	}

	/**
	 * The entries of a PO or POT file.
	 *
	 * @return list<array{msgctxt: ?string, msgid: string, msgid_plural: ?string, msgstr: array<int, string>}>
	 */
	private function entries( string $file, bool $with_header = false ): array {
		$path = dirname( __DIR__, 3 ) . '/' . $file;

		$this->assertFileExists( $path );

		$entries = [];

		foreach ( preg_split( '/\n\s*\n/', trim( str_replace( "\r\n", "\n", (string) file_get_contents( $path ) ) ) ) as $block ) {
			$entry = [ 'msgctxt' => null, 'msgid' => null, 'msgid_plural' => null, 'msgstr' => [] ];
			$field = null;

			foreach ( explode( "\n", $block ) as $line ) {
				if ( preg_match( '/^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+"(.*)"$/', $line, $match ) ) {
					$value = stripcslashes( $match[3] );

					if ( str_starts_with( $match[1], 'msgstr' ) ) {
						$field                     = (int) ( '' === $match[2] ? 0 : $match[2] );
						$entry['msgstr'][ $field ] = $value;
					} else {
						$field           = $match[1];
						$entry[ $field ] = $value;
					}
				} elseif ( str_starts_with( $line, '"' ) && null !== $field ) {
					$value = stripcslashes( substr( $line, 1, -1 ) );

					if ( is_int( $field ) ) {
						$entry['msgstr'][ $field ] .= $value;
					} else {
						$entry[ $field ] .= $value;
					}
				}
			}

			if ( null !== $entry['msgid'] && ( $with_header || '' !== $entry['msgid'] ) ) {
				$entries[] = $entry;
			}
		}

		return $entries;
	}
}
