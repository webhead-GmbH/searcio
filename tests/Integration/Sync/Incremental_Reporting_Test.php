<?php
/**
 * Incremental sync failure reporting.
 *
 * A failed incremental run used to be written to the history with no reason at
 * all — `failed_count: 1`, `last_error: NULL` — and a non-plan-limit push
 * failure recorded nothing whatsoever. From the dashboard that is the hardest
 * kind of sync problem to diagnose, so every failure now says what went wrong.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Enums\Sync_Status;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Incremental_Reporting_Test extends Integration_Test_Case {

	private function drain(): void {
		$this->service( 'incremental_service' )->drain();
	}

	/** @return array<string,mixed>|null */
	private function latest_run(): ?array {
		$runs = $this->sync_state()->history( [ 'per_page' => 1 ] );

		return $runs['items'][0] ?? null;
	}

	/** A push the API rejects is recorded with the status, not dropped silently. */
	public function test_a_rejected_push_is_recorded_with_a_reason(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );

		$this->fake_http( fn(): array => $this->http_ok( [ 'message' => 'nope' ], 503 ) );

		$this->drain();

		$run = $this->latest_run();

		$this->assertNotNull( $run, 'A rejected push must still be recorded in the history.' );
		$this->assertSame( Sync_Status::Failed->value, $run['status'] );
		$this->assertStringContainsString( '503', (string) $run['last_error'] );
	}

	/** A transport failure names the connection problem rather than a status. */
	public function test_an_unreachable_api_is_reported_as_such(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );

		$this->fake_http( static fn() => new \WP_Error( 'http_request_failed', 'cURL error 28: timed out' ) );

		$this->drain();

		$run = $this->latest_run();

		$this->assertNotNull( $run );
		$this->assertStringContainsString( 'timed out', (string) $run['last_error'] );
	}

	/** A delete the index refuses names the document it could not remove. */
	public function test_a_rejected_delete_names_the_document(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Delete );

		$this->fake_http( fn(): array => $this->http_ok( [ 'message' => 'boom' ], 500 ) );

		$this->drain();

		$run = $this->latest_run();

		$this->assertNotNull( $run );
		$this->assertSame( 1, (int) $run['failed_count'] );
		$this->assertStringContainsString( 'post-' . $post_id, (string) $run['last_error'] );
		$this->assertStringContainsString( '500', (string) $run['last_error'] );
	}

	/** A clean drain records the run without inventing an error. */
	public function test_a_successful_drain_records_no_error(): void {
		$this->connect_client();
		$this->enable_indexing( 'post' );

		$post_id = self::factory()->post->create( [ 'post_status' => 'publish' ] );
		$this->service( 'change_queue_table' )->enqueue( $post_id, 'post', Change_Action::Upsert );

		$this->fake_http( fn(): array => $this->http_ok( [ 'status' => 'queued' ], 202 ) );

		$this->drain();

		$run = $this->latest_run();

		$this->assertNotNull( $run );
		$this->assertSame( Sync_Status::Completed->value, $run['status'] );
		$this->assertSame( 1, (int) $run['pushed'] );
		$this->assertEmpty( $run['last_error'] );
	}
}
