<?php
/**
 * The daily job tells Searcio the shop's currency.
 *
 * Searcio's shopping assistant writes prices in it, and without it the model
 * guessed dollars on a euro shop. The Search Config tab sends it with every
 * save, but a shop may never save that tab, or change its currency later.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Shop_Currency_Test extends Integration_Test_Case {
	public function test_the_daily_job_sends_the_shops_currency(): void {
		if ( ! class_exists( \WooCommerce::class ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->connect_client();
		update_option( 'woocommerce_currency', 'CHF' );
		$sent = $this->run_daily_job();

		$this->assertSame( [ [ 'currency' => 'CHF' ] ], $sent );
	}

	public function test_the_daily_job_sends_no_currency_without_woocommerce(): void {
		if ( class_exists( \WooCommerce::class ) ) {
			$this->markTestSkipped( 'WooCommerce is loaded in this environment.' );
		}

		$this->connect_client();

		$this->assertSame( [], $this->run_daily_job() );
	}

	/**
	 * Run the daily job against a fake service.
	 *
	 * @return array<int,array<string,mixed>> The bodies sent to `/search-config`.
	 */
	private function run_daily_job(): array {
		$sent = [];
		$this->fake_http(
			function ( string $url, array $args ) use ( &$sent ): array {
				$path = (string) wp_parse_url( $url, PHP_URL_PATH );

				if ( str_ends_with( $path, '/search-config' ) ) {
					$sent[] = json_decode( (string) ( $args['body'] ?? '' ), true );

					return $this->http_ok( [ 'currency' => 'CHF' ] );
				}

				return str_ends_with( $path, '/health' )
					? $this->http_ok( [ 'plan' => [ 'is_free' => false, 'name' => 'Pro' ] ] )
					: $this->http_ok( [ 'status' => 'queued' ], 202 );
			}
		);

		( $this->service( 'scheduled_sync_job' ) )();

		return $sent;
	}
}
