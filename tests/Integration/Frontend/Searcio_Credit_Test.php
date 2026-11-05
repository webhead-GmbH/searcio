<?php
/**
 * The Searcio logo in the search window.
 *
 * The storefront is told whether to show it in its configuration
 * (`credit`): only when the shop turned Support Searcio on, on any plan. The
 * plan tier the site keeps decides nothing here; the daily job keeps it current
 * for the settings screen's Upgrade action.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Searcio_Credit_Test extends Integration_Test_Case {
	public function test_the_logo_is_off_until_the_shop_turns_it_on(): void {
		$this->assertNull( $this->config()['credit'] );

		$this->settings()->set( Plugin_Settings::SUPPORT_SEARCIO, true );
		$config = $this->config();

		$this->assertSame( [ 'url' => 'https://searcio.com/' ], $config['credit'] );
		$this->assertStringContainsString( 'Searcio', $config['i18n']['credit'] );
	}

	/**
	 * @dataProvider plans
	 */
	public function test_no_plan_decides_for_the_shop( string $tier, bool $support, bool $shown ): void {
		$this->settings()->set( Plugin_Settings::PLAN_TIER, $tier );
		$this->settings()->set( Plugin_Settings::SUPPORT_SEARCIO, $support );

		$this->assertSame( $shown, null !== $this->config()['credit'] );
	}

	/**
	 * @return array<string,array{0:string,1:bool,2:bool}>
	 */
	public static function plans(): array {
		return [
			// plan tier, Support Searcio, shown.
			'a Free plan, off'        => [ 'free', false, false ],
			'a Free plan, turned on'  => [ 'free', true, true ],
			'a paid plan, off'        => [ 'paid', false, false ],
			'a paid plan, turned on'  => [ 'paid', true, true ],
			'a plan not known yet'    => [ '', false, false ],
		];
	}

	public function test_the_daily_job_keeps_the_tier_current(): void {
		$this->connect_client();
		$this->settings()->set( Plugin_Settings::PLAN_TIER, 'paid' );
		$this->settings()->set( Plugin_Settings::SUPPORT_SEARCIO, false );
		$this->fake_http(
			fn ( string $url ): array => str_ends_with( wp_parse_url( $url, PHP_URL_PATH ) ?? '', '/health' )
				? $this->http_ok( [ 'plan' => [ 'is_free' => true, 'name' => 'Free' ] ] )
				: $this->http_ok( [ 'status' => 'queued' ], 202 )
		);

		( $this->service( 'scheduled_sync_job' ) )();

		$this->assertSame( 'free', $this->settings()->get( Plugin_Settings::PLAN_TIER ) );
		$this->assertNull( $this->config()['credit'], 'A plan that became Free does not turn the logo on.' );
	}

	public function test_the_daily_job_asks_nothing_of_a_site_that_is_not_connected(): void {
		$asked = false;
		$this->fake_http(
			function () use ( &$asked ): array {
				$asked = true;

				return $this->http_ok();
			}
		);

		( $this->service( 'scheduled_sync_job' ) )();

		$this->assertFalse( $asked );
		$this->assertSame( '', $this->settings()->get( Plugin_Settings::PLAN_TIER ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function config(): array {
		return $this->service( 'frontend_config' )->to_array();
	}
}
