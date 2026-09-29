<?php
/**
 * The list of deletes the index refused.
 *
 * The incremental drain adds to it and the full sync's prune phase reads it,
 * so these tests pin that adding and forgetting are idempotent, that an empty
 * list leaves no option behind, and that each site of a network keeps its own.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Sync\Failed_Deletes;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Failed_Deletes_Test extends Integration_Test_Case {

	private function failed_deletes(): Failed_Deletes {
		return $this->service( 'failed_deletes' );
	}

	public function test_adding_a_document_twice_lists_it_once(): void {
		$this->failed_deletes()->add( [ 'post-1', 'page-2' ] );
		$this->failed_deletes()->add( [ 'page-2', 'post-1', 'post-3' ] );

		$this->assertSame( [ 'post-1', 'page-2', 'post-3' ], $this->failed_deletes()->ids() );
	}

	public function test_forgetting_removes_only_the_named_documents(): void {
		$this->failed_deletes()->add( [ 'post-1', 'post-2', 'post-3' ] );

		$this->failed_deletes()->forget( [ 'post-2', 'post-99' ] );

		$this->assertSame( [ 'post-1', 'post-3' ], $this->failed_deletes()->ids() );
	}

	public function test_forgetting_the_last_document_deletes_the_option(): void {
		$this->failed_deletes()->add( [ 'post-1' ] );

		$this->failed_deletes()->forget( [ 'post-1' ] );

		$this->assertSame( 'missing', get_option( Sync_Keys::OPTION_FAILED_DELETES, 'missing' ) );
	}

	public function test_nothing_is_written_while_nothing_failed(): void {
		$this->failed_deletes()->add( [] );
		$this->failed_deletes()->forget( [ 'post-1' ] );

		$this->assertSame( 'missing', get_option( Sync_Keys::OPTION_FAILED_DELETES, 'missing' ) );
	}

	public function test_an_unreadable_value_is_read_as_an_empty_list(): void {
		update_option( Sync_Keys::OPTION_FAILED_DELETES, 'not-a-list', false );

		$this->assertSame( [], $this->failed_deletes()->ids() );
	}

	/**
	 * Each site of a network has its own index and runs its own full sync, so
	 * one site's refused deletes must never be sent by another.
	 */
	public function test_each_site_keeps_its_own_list(): void {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires a multisite install.' );
		}

		// WooCommerce still listens on the deprecated `wpmu_new_blog` action;
		// see Legacy_Sync_Options_Test for why this keeps the fixture quiet.
		remove_all_actions( 'wpmu_new_blog' );

		$blog_id = self::factory()->blog->create();

		switch_to_blog( $blog_id );
		$this->failed_deletes()->add( [ 'post-7' ] );
		$on_other_site = $this->failed_deletes()->ids();
		restore_current_blog();

		$this->assertSame( [ 'post-7' ], $on_other_site );
		$this->assertSame( [], $this->failed_deletes()->ids() );
	}
}
