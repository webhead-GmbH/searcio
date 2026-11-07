<?php
/**
 * A site in a locale the plugin has no file for reads the nearest one it has,
 * and the German it ships speaks to each locale in that locale's own form.
 *
 * WordPress loads a plugin's translation for the exact locale only, so a site
 * in Canadian French or Mexican Spanish showed the plugin in English, and a
 * site in "Deutsch (Sie)" (de_DE_formal) did too.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Compatibility;

use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Translation_Fallback_Test extends Integration_Test_Case {
	private const SEARCH_BY = 'Search by %s (opens in a new tab)';

	private const MATCHES = 'Your matches';

	/** The storefront bundle's translations are named after its path. */
	private const SEARCH_BUNDLE = 'public/bundle.search.js';

	protected function tearDown(): void {
		unload_textdomain( 'searcio', true );
		parent::tearDown();
	}

	public function test_a_locale_without_a_file_reads_its_languages_main_one(): void {
		$this->assertSame( 'Recherche par %s (s’ouvre dans un nouvel onglet)', $this->translated( 'fr_CA', self::SEARCH_BY ) );
		$this->assertSame( 'Recherche par %s (s’ouvre dans un nouvel onglet)', $this->translated( 'fr_BE', self::SEARCH_BY ) );
		$this->assertSame( 'Búsqueda por %s (se abre en una pestaña nueva)', $this->translated( 'es_MX', self::SEARCH_BY ) );
	}

	public function test_a_language_it_does_not_speak_stays_english(): void {
		$this->assertSame( self::MATCHES, $this->translated( 'pt_BR', self::MATCHES ) );
	}

	/**
	 * WordPress's de_DE and de_CH_informal say "du", its de_DE_formal and
	 * de_CH "Sie"; Swiss German writes ss for ß.
	 */
	public function test_each_german_locale_speaks_in_its_own_form(): void {
		$this->assertSame( 'Deine Treffer', $this->translated( 'de_DE', self::MATCHES ) );
		$this->assertSame( 'Ihre Treffer', $this->translated( 'de_DE_formal', self::MATCHES ) );
		$this->assertSame( 'Deine Treffer', $this->translated( 'de_AT', self::MATCHES ) );
		$this->assertSame( 'Ihre Treffer', $this->translated( 'de_CH', self::MATCHES ) );
		$this->assertSame( 'Deine Treffer', $this->translated( 'de_CH_informal', self::MATCHES ) );
		$this->assertSame( 'Wie auf einem grösseren Bildschirm, bis Sie es hier ändern.', $this->translated( 'de_CH', 'The same as on a larger screen, until you change it here.' ) );
	}

	public function test_the_scripts_read_the_same_stand_in(): void {
		$this->assertSame(
			$this->script_file( 'fr_FR' ),
			$this->with_locale( 'fr_CA', fn (): mixed => apply_filters( 'load_script_translation_file', $this->script_file( 'fr_CA' ), 'searcio-search', 'searcio' ) )
		);
	}

	/**
	 * WordPress.org's language pack for the exact locale is read after the
	 * plugin's folder, so the stand-in steps aside for it.
	 */
	public function test_a_language_pack_for_the_exact_locale_comes_first(): void {
		$pack = WP_LANG_DIR . '/plugins/' . basename( $this->script_file( 'fr_CA' ) );

		wp_mkdir_p( dirname( $pack ) );
		file_put_contents( $pack, '{}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

		try {
			$this->assertSame(
				$this->script_file( 'fr_CA' ),
				$this->with_locale( 'fr_CA', fn (): mixed => apply_filters( 'load_script_translation_file', $this->script_file( 'fr_CA' ), 'searcio-search', 'searcio' ) )
			);
		} finally {
			wp_delete_file( $pack );
		}
	}

	public function test_nothing_outside_its_folder_or_its_domain_is_touched(): void {
		$elsewhere = WP_LANG_DIR . '/plugins/searcio-fr_CA.mo';
		$other     = \Webhead\WP\SearchCloud\PLUGIN_DIR . 'languages/searcio-fr_CA.mo';

		$this->assertSame( $elsewhere, apply_filters( 'load_translation_file', $elsewhere, 'searcio', 'fr_CA' ) );
		$this->assertSame( $other, apply_filters( 'load_translation_file', $other, 'woocommerce', 'fr_CA' ) );
	}

	/**
	 * A string as WordPress translates it once the plugin's file for `$locale`
	 * is asked for, as its just-in-time loading asks for it.
	 */
	private function translated( string $locale, string $text ): string {
		unload_textdomain( 'searcio', true );
		load_textdomain( 'searcio', \Webhead\WP\SearchCloud\PLUGIN_DIR . 'languages/searcio-' . $locale . '.mo', $locale );

		return translate( $text, 'searcio' ); // phpcs:ignore WordPress.WP.I18n -- the strings under test are the arguments.
	}

	private function script_file( string $locale ): string {
		return \Webhead\WP\SearchCloud\PLUGIN_DIR . 'languages/searcio-' . $locale . '-' . md5( self::SEARCH_BUNDLE ) . '.json';
	}

	private function with_locale( string $locale, callable $callback ): mixed {
		$set = static fn (): string => $locale;

		add_filter( 'determine_locale', $set );

		try {
			return $callback();
		} finally {
			remove_filter( 'determine_locale', $set );
		}
	}
}
