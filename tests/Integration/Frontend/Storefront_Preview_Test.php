<?php
/**
 * The storefront config says whether the page is a page builder's editor,
 * so the storefront marks its searches `preview`: Searcio meters them but
 * keeps them out of the site's search statistics.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Storefront_Preview_Test extends Integration_Test_Case {
	private const EDITORS = [ 'elementor-preview', 'et_fb', 'fl_builder', 'ct_builder', 'vc_editable', 'bricks' ];

	public function tear_down(): void {
		foreach ( self::EDITORS as $arg ) {
			unset( $_GET[ $arg ] );
		}

		parent::tear_down();
	}

	public function test_a_page_a_visitor_sees_is_no_preview(): void {
		$this->assertFalse( $this->preview() );
	}

	/**
	 * @dataProvider editors
	 */
	public function test_a_page_builders_editor_canvas_is_a_preview( string $arg, string $value ): void {
		$_GET[ $arg ] = $value;

		$this->assertTrue( $this->preview() );
	}

	/**
	 * @return array<string,array{0:string,1:string}>
	 */
	public static function editors(): array {
		return [
			'Elementor'      => [ 'elementor-preview', '42' ],
			'Divi'           => [ 'et_fb', '1' ],
			'Beaver Builder' => [ 'fl_builder', '' ],
			'Oxygen'         => [ 'ct_builder', 'true' ],
			'WPBakery'       => [ 'vc_editable', 'true' ],
			'Bricks'         => [ 'bricks', 'run' ],
		];
	}

	public function test_an_editor_the_list_does_not_know_can_say_so(): void {
		add_filter( 'webhead_search_cloud/storefront/is_preview', '__return_true' );

		$this->assertTrue( $this->preview() );
	}

	private function preview(): bool {
		return $this->service( 'frontend_config' )->to_array()['preview'];
	}
}
