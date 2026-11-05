<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Connection;

use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Search_Cloud_Client_Test extends Integration_Test_Case {
	private function client(): Search_Cloud_Client {
		return $this->service( 'search_cloud_client' );
	}

	public function test_legal_links_are_cached_across_calls_within_the_ttl(): void {
		$calls = 0;
		$this->fake_http( function () use ( &$calls ): array {
			$calls++;

			return $this->http_ok( [ 'legal' => [ 'terms' => 'https://sc.test/terms', 'privacy' => null, 'dpa' => null ] ] );
		} );

		$first  = $this->client()->legal_links();
		$second = $this->client()->legal_links();

		$this->assertSame( 1, $calls );
		$this->assertSame( $first, $second );
		$this->assertSame( 'https://sc.test/terms', $first['terms'] );
	}

	public function test_disconnect_sends_a_delete_request_with_the_write_credentials(): void {
		$this->connect_client();

		$captured = null;
		$this->fake_http( function ( string $url, array $args ) use ( &$captured ): array {
			$captured = $args;

			return $this->http_ok( [ 'status' => 'disconnected' ] );
		} );

		$response = $this->client()->disconnect();

		$this->assertTrue( $response->ok() );
		$this->assertSame( 'DELETE', $captured['method'] );
		$this->assertSame( 'test-write-key', $captured['headers']['X-Write-Key'] );
	}

	/**
	 * The certificate is verified on every request, with the development
	 * constant that once turned that off defined as well. A local service with
	 * a certificate of its own authority is the development site's to allow.
	 */
	public function test_every_request_verifies_the_certificate(): void {
		if ( ! defined( 'WEBHEAD_SEARCH_CLOUD_DEVELOPMENT' ) ) {
			define( 'WEBHEAD_SEARCH_CLOUD_DEVELOPMENT', true );
		}

		$this->connect_client();

		$verify = [];
		$this->fake_http( function ( string $url, array $args ) use ( &$verify ): array {
			$verify[] = $args['sslverify'];

			return $this->http_ok( [ 'status' => 'ok' ] );
		} );

		$this->client()->health();
		$this->client()->disconnect();

		$this->assertSame( [ true, true ], $verify );
	}
}
