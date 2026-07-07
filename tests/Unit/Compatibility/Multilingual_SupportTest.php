<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Compatibility;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Compatibility_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Integrations\Polylang_Integration;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Integrations\Wordfence_Integration;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Integrations\WPML_Integration;
use Webhead\WP\SearchCloud\Tests\Unit\Resets_Wp_Test_State;

/**
 * Exercises the real framework `Compatibility_Manager` and its integration
 * classes (all final, all no-arg constructors) rather than mocking them, so
 * this also proves the Polylang-first provider resolution actually works
 * end-to-end — see the class docblock for the live incident that motivated
 * checking Polylang before WPML.
 */
final class Multilingual_SupportTest extends TestCase {
	use Resets_Wp_Test_State;

	private function support(): Multilingual_Support {
		return new Multilingual_Support( new Compatibility_Manager( new WPML_Integration(), new Polylang_Integration(), new Wordfence_Integration() ) );
	}

	public function test_is_active_is_false_when_neither_plugin_is_active(): void {
		$this->assertFalse( $this->support()->is_active() );
	}

	public function test_is_active_is_true_when_polylang_is_active(): void {
		$GLOBALS['wp_test_state']['pll_active'] = true;

		$this->assertTrue( $this->support()->is_active() );
	}

	public function test_is_active_is_true_when_wpml_is_active(): void {
		add_filter( 'wpml_current_language', static fn( $value ) => $value );

		$this->assertTrue( $this->support()->is_active() );
	}

	public function test_active_languages_is_empty_when_neither_plugin_is_active(): void {
		$this->assertSame( [], $this->support()->active_languages() );
	}

	public function test_active_languages_prefers_polylang_when_both_plugins_report_active(): void {
		// Both WPML's compatibility filter AND Polylang report active — Polylang
		// must win, not WPML, even though WPML happens to have data too. This is
		// the exact live bug this class's docblock documents: Polylang emulates
		// WPML's filters, so checking WPML first silently calls the wrong API.
		$GLOBALS['wp_test_state']['pll_active']    = true;
		$GLOBALS['wp_test_state']['pll_languages'] = [ (object) [ 'slug' => 'de', 'name' => 'Deutsch' ] ];
		add_filter( 'wpml_current_language', static fn( $value ) => $value );
		add_filter(
			'wpml_active_languages',
			static fn() => [ [ 'language_code' => 'en', 'native_name' => 'English' ] ]
		);

		$this->assertSame( [ [ 'code' => 'de', 'name' => 'Deutsch' ] ], $this->support()->active_languages() );
	}

	public function test_active_languages_reads_wpml_active_languages_when_only_wpml_is_active(): void {
		add_filter( 'wpml_current_language', static fn( $value ) => $value );
		add_filter(
			'wpml_active_languages',
			static fn() => [
				[ 'language_code' => 'en', 'native_name' => 'English' ],
				[ 'language_code' => 'fr', 'translated_name' => 'French' ],
			]
		);

		$this->assertSame(
			[
				[ 'code' => 'en', 'name' => 'English' ],
				[ 'code' => 'fr', 'name' => 'French' ],
			],
			$this->support()->active_languages()
		);
	}

	public function test_active_languages_reads_polylang_languages_list_when_only_polylang_is_active(): void {
		$GLOBALS['wp_test_state']['pll_active']    = true;
		$GLOBALS['wp_test_state']['pll_languages'] = [
			(object) [ 'slug' => 'de', 'name' => 'Deutsch' ],
			(object) [ 'slug' => 'en' ],
		];

		$this->assertSame(
			[
				[ 'code' => 'de', 'name' => 'Deutsch' ],
				[ 'code' => 'en', 'name' => 'en' ],
			],
			$this->support()->active_languages()
		);
	}

	public function test_post_language_is_null_when_neither_plugin_is_active(): void {
		$this->assertNull( $this->support()->post_language( 42 ) );
	}

	public function test_post_language_reads_polylang_when_polylang_is_active(): void {
		$GLOBALS['wp_test_state']['pll_active']                    = true;
		$GLOBALS['wp_test_state']['pll_post_language'][ 42 ]        = 'de';

		$this->assertSame( 'de', $this->support()->post_language( 42 ) );
	}

	public function test_post_language_returns_null_when_polylang_has_no_language_for_that_post(): void {
		$GLOBALS['wp_test_state']['pll_active'] = true;

		$this->assertNull( $this->support()->post_language( 42 ) );
	}

	public function test_post_language_reads_wpml_element_language_details_when_wpml_is_active(): void {
		add_filter( 'wpml_current_language', static fn( $value ) => $value );
		add_filter(
			'wpml_element_language_details',
			static fn() => (object) [ 'language_code' => 'fr' ]
		);

		$this->assertSame( 'fr', $this->support()->post_language( 7 ) );
	}
}
