<?php
/**
 * End-to-end sync workflow integration tests.
 *
 * Exercises the resumable tick engine against a real database and posts with
 * the Search Cloud HTTP layer faked out: a full run indexes the catalogue and
 * completes, a running tick honours pause/cancel signals at the batch
 * boundary, and the prune phase removes every document this site pushed that
 * is no longer indexable, whether a full sync or the incremental drain pushed
 * it, including the documents of deleted posts whose delete the index refused.
 * Complements the control-surface tests in {@see Sync_Control_Test}.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Enums\Sync_Control;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Sync\Dirty_Tracker;
use Webhead\WP\SearchCloud\Sync\Failed_Deletes;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Sync_Workflow_Test extends Integration_Test_Case {

	/**
	 * Document ids the fake index was asked to delete, in request order.
	 *
	 * @var array<int,string>
	 */
	private array $delete_requests = [];

	/** The HTTP status the fake index answers a delete with. */
	private int $delete_status = 200;

	/**
	 * Per-document overrides of {@see self::$delete_status}, keyed by document id.
	 *
	 * @var array<string,int>
	 */
	private array $delete_statuses = [];

	public function test_start_is_refused_without_credentials(): void {
		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertFalse( $result['ok'] );
		$this->assertNull( $this->sync_state()->active() );
	}

	public function test_start_is_refused_when_no_post_types_are_indexable(): void {
		$this->connect_client();

		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertFalse( $result['ok'] );
	}

	public function test_start_creates_a_running_run_and_schedules_a_tick(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$result = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );

		$this->assertTrue( $result['ok'] );
		$this->assertSame( Sync_Status::Running->value, $result['run']['status'] );
		$this->assertTrue( $this->tick_is_scheduled() );
	}

	public function test_a_full_run_indexes_every_post_and_completes(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$post_ids = self::factory()->post->create_many( 3, [ 'post_status' => 'publish' ] );

		$upserted = [];
		$this->fake_http(
			function ( string $url, array $args ) use ( &$upserted ): array {
				if ( str_contains( $url, '/documents' ) ) {
					$body = json_decode( (string) ( $args['body'] ?? '{}' ), true );
					$docs = is_array( $body ) && isset( $body['documents'] ) ? $body['documents'] : [];
					$upserted = array_merge( $upserted, is_array( $docs ) ? $docs : [] );
				}

				return $this->http_ok( [ 'ok' => true ] );
			}
		);

		$start = $this->sync_service()->start( Sync_Trigger::Manual, 1, false );
		$this->assertTrue( $start['ok'] );
		$id = (int) $start['run']['id'];

		// Drive the engine deterministically instead of waiting for WP-Cron.
		$this->drain_ticks();

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Completed->value, $run['status'] );
		$this->assertSame( count( $post_ids ), (int) $run['pushed'] );
		$this->assertNull( $this->sync_state()->active() );
		$this->assertCount( count( $post_ids ), $upserted );
	}

	public function test_a_second_unforced_run_skips_unchanged_posts(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok( [ 'ok' => true ] ) );

		$first = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->drain_ticks();
		$this->assertSame( 2, (int) $this->sync_state()->find( $first )['pushed'] );

		$second = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->drain_ticks();
		$second_run = $this->sync_state()->find( $second );

		$this->assertSame( Sync_Status::Completed->value, $second_run['status'] );
		$this->assertSame( 0, (int) $second_run['pushed'], 'Unchanged posts must be skipped via the dirty tracker.' );
		$this->assertSame( 2, (int) $second_run['skipped'] );
	}

	public function test_a_running_tick_honours_a_cancel_signal(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok() );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_state()->request_control( $id, Sync_Control::Cancel );

		$this->sync_service()->tick();

		$this->assertSame( Sync_Status::Cancelled->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_a_running_tick_honours_a_pause_signal_and_can_resume(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create_many( 2, [ 'post_status' => 'publish' ] );
		$this->fake_http( fn(): array => $this->http_ok() );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_state()->request_control( $id, Sync_Control::Pause );

		$this->sync_service()->tick();
		$this->assertSame( Sync_Status::Paused->value, $this->sync_state()->find( $id )['status'] );

		$this->assertTrue( $this->sync_service()->resume( $id ) );
		$this->drain_ticks();
		$this->assertSame( Sync_Status::Completed->value, $this->sync_state()->find( $id )['status'] );
	}

	public function test_a_plan_limit_response_fails_the_run(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		self::factory()->post->create( [ 'post_status' => 'publish' ] );
		// A plan limit is a 429 carrying a `metric` (and is not retried).
		$this->fake_http( fn(): array => $this->http_ok( [ 'metric' => 'documents', 'limit' => 100 ], 429 ) );

		$id = (int) $this->sync_service()->start( Sync_Trigger::Manual, 1, false )['run']['id'];
		$this->sync_service()->tick();

		$run = $this->sync_state()->find( $id );
		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertNotEmpty( $run['last_error'] );
	}

	/**
	 * The incremental drain indexes posts the last full sync never saw, so that
	 * sync's snapshot does not name them. When such a post stops being
	 * indexable without a save (here the mapping stops including private
	 * posts), the next full sync still has to remove it, forced or not, and
	 * leave the posts that are still indexable alone.
	 *
	 * @dataProvider provide_force
	 */
	public function test_a_full_sync_removes_a_drain_indexed_post_that_is_no_longer_indexable( bool $force ): void {
		$this->connect_client();
		$this->enable_indexing( 'post', [ 'include_private' => true ] );
		$this->fake_index();

		$kept = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->run_full_sync();

		$private = self::factory()->post->create( [ 'post_status' => 'private' ] );
		$later   = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $private );
		$this->index_through_the_drain( $later );

		// A mapping change fires no save or status transition for the post.
		$this->enable_indexing( 'post', [ 'include_private' => false ] );

		$run = $this->run_full_sync( $force );

		$this->assertSame( [ 'post-' . $private ], $this->delete_requests );
		$this->assertSame( 1, (int) $run['deleted'] );
		$this->assertFalse( $this->dirty_tracker()->was_indexed( $private ), 'A pruned post must lose its sync meta.' );
		$this->assertTrue( $this->dirty_tracker()->was_indexed( $kept ) );
		$this->assertTrue( $this->dirty_tracker()->was_indexed( $later ) );
	}

	/**
	 * @return array<string,array{0:bool}>
	 */
	public static function provide_force(): array {
		return [
			'unforced' => [ false ],
			'forced'   => [ true ],
		];
	}

	/**
	 * Pruning clears the post's sync meta, so the run after it has nothing left
	 * to remove and sends no further deletes.
	 */
	public function test_a_pruned_post_is_not_deleted_again_by_the_next_full_sync(): void {
		$this->connect_client();
		$this->enable_indexing( 'post', [ 'include_private' => true ] );
		$this->fake_index();
		$this->run_full_sync();

		$private = self::factory()->post->create( [ 'post_status' => 'private' ] );
		$this->index_through_the_drain( $private );
		$this->enable_indexing( 'post', [ 'include_private' => false ] );
		$this->run_full_sync();
		$this->assertSame( [ 'post-' . $private ], $this->delete_requests );

		$this->delete_requests = [];
		$run                   = $this->run_full_sync();

		$this->assertSame( [], $this->delete_requests );
		$this->assertSame( 0, (int) $run['deleted'] );
	}

	/**
	 * A status written straight to the database (an import, a migration, a
	 * clean-up query) fires no transition either, and takes the post out of the
	 * rows the index phase walks at all. The full sync still has to remove the
	 * document the drain pushed for it.
	 */
	public function test_a_full_sync_removes_a_drain_indexed_post_unpublished_outside_wordpress(): void {
		global $wpdb;

		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$wpdb->update( $wpdb->posts, [ 'post_status' => 'draft' ], [ 'ID' => $post_id ] );
		clean_post_cache( $post_id );

		$this->run_full_sync();

		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests );
	}

	/**
	 * Turning a post type off takes its documents out of the index on the next
	 * full sync, including the ones only the drain ever pushed.
	 */
	public function test_a_full_sync_removes_drain_indexed_posts_of_a_disabled_post_type(): void {
		$this->connect_client();
		$this->service( 'index_config' )->save(
			[
				'post' => [ 'enabled' => true ],
				'page' => [ 'enabled' => true ],
			]
		);
		$this->fake_index();
		$this->run_full_sync();

		$page_id = self::factory()->post->create( [ 'post_type' => 'page', 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $page_id );

		$this->service( 'index_config' )->save(
			[
				'post' => [ 'enabled' => true ],
				'page' => [ 'enabled' => false ],
			]
		);

		$this->run_full_sync();

		$this->assertSame( [ 'page-' . $page_id ], $this->delete_requests );
	}

	/**
	 * The drain does not retry a delete the index refused: the change leaves
	 * the queue either way. The post keeps its sync meta, though, so the next
	 * full sync knows the document is still out there and removes it.
	 */
	public function test_a_full_sync_retries_a_delete_the_drain_could_not_complete(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$this->delete_status = 403;
		wp_trash_post( $post_id );
		$this->service( 'incremental_service' )->drain();
		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests, 'The drain has to try, and fail, to delete the document first.' );

		$this->delete_status   = 200;
		$this->delete_requests = [];
		$run                   = $this->run_full_sync();

		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $run['deleted'] );
	}

	/**
	 * A post deleted outright takes its sync meta with it, and a document only
	 * the drain ever pushed is in no snapshot. When the index refuses the
	 * drain's delete for such a post, the next full sync still has to remove
	 * the document, and the run after that must not send the delete again.
	 */
	public function test_a_full_sync_removes_a_deleted_post_the_drain_could_not_remove(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$this->delete_status = 403;
		$this->delete_outright_through_the_drain( $post_id );
		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests, 'The drain has to try, and fail, to delete the document first.' );
		$this->assertNull( get_post( $post_id ) );

		$this->delete_status   = 200;
		$this->delete_requests = [];
		$run                   = $this->run_full_sync();

		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $run['deleted'] );

		$this->delete_requests = [];
		$next                  = $this->run_full_sync();

		$this->assertSame( [], $this->delete_requests, 'A document the index removed must not be deleted again.' );
		$this->assertSame( 0, (int) $next['deleted'] );
	}

	/**
	 * The prune phase can be refused too. The document is still owed a
	 * delete, so every full sync tries again until the index accepts it.
	 */
	public function test_a_full_sync_keeps_retrying_a_deleted_post_the_index_refuses(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$this->delete_status = 403;
		$this->delete_outright_through_the_drain( $post_id );

		$this->delete_requests = [];
		$refused               = $this->run_full_sync();

		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $refused['failed_count'] );
		$this->assertStringContainsString( 'post-' . $post_id, (string) $refused['last_error'] );

		$this->delete_status   = 200;
		$this->delete_requests = [];
		$accepted              = $this->run_full_sync();

		$this->assertSame( [ 'post-' . $post_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $accepted['deleted'] );
		$this->assertSame( [], $this->failed_deletes()->ids() );
	}

	/**
	 * The change listener ignores a post type that is no longer indexed, so a
	 * post of that type deleted outright queues no delete for the drain, and
	 * its sync meta goes with it: only the last full sync's snapshot still
	 * names the document. A full sync writes a new snapshot of what it saw, so
	 * when the index refuses that prune, the next full sync still has to retry
	 * it rather than forget the document for good.
	 */
	public function test_a_full_sync_retries_a_refused_prune_of_a_document_only_the_snapshot_names(): void {
		$this->connect_client();
		$this->service( 'index_config' )->save(
			[
				'post' => [ 'enabled' => true ],
				'page' => [ 'enabled' => true ],
			]
		);
		$this->fake_index();

		$page_id = self::factory()->post->create( [ 'post_type' => 'page', 'post_status' => 'publish' ] );
		$this->run_full_sync();
		// On a real site the upsert the listener queued for the new page was drained long ago.
		$this->service( 'incremental_service' )->drain();

		$this->service( 'index_config' )->save(
			[
				'post' => [ 'enabled' => true ],
				'page' => [ 'enabled' => false ],
			]
		);
		wp_delete_post( $page_id, true );
		$this->assertSame( 0, $this->service( 'change_queue_table' )->pending_count(), 'No delete may be queued for the drain.' );
		$this->assertSame( [], $this->failed_deletes()->ids() );

		$this->delete_status = 403;
		$refused             = $this->run_full_sync();

		$this->assertSame( [ 'page-' . $page_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $refused['failed_count'] );

		$this->delete_requests = [];
		$this->run_full_sync();

		$this->assertSame( [ 'page-' . $page_id ], $this->delete_requests, 'A prune the index refused must be retried by the next full sync.' );
		$this->assertSame( [ 'page-' . $page_id ], $this->failed_deletes()->ids(), 'Refused again, the document stays listed once.' );

		$this->delete_status   = 200;
		$this->delete_requests = [];
		$accepted              = $this->run_full_sync();

		$this->assertSame( [ 'page-' . $page_id ], $this->delete_requests );
		$this->assertSame( 1, (int) $accepted['deleted'] );
		$this->assertSame( [], $this->failed_deletes()->ids() );

		$this->delete_requests = [];
		$this->run_full_sync();

		$this->assertSame( [], $this->delete_requests, 'A document the index removed must not be deleted again.' );
	}

	/**
	 * One document the index keeps refusing must not hold up the drain: its
	 * change leaves the queue along with the rest of the batch, and the other
	 * changes in that batch go through.
	 */
	public function test_a_refused_delete_does_not_hold_up_the_change_queue(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$refused  = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$accepted = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $refused );
		$this->index_through_the_drain( $accepted );

		// Queued for upsert by the change listener, in the same batch as the deletes.
		$edited = self::factory()->post->create( [ 'post_status' => 'publish' ] );

		$this->delete_statuses[ 'post-' . $refused ] = 403;
		wp_delete_post( $refused, true );
		wp_delete_post( $accepted, true );
		$this->service( 'incremental_service' )->drain();

		$this->assertEqualsCanonicalizing( [ 'post-' . $refused, 'post-' . $accepted ], $this->delete_requests );
		$this->assertTrue( $this->dirty_tracker()->was_indexed( $edited ), 'A change queued with a refused delete must still go through.' );
		$this->assertSame( 0, $this->service( 'change_queue_table' )->pending_count() );
		$this->assertSame( [ 'post-' . $refused ], $this->failed_deletes()->ids() );
	}

	/**
	 * A delete the drain completes on a later attempt is no longer owed, so
	 * the full sync does not send it again.
	 */
	public function test_a_delete_the_drain_completes_later_is_not_repeated_by_a_full_sync(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$this->delete_status = 403;
		wp_trash_post( $post_id );
		$this->service( 'incremental_service' )->drain();

		$this->delete_status = 200;
		$this->delete_outright_through_the_drain( $post_id );
		$this->assertSame( [ 'post-' . $post_id, 'post-' . $post_id ], $this->delete_requests );
		$this->assertSame( [], $this->failed_deletes()->ids() );

		$this->delete_requests = [];
		$this->run_full_sync();

		$this->assertSame( [], $this->delete_requests );
	}

	/**
	 * A trashed post whose delete the index refused, then restored and
	 * published again, belongs in the index. The full sync must not remove it
	 * on the strength of the old failure, and stops holding that failure.
	 */
	public function test_a_full_sync_keeps_a_restored_post_whose_delete_was_refused(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );
		$this->fake_index();
		$this->run_full_sync();

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->index_through_the_drain( $post_id );

		$this->delete_status = 403;
		wp_trash_post( $post_id );
		$this->service( 'incremental_service' )->drain();
		$this->assertSame( [ 'post-' . $post_id ], $this->failed_deletes()->ids() );

		// WordPress restores a trashed post as a draft.
		wp_untrash_post( $post_id );
		wp_publish_post( $post_id );
		$this->index_through_the_drain( $post_id );

		$this->delete_status   = 200;
		$this->delete_requests = [];
		$this->run_full_sync();

		$this->assertSame( [], $this->delete_requests );
		$this->assertTrue( $this->dirty_tracker()->was_indexed( $post_id ) );
		$this->assertSame( [], $this->failed_deletes()->ids() );
	}

	/**
	 * WooCommerce's "hide out of stock items" is a store option: switching it
	 * on saves no product, yet takes every out-of-stock product out of the
	 * catalogue. A product only the drain indexed has to leave the index on the
	 * next full sync all the same.
	 */
	public function test_a_full_sync_removes_a_drain_indexed_product_a_store_option_hid(): void {
		if ( ! class_exists( \WC_Product_Simple::class ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->connect_client();
		$this->enable_indexing( 'product' );
		update_option( 'woocommerce_hide_out_of_stock_items', 'no' );
		$this->fake_index();
		$this->run_full_sync();

		$product = new \WC_Product_Simple();
		$product->set_name( 'Sold out' );
		$product->set_regular_price( '10' );
		$product->set_stock_status( 'outofstock' );
		$product->save();
		$this->index_through_the_drain( $product->get_id() );

		update_option( 'woocommerce_hide_out_of_stock_items', 'yes' );

		$this->run_full_sync();

		$this->assertSame( [ 'product-' . $product->get_id() ], $this->delete_requests );
	}

	/**
	 * Run ticks until the active run finishes, guarding against an accidental
	 * infinite loop if a fix ever regresses the terminal conditions.
	 */
	private function drain_ticks( int $max = 50 ): void {
		for ( $i = 0; $i < $max; $i++ ) {
			if ( null === $this->sync_state()->active() ) {
				return;
			}

			$this->sync_service()->tick();
		}

		$this->fail( 'Sync did not finish within the tick budget.' );
	}

	/**
	 * Run a full sync to completion and return its finished row.
	 *
	 * @return array<string,mixed>
	 */
	private function run_full_sync( bool $force = false ): array {
		$start = $this->sync_service()->start( Sync_Trigger::Manual, 1, $force );
		$this->assertTrue( $start['ok'], (string) ( $start['message'] ?? '' ) );

		$this->drain_ticks();

		$run = $this->sync_state()->find( (int) $start['run']['id'] );
		$this->assertSame( Sync_Status::Completed->value, $run['status'] );

		return $run;
	}

	/**
	 * Index a post the way an edit made after a full sync does: through the
	 * change queue and the incremental drain, never through a full sync.
	 */
	private function index_through_the_drain( int $post_id ): void {
		$this->service( 'change_queue_table' )->enqueue( $post_id, (string) get_post_type( $post_id ), Change_Action::Upsert );
		$this->service( 'incremental_service' )->drain();

		$this->assertTrue(
			$this->dirty_tracker()->was_indexed( $post_id ),
			'The drain has to index the post for the test to mean anything.'
		);
	}

	/**
	 * Stand in for the index: every request succeeds, except that a delete is
	 * answered with {@see self::$delete_statuses} or {@see self::$delete_status}
	 * and logged in {@see self::$delete_requests}.
	 */
	private function fake_index(): void {
		$this->fake_http(
			function ( string $url, array $args ): array {
				if ( 'DELETE' !== ( $args['method'] ?? '' ) ) {
					return $this->http_ok( [ 'ok' => true ] );
				}

				$doc_id                  = rawurldecode( wp_basename( (string) wp_parse_url( $url, PHP_URL_PATH ) ) );
				$this->delete_requests[] = $doc_id;

				return $this->http_ok( [], $this->delete_statuses[ $doc_id ] ?? $this->delete_status );
			}
		);
	}

	/**
	 * Delete a post the way the trash's "Delete permanently" does, skipping the
	 * trash, and let the drain send the delete the change listener queued.
	 */
	private function delete_outright_through_the_drain( int $post_id ): void {
		wp_delete_post( $post_id, true );
		$this->service( 'incremental_service' )->drain();
	}

	private function dirty_tracker(): Dirty_Tracker {
		return $this->service( 'dirty_tracker' );
	}

	private function failed_deletes(): Failed_Deletes {
		return $this->service( 'failed_deletes' );
	}
}
