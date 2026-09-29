<?php
/**
 * The dirty tracker's record of what a site has in the index.
 *
 * The full sync's prune phase reads {@see Dirty_Tracker::indexed_document_ids()}
 * to find documents it has to remove, including ones only the incremental drain
 * ever pushed. These tests pin what that list contains and that it never
 * reaches past the current site of a network.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Sync\Dirty_Tracker;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Indexed_Documents_Test extends Integration_Test_Case {

	private function tracker(): Dirty_Tracker {
		return $this->service( 'dirty_tracker' );
	}

	public function test_lists_the_document_id_of_every_synced_post(): void {
		$post  = self::factory()->post->create();
		$page  = self::factory()->post->create( [ 'post_type' => 'page' ] );
		$never = self::factory()->post->create();

		$this->tracker()->mark_synced( $post, 'hash-a', 1 );
		$this->tracker()->mark_synced( $page, 'hash-b', 1 );

		$ids = $this->tracker()->indexed_document_ids();

		$this->assertEqualsCanonicalizing( [ 'post-' . $post, 'page-' . $page ], $ids );
		$this->assertNotContains( 'post-' . $never, $ids );
	}

	public function test_a_cleared_post_is_no_longer_listed(): void {
		$post = self::factory()->post->create();
		$this->tracker()->mark_synced( $post, 'hash-a', 1 );

		$this->tracker()->clear_for_document( 'post-' . $post );

		$this->assertSame( [], $this->tracker()->indexed_document_ids() );
	}

	/** The list agrees with `was_indexed()`, which reads an empty hash as never pushed. */
	public function test_an_empty_hash_is_not_listed(): void {
		$post = self::factory()->post->create();
		update_post_meta( $post, Sync_Keys::META_DOC_HASH, '' );

		$this->assertFalse( $this->tracker()->was_indexed( $post ) );
		$this->assertSame( [], $this->tracker()->indexed_document_ids() );
	}

	public function test_a_post_carrying_the_hash_twice_is_listed_once(): void {
		$post = self::factory()->post->create();
		add_post_meta( $post, Sync_Keys::META_DOC_HASH, 'hash-a' );
		add_post_meta( $post, Sync_Keys::META_DOC_HASH, 'hash-b' );

		$this->assertSame( [ 'post-' . $post ], $this->tracker()->indexed_document_ids() );
	}

	/**
	 * Each site of a network has its own index, sync runs and snapshot, so a
	 * full sync on one site must never be told to prune another site's
	 * documents.
	 */
	public function test_only_the_current_sites_posts_are_listed(): void {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires a multisite install.' );
		}

		// WooCommerce still listens on the deprecated `wpmu_new_blog` action;
		// see Legacy_Sync_Options_Test for why this keeps the fixture quiet.
		remove_all_actions( 'wpmu_new_blog' );

		$blog_id = self::factory()->blog->create();

		switch_to_blog( $blog_id );
		$other_post = self::factory()->post->create();
		$this->tracker()->mark_synced( $other_post, 'hash-a', 1 );
		$on_other_site = $this->tracker()->indexed_document_ids();
		restore_current_blog();

		$this->assertSame( [ 'post-' . $other_post ], $on_other_site );
		$this->assertSame( [], $this->tracker()->indexed_document_ids() );
	}
}
