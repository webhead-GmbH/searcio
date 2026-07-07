<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Sync;

use PHPUnit\Framework\TestCase;
use WP_Post;
use Webhead\WP\SearchCloud\Sync\Dirty_Tracker;
use Webhead\WP\SearchCloud\Tests\Unit\Resets_Wp_Test_State;

final class Dirty_TrackerTest extends TestCase {
	use Resets_Wp_Test_State;

	private Dirty_Tracker $tracker;

	protected function setUp(): void {
		parent::setUp();

		$this->tracker = new Dirty_Tracker();
	}

	public function test_a_never_synced_post_is_not_fresh_and_was_not_indexed(): void {
		$post = new WP_Post( [ 'ID' => 1 ] );

		$this->assertFalse( $this->tracker->is_fresh( $post, 'hash-a', 1 ) );
		$this->assertFalse( $this->tracker->was_indexed( 1 ) );
	}

	public function test_mark_synced_then_is_fresh_with_the_same_hash_and_version_is_true(): void {
		$post = new WP_Post( [ 'ID' => 5 ] );

		$this->tracker->mark_synced( 5, 'hash-a', 2 );

		$this->assertTrue( $this->tracker->is_fresh( $post, 'hash-a', 2 ) );
		$this->assertTrue( $this->tracker->was_indexed( 5 ) );
	}

	public function test_is_fresh_is_false_when_the_hash_changed(): void {
		$post = new WP_Post( [ 'ID' => 5 ] );

		$this->tracker->mark_synced( 5, 'hash-a', 2 );

		$this->assertFalse( $this->tracker->is_fresh( $post, 'hash-b', 2 ) );
	}

	public function test_is_fresh_is_false_when_the_mapping_config_version_moved(): void {
		$post = new WP_Post( [ 'ID' => 5 ] );

		$this->tracker->mark_synced( 5, 'hash-a', 2 );

		// Same hash, but the mapping changed since — must re-push regardless.
		$this->assertFalse( $this->tracker->is_fresh( $post, 'hash-a', 3 ) );
	}

	public function test_clear_removes_all_three_meta_keys_so_the_post_is_no_longer_fresh_or_indexed(): void {
		$post = new WP_Post( [ 'ID' => 9 ] );

		$this->tracker->mark_synced( 9, 'hash-a', 1 );
		$this->tracker->clear( 9 );

		$this->assertFalse( $this->tracker->is_fresh( $post, 'hash-a', 1 ) );
		$this->assertFalse( $this->tracker->was_indexed( 9 ) );
	}

	public function test_clear_for_document_resolves_the_post_id_after_the_last_hyphen(): void {
		$this->tracker->mark_synced( 123, 'hash-a', 1 );

		$this->tracker->clear_for_document( 'post-123' );

		$this->assertFalse( $this->tracker->was_indexed( 123 ) );
	}

	public function test_clear_for_document_uses_the_last_hyphen_for_a_hyphenated_type_name(): void {
		$this->tracker->mark_synced( 77, 'hash-a', 1 );

		// A type name that itself contains a hyphen must not confuse the split —
		// only the ID after the *last* hyphen matters.
		$this->tracker->clear_for_document( 'custom-post-type-77' );

		$this->assertFalse( $this->tracker->was_indexed( 77 ) );
	}

	public function test_clear_for_document_is_a_no_op_for_a_document_id_with_no_hyphen(): void {
		$this->tracker->mark_synced( 5, 'hash-a', 1 );

		$this->tracker->clear_for_document( 'malformed' );

		// Nothing should have been touched — the post is still marked synced.
		$this->assertTrue( $this->tracker->was_indexed( 5 ) );
	}
}
