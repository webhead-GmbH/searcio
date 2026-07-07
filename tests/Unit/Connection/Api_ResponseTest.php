<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Connection;

use PHPUnit\Framework\TestCase;
use WP_Error;
use Webhead\WP\SearchCloud\Connection\Api_Response;

final class Api_ResponseTest extends TestCase {
	public function test_ok_is_true_only_for_2xx_status(): void {
		$this->assertTrue( Api_Response::from_http( 200, [ 'body' => '{}' ] )->ok() );
		$this->assertTrue( Api_Response::from_http( 299, [ 'body' => '{}' ] )->ok() );
		$this->assertFalse( Api_Response::from_http( 199, [ 'body' => '{}' ] )->ok() );
		$this->assertFalse( Api_Response::from_http( 300, [ 'body' => '{}' ] )->ok() );
		$this->assertFalse( Api_Response::from_http( 404, [ 'body' => '{}' ] )->ok() );
	}

	public function test_from_http_decodes_a_json_body(): void {
		$response = Api_Response::from_http( 200, [ 'body' => '{"site_id":5}' ] );

		$this->assertSame( [ 'site_id' => 5 ], $response->body() );
	}

	public function test_from_http_treats_a_non_json_or_missing_body_as_an_empty_array(): void {
		$this->assertSame( [], Api_Response::from_http( 200, [ 'body' => 'not json' ] )->body() );
		$this->assertSame( [], Api_Response::from_http( 200, [] )->body() );
	}

	public function test_from_http_reads_the_retry_after_header_case_insensitively(): void {
		$response = Api_Response::from_http( 429, [ 'body' => '{}', 'headers' => [ 'Retry-After' => '30' ] ] );

		$this->assertSame( 30, $response->retry_after() );
	}

	public function test_from_http_leaves_retry_after_null_when_the_header_is_absent_or_non_numeric(): void {
		$this->assertNull( Api_Response::from_http( 429, [ 'body' => '{}' ] )->retry_after() );
		$this->assertNull(
			Api_Response::from_http( 429, [ 'body' => '{}', 'headers' => [ 'retry-after' => 'never' ] ] )->retry_after()
		);
	}

	public function test_is_plan_limit_requires_a_429_with_a_metric_key(): void {
		$plan_limit = Api_Response::from_http( 429, [ 'body' => '{"metric":"documents","limit":1000}' ] );
		$this->assertTrue( $plan_limit->is_plan_limit() );

		$rate_limit = Api_Response::from_http( 429, [ 'body' => '{}', 'headers' => [ 'retry-after' => '5' ] ] );
		$this->assertFalse( $rate_limit->is_plan_limit() );

		$not_429 = Api_Response::from_http( 500, [ 'body' => '{"metric":"documents"}' ] );
		$this->assertFalse( $not_429->is_plan_limit() );
	}

	public function test_should_retry_is_true_for_transport_errors(): void {
		$response = Api_Response::from_transport_error( new WP_Error( 'http_request_failed', 'timed out' ) );

		$this->assertTrue( $response->should_retry() );
		$this->assertTrue( $response->transport_error );
		$this->assertSame( 'timed out', $response->error_message );
	}

	public function test_should_retry_is_true_for_a_transient_rate_limit_429_but_not_a_plan_limit_429(): void {
		$rate_limit = Api_Response::from_http( 429, [ 'body' => '{}', 'headers' => [ 'retry-after' => '5' ] ] );
		$this->assertTrue( $rate_limit->should_retry() );

		$plan_limit = Api_Response::from_http( 429, [ 'body' => '{"metric":"documents"}' ] );
		$this->assertFalse( $plan_limit->should_retry() );
	}

	public function test_should_retry_is_true_for_5xx_and_false_for_a_normal_4xx_or_2xx(): void {
		$this->assertTrue( Api_Response::from_http( 500, [ 'body' => '{}' ] )->should_retry() );
		$this->assertTrue( Api_Response::from_http( 503, [ 'body' => '{}' ] )->should_retry() );
		$this->assertFalse( Api_Response::from_http( 422, [ 'body' => '{}' ] )->should_retry() );
		$this->assertFalse( Api_Response::from_http( 200, [ 'body' => '{}' ] )->should_retry() );
	}
}
