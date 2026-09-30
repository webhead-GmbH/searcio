<?php
/**
 * Term changes reaching the change queue.
 *
 * A document carries term names - and, for product categories, the names of
 * every ancestor - so renaming, moving or deleting a term changes documents
 * whose posts were never saved. These run against the booted plugin's own
 * listener, through WordPress's real term functions, because hook order is the
 * whole point: a move and a delete are only visible before WordPress finishes
 * rewriting the hierarchy.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Database\Tables\Change_Queue_Table;
use Webhead\WP\SearchCloud\DTO\Queued_Change;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Change_Listener_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		$this->enable_indexing( 'post' );
	}

	public function test_renaming_a_category_queues_posts_under_it_and_under_its_children(): void {
		$shoes     = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$sneakers  = self::factory()->category->create( [ 'name' => 'Sneakers', 'parent' => $shoes ] );
		$hats      = self::factory()->category->create( [ 'name' => 'Hats' ] );
		$in_parent = $this->post_in( $shoes );
		$in_child  = $this->post_in( $sneakers );
		$this->post_in( $hats );
		$this->empty_queue();

		wp_update_term( $shoes, 'category', [ 'name' => 'Footwear' ] );

		$this->assertEqualsCanonicalizing( [ $in_parent, $in_child ], $this->queued_ids() );

		foreach ( $this->queue()->claim( 100 ) as $change ) {
			$this->assertSame( Change_Action::Upsert, $change->action, 'A rename refreshes a document; it never removes one.' );
		}
	}

	public function test_moving_a_category_queues_posts_under_it(): void {
		$clothing = self::factory()->category->create( [ 'name' => 'Clothing' ] );
		$shoes    = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$sneakers = self::factory()->category->create( [ 'name' => 'Sneakers', 'parent' => $clothing ] );
		$post_id  = $this->post_in( $sneakers );
		$this->post_in( $clothing );
		$this->empty_queue();

		wp_update_term( $sneakers, 'category', [ 'parent' => $shoes ] );

		$this->assertSame( [ $post_id ], $this->queued_ids() );
	}

	/**
	 * Only the name and the place in the tree reach a document. Anything else
	 * re-queuing a whole category would rebuild every product in it for
	 * nothing.
	 */
	public function test_an_edit_that_keeps_the_name_and_parent_queues_nothing(): void {
		$term_id = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$this->post_in( $term_id );
		$this->empty_queue();

		wp_update_term( $term_id, 'category', [ 'description' => 'Everything for your feet.', 'slug' => 'footwear' ] );

		$this->assertSame( [], $this->queued_ids() );
	}

	/**
	 * WordPress detaches the term's posts and hands its children to its parent
	 * while deleting it, and saves none of those posts.
	 */
	public function test_deleting_a_category_queues_posts_under_it_and_under_its_children(): void {
		$shoes     = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$sneakers  = self::factory()->category->create( [ 'name' => 'Sneakers', 'parent' => $shoes ] );
		$in_parent = $this->post_in( $shoes );
		$in_child  = $this->post_in( $sneakers );
		$this->empty_queue();

		wp_delete_term( $shoes, 'category' );

		$this->assertEqualsCanonicalizing( [ $in_parent, $in_child ], $this->queued_ids() );
	}

	/**
	 * A draft was never indexed, so there is nothing to refresh and nothing to
	 * delete.
	 */
	public function test_a_post_that_is_not_indexed_is_not_queued(): void {
		$term_id   = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$published = $this->post_in( $term_id );
		$this->post_in( $term_id, 'draft' );
		$this->empty_queue();

		wp_update_term( $term_id, 'category', [ 'name' => 'Footwear' ] );

		$this->assertSame( [ $published ], $this->queued_ids() );
	}

	public function test_a_term_in_a_taxonomy_no_indexed_type_uses_is_ignored(): void {
		$term_id = self::factory()->category->create( [ 'name' => 'Shoes' ] );
		$this->post_in( $term_id );
		$this->enable_indexing( 'page' );
		$this->empty_queue();

		wp_update_term( $term_id, 'category', [ 'name' => 'Footwear' ] );

		$this->assertSame( [], $this->queued_ids() );
	}

	private function post_in( int $term_id, string $status = 'publish' ): int {
		return self::factory()->post->create( [ 'post_status' => $status, 'post_category' => [ $term_id ] ] );
	}

	private function queue(): Change_Queue_Table {
		return $this->service( 'change_queue_table' );
	}

	/**
	 * Drops what the fixtures' own saves queued. Not `clear()`: that is a
	 * TRUNCATE, which commits the test's transaction and leaks every fixture
	 * into the tests that run after it.
	 */
	private function empty_queue(): void {
		$this->queue()->remove(
			array_map( static fn( Queued_Change $change ): int => $change->id, $this->queue()->claim( 1000 ) )
		);
	}

	/**
	 * @return array<int,int>
	 */
	private function queued_ids(): array {
		return array_map( static fn( Queued_Change $change ): int => $change->object_id, $this->queue()->claim( 100 ) );
	}
}
