<?php
/**
 * The texts an admin types on the Placement tab, registered with WPML and
 * read back in the page's language.
 *
 * WPML is not installed in the test environment, so these tests stand in
 * for it with its public API: answering `wpml_current_language` is what makes
 * the framework take it for active, and `wpml_register_single_string` and
 * `wpml_translate_single_string` are how a plugin talks to its String
 * Translation. Polylang is checked on the demo shop.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Placement_Strings_Test extends Integration_Test_Case {
	/** @var array<int,array{0:string,1:string,2:string}> */
	private array $registered = [];

	public function set_up(): void {
		parent::set_up();

		if ( function_exists( 'pll_register_string' ) ) {
			$this->markTestSkipped( 'Polylang is active here, and is asked before WPML.' );
		}

		$this->registered = [];

		add_filter( 'wpml_current_language', static fn (): string => 'de' );
		add_action(
			'wpml_register_single_string',
			function ( string $context, string $name, string $value ): void {
				$this->registered[] = [ $context, $name, $value ];
			},
			10,
			3
		);
	}

	public function test_saving_registers_the_placeholder_and_the_heading(): void {
		$this->config()->save( [ 'search' => [ 'placeholder' => 'Search the shop' ], 'products' => [ 'heading' => 'You may also like' ] ] );

		$this->assertSame(
			[
				[ 'Searcio', 'Search placeholder', 'Search the shop' ],
				[ 'Searcio', 'Products heading', 'You may also like' ],
			],
			$this->registered
		);
	}

	public function test_an_empty_text_is_not_registered(): void {
		$this->config()->save( [ 'search' => [ 'placeholder' => '' ] ] );

		$this->assertSame( [], $this->registered );
	}

	public function test_the_storefront_reads_them_in_the_pages_language(): void {
		add_filter(
			'wpml_translate_single_string',
			static fn ( string $value, string $context, string $name ): string => match ( $name ) {
				'Search placeholder' => 'Shop durchsuchen',
				'Products heading'   => 'Das gefällt Ihnen vielleicht',
				default              => $value,
			},
			10,
			3
		);

		$this->config()->save( [ 'search' => [ 'placeholder' => 'Search the shop' ], 'products' => [ 'heading' => 'You may also like' ] ] );

		$this->assertStringContainsString( 'data-placeholder="Shop durchsuchen"', do_shortcode( '[searcio]' ) );
		$this->assertStringContainsString( 'data-heading="Das gefällt Ihnen vielleicht"', do_shortcode( '[searcio_products id="product-1"]' ) );
		$this->assertSame( 'Search the shop', $this->config()->options()->search->placeholder, 'What is stored stays as it was typed.' );
	}

	public function test_a_text_written_in_the_shortcode_is_its_own(): void {
		add_filter( 'wpml_translate_single_string', static fn (): string => 'Shop durchsuchen' );
		$this->config()->save( [ 'search' => [ 'placeholder' => 'Search the shop' ] ] );

		$this->assertStringContainsString( 'data-placeholder="Nur Jacken"', do_shortcode( '[searcio placeholder="Nur Jacken"]' ) );
	}

	private function config(): Placement_Config {
		return $this->service( 'placement_config' );
	}
}
