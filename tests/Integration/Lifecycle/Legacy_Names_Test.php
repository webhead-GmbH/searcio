<?php
/**
 * The plugin's names before 1.4.0 go on working where the move of
 * `Legacy_Slug` cannot reach.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use RuntimeException;
use WP_Block_Type_Registry;
use Webhead\WP\SearchCloud\Lifecycle\Legacy_Names;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Legacy_Names_Test extends Integration_Test_Case {
	public function test_a_block_saved_under_its_first_name_is_drawn_as_the_new_block(): void {
		$registry = WP_Block_Type_Registry::get_instance();

		$this->assertTrue( $registry->is_registered( 'webhead-search-cloud/search' ) );
		$this->assertTrue( $registry->is_registered( 'webhead-search-cloud/products' ) );
		$this->assertFalse( $registry->get_registered( 'webhead-search-cloud/search' )->supports['inserter'], 'Only the new block is offered.' );

		$old = do_blocks( '<!-- wp:webhead-search-cloud/search {"mode":"box"} /-->' );
		$new = do_blocks( '<!-- wp:searcio/search {"mode":"box"} /-->' );

		$this->assertNotSame( '', trim( $old ) );
		$this->assertSame( $this->without_ids( $new ), $this->without_ids( $old ) );
	}

	public function test_a_callback_on_a_filters_first_name_still_runs_first(): void {
		$this->setExpectedDeprecated( 'webhead_search_cloud/sync/tick_budget' );

		add_filter( 'webhead_search_cloud/sync/tick_budget', static fn (): int => 7 );
		add_filter( 'searcio_sync_tick_budget', static fn ( int $budget ): int => $budget + 1 );

		$this->assertSame( 8, apply_filters( 'searcio_sync_tick_budget', 20 ) );
	}

	public function test_the_settings_page_under_its_first_address_leads_to_the_new_one(): void {
		$_GET['page'] = 'webhead-search-cloud';
		$to           = null;

		add_filter(
			'wp_redirect',
			static function ( string $location ) use ( &$to ): string {
				$to = $location;

				throw new RuntimeException( 'redirected' );
			}
		);

		try {
			( new Legacy_Names() )->redirect_settings_page();
		} catch ( RuntimeException ) {
			// The redirect is all there is to see; it exits after.
		} finally {
			unset( $_GET['page'] );
		}

		$this->assertIsString( $to );
		$this->assertStringContainsString( 'page=searcio', $to );
		$this->assertStringNotContainsString( 'webhead-search-cloud', $to );
	}

	/** The block draws ids that differ from one render to the next. */
	private function without_ids( string $html ): string {
		return (string) preg_replace( '/(id|for|aria-[a-z]+)="[^"]*"/', '', $html );
	}
}
