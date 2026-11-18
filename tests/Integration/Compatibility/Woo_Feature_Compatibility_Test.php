<?php
/**
 * The WooCommerce features the plugin declares itself compatible with.
 *
 * The plugin header names the WooCommerce it was tested with (`WC tested up
 * to`), which makes WooCommerce check every feature: one the plugin does not
 * declare is a feature WooCommerce is "uncertain" about, and the Cart and
 * Checkout blocks name such a plugin as a possibly incompatible extension.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Compatibility;

use ReflectionMethod;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Woo_Feature_Compatibility_Test extends Integration_Test_Case {
	/**
	 * @return array<int|string, string|bool>
	 */
	private function declared(): array {
		$method = new ReflectionMethod( Plugin::class, 'get_woocommerce_feature_compatibility' );

		return $method->invoke( $this->plugin() );
	}

	public function test_it_declares_the_features_it_works_with(): void {
		$this->assertSame( [ 'custom_order_tables', 'cart_checkout_blocks', 'cost_of_goods_sold' ], $this->declared() );
	}

	/**
	 * A feature WooCommerce renamed or dropped would be declared for nothing.
	 */
	public function test_every_feature_it_declares_is_one_woocommerce_has(): void {
		if ( ! function_exists( 'wc_get_container' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$features = wc_get_container()->get( \Automattic\WooCommerce\Internal\Features\FeaturesController::class )->get_features( true, true );

		foreach ( $this->declared() as $key => $value ) {
			$feature = is_string( $key ) ? $key : (string) $value;

			$this->assertArrayHasKey( $feature, $features, $feature . ' is not a feature of WooCommerce ' . WC()->version . '.' );
		}
	}
}
