<?php
/**
 * The head of a page that will search opens the connection to Searcio
 * (search-cloud #164), and that of a page without search does not.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Resource_Hints;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Resource_Hints_Test extends Integration_Test_Case {
	private const SERVICE = 'https://searcio.example:8443/some/path';

	private function handle(): string {
		return $this->plugin()->get_assets()->handle( Frontend_Config::ENTRY );
	}

	protected function tearDown(): void {
		wp_dequeue_script( $this->handle() );
		wp_deregister_script( $this->handle() );
		parent::tearDown();
	}

	public function test_a_page_with_the_storefront_script_preconnects_to_the_service(): void {
		wp_register_script( $this->handle(), 'https://example.org/bundle.search.js', [], '1', true );
		wp_enqueue_script( $this->handle() );

		$hints = ( new Resource_Hints( $this->handle(), self::SERVICE ) )->preconnect( [], 'preconnect' );

		$this->assertSame( [ [ 'href' => 'https://searcio.example:8443', 'crossorigin' => 'anonymous' ] ], $hints );
	}

	public function test_a_page_without_it_does_not(): void {
		$this->assertSame( [], ( new Resource_Hints( $this->handle(), self::SERVICE ) )->preconnect( [], 'preconnect' ) );
	}

	public function test_other_hints_are_left_as_they_are(): void {
		wp_register_script( $this->handle(), 'https://example.org/bundle.search.js', [], '1', true );
		wp_enqueue_script( $this->handle() );

		$this->assertSame( [ 'https://fonts.example' ], ( new Resource_Hints( $this->handle(), self::SERVICE ) )->preconnect( [ 'https://fonts.example' ], 'dns-prefetch' ) );
	}

	/**
	 * Registered with WordPress, and printed with `crossorigin` as the
	 * storefront's anonymous requests need.
	 */
	public function test_the_hint_is_printed_in_the_head(): void {
		wp_register_script( $this->handle(), 'https://example.org/bundle.search.js', [], '1', true );
		wp_enqueue_script( $this->handle() );

		ob_start();
		wp_resource_hints();
		$head = (string) ob_get_clean();

		$origin = Resource_Hints::origin( (string) \Webhead\WP\SearchCloud\SERVICE_URL );

		// WordPress prints the attributes in an order of its own.
		$link = (string) current( array_filter( explode( "\n", $head ), static fn ( string $line ): bool => str_contains( $line, "href='" . $origin . "'" ) ) );

		$this->assertStringContainsString( "rel='preconnect'", $link );
		$this->assertStringContainsString( "crossorigin='anonymous'", $link );
	}
}
