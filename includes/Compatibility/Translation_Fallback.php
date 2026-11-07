<?php
/**
 * A locale of WordPress the plugin has no translation for, near one it has.
 *
 * WordPress loads a plugin's translation for the site's exact locale and for
 * no other: a site in the French of Belgium or Canada, or in the Spanish of
 * Mexico or Argentina, showed the plugin in English although it ships French
 * and Spanish. German is shipped in every locale WordPress has for it, each in
 * its own form of address; for any other locale of a language the plugin
 * speaks, the language's main locale stands in (fr_CA reads fr_FR, es_MX reads
 * es_ES), for the strings of PHP and of the scripts alike.
 *
 * Only a file of the plugin's own `languages/` folder is stood in for. A
 * language pack from WordPress.org for the exact locale, in
 * wp-content/languages/plugins, is still read first.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Compatibility;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Translation_Fallback {
	/** @var list<string>|null The locales the folder has a translation for. */
	private ?array $shipped = null;

	/**
	 * @param string $directory The plugin's `languages/` folder.
	 * @param string $domain    The plugin's text domain.
	 */
	public function __construct(
		private string $directory,
		private string $domain
	) {}

	/**
	 * The shipped locale that stands in for `$locale`: the same locale without
	 * its variant (de_CH for a de_CH_formal), then the language's main locale
	 * (fr_FR for fr_CA). Null when `$locale` is shipped itself, or when no
	 * locale of its language is.
	 *
	 * @param list<string> $shipped
	 */
	public static function stand_in( string $locale, array $shipped ): ?string {
		if ( '' === $locale || in_array( $locale, $shipped, true ) ) {
			return null;
		}

		$parts      = explode( '_', $locale );
		$language   = strtolower( $parts[0] );
		$candidates = [];

		if ( count( $parts ) > 2 ) {
			$candidates[] = $parts[0] . '_' . $parts[1];
		}

		$candidates[] = $language . '_' . strtoupper( $language );

		foreach ( $candidates as $candidate ) {
			if ( in_array( $candidate, $shipped, true ) ) {
				return $candidate;
			}
		}

		return null;
	}

	/**
	 * The strings of PHP: WordPress asks for `.l10n.php` and then `.mo` in the
	 * folder the plugin named, for the request's locale.
	 */
	#[Filter( 'load_translation_file', accepted_args: 3 )]
	public function translation_file( mixed $file, mixed $domain = '', mixed $locale = '' ): mixed {
		if ( $this->domain !== $domain || ! is_string( $file ) || ! is_string( $locale ) || is_readable( $file ) || ! $this->is_own( $file ) ) {
			return $file;
		}

		return $this->stand_in_file( $file, $locale ) ?? $file;
	}

	/**
	 * The scripts' strings: WordPress looks in the plugin's folder before the
	 * language packs, so a pack for the exact locale keeps the way to it open.
	 */
	#[Filter( 'load_script_translation_file', accepted_args: 3 )]
	public function script_translation_file( mixed $file, mixed $handle = '', mixed $domain = '' ): mixed {
		if ( $this->domain !== $domain || ! is_string( $file ) || is_readable( $file ) || ! $this->is_own( $file ) ) {
			return $file;
		}

		if ( is_readable( WP_LANG_DIR . '/plugins/' . basename( $file ) ) ) {
			return $file;
		}

		return $this->stand_in_file( $file, determine_locale() ) ?? $file;
	}

	/**
	 * The file of the stand-in locale beside `$file`, if there is one:
	 * `searcio-fr_CA.mo` is read as `searcio-fr_FR.mo`, and
	 * `searcio-fr_CA-<md5>.json` as `searcio-fr_FR-<md5>.json`.
	 */
	private function stand_in_file( string $file, string $locale ): ?string {
		$stand_in = self::stand_in( $locale, $this->shipped() );
		$prefix   = $this->domain . '-' . $locale;
		$name     = basename( $file );

		if ( null === $stand_in || ! ( str_starts_with( $name, $prefix . '.' ) || str_starts_with( $name, $prefix . '-' ) ) ) {
			return null;
		}

		$candidate = dirname( $file ) . '/' . $this->domain . '-' . $stand_in . substr( $name, strlen( $prefix ) );

		return is_readable( $candidate ) ? $candidate : null;
	}

	/**
	 * Whether `$file` is in the plugin's folder. WordPress names that folder
	 * from the plugin's path or from an asset's (`public/../languages`), so
	 * the two are compared resolved.
	 */
	private function is_own( string $file ): bool {
		$folder = realpath( dirname( $file ) );

		return false !== $folder && realpath( $this->directory ) === $folder;
	}

	/**
	 * @return list<string>
	 */
	private function shipped(): array {
		if ( null === $this->shipped ) {
			$this->shipped = [];

			foreach ( glob( rtrim( $this->directory, '/\\' ) . '/' . $this->domain . '-*.mo' ) ?: [] as $compiled ) {
				$this->shipped[] = substr( basename( $compiled, '.mo' ), strlen( $this->domain ) + 1 );
			}
		}

		return $this->shipped;
	}
}
