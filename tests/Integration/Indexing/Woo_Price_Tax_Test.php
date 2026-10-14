<?php
/**
 * Tax-aware price indexing tests.
 *
 * The index is built where no shopper is (WP-Cron, or WP-CLI) and shown to
 * every shopper as it is, so the price it carries has to be the one the shop
 * displays: with tax when the shop shows prices with tax, without when it
 * does not. A variable product's range already came from WooCommerce's
 * display prices while a simple product's price was the raw stored amount, so
 * in a shop that enters net prices and shows gross ones the two kinds were
 * indexed on different bases.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use WC_Product_Grouped;
use WC_Product_Simple;
use WC_Product_Variable;
use WC_Product_Variation;
use WC_Tax;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Woo_Price_Tax_Test extends Integration_Test_Case {
	private const PRICE_TOGGLES = [ 'price' => true, 'regular_sale' => true ];

	private Woo $woo;

	/**
	 * The guest customer WooCommerce created at `init`. It is a PHP object, so
	 * the per-test rollback does not restore it.
	 */
	private ?\WC_Customer $customer = null;

	public function set_up(): void {
		parent::set_up();

		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_get_product' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->woo      = new Woo();
		$this->customer = WC()->customer;
	}

	public function tear_down(): void {
		if ( function_exists( 'WC' ) ) {
			WC()->customer = $this->customer;
		}

		parent::tear_down();
	}

	/**
	 * Every combination of the tax settings, entered price and expected
	 * indexed price.
	 *
	 * @return array<string,array{0:string,1:string,2:string,3:string,4:string,5:float}>
	 */
	public static function shop_provider(): array {
		return [
			// calc_taxes, prices_include_tax, tax_display_shop, tax_status, entered, indexed.
			'net prices shown with tax'           => [ 'yes', 'no', 'incl', 'taxable', '100', 119.0 ],
			'gross prices shown without tax'      => [ 'yes', 'yes', 'excl', 'taxable', '119', 100.0 ],
			'gross prices rounded to the shop'    => [ 'yes', 'yes', 'excl', 'taxable', '99.99', 84.03 ],
			'gross prices shown with tax'         => [ 'yes', 'yes', 'incl', 'taxable', '119', 119.0 ],
			'net prices shown without tax'        => [ 'yes', 'no', 'excl', 'taxable', '100', 100.0 ],
			'taxes switched off'                  => [ 'no', 'no', 'incl', 'taxable', '100', 100.0 ],
			'a product that is not taxable'       => [ 'yes', 'no', 'incl', 'none', '100', 100.0 ],
			'a product taxable for shipping only' => [ 'yes', 'no', 'incl', 'shipping', '100', 100.0 ],
		];
	}

	/**
	 * The drift guard for the reported bug: whatever the tax settings, a simple
	 * product and a variation at the same price are indexed at the same price.
	 *
	 * @dataProvider shop_provider
	 */
	public function test_simple_and_variable_products_are_indexed_on_the_same_tax_basis(
		string $calc_taxes,
		string $prices_include_tax,
		string $display,
		string $tax_status,
		string $entered,
		float $indexed
	): void {
		$this->tax_shop( 'yes' === $prices_include_tax, $display );
		update_option( 'woocommerce_calc_taxes', $calc_taxes );

		$simple   = $this->fields( $this->simple( $entered, '', $tax_status ) );
		$variable = $this->fields( $this->variable( [ $entered ], $tax_status ) );

		$this->assertSame( $indexed, $simple['price'] );
		$this->assertSame( $indexed, $simple['regular_price'] );
		$this->assertSame( $indexed, $variable['price_min'] );
		$this->assertSame( $simple['price'], $variable['price'] );
	}

	/** (a) Net prices entered, prices shown with tax. */
	public function test_net_prices_are_indexed_with_tax_when_the_shop_shows_them_with_tax(): void {
		$this->tax_shop( false, 'incl' );

		$regular  = $this->fields( $this->simple( '100' ) );
		$on_sale  = $this->fields( $this->simple( '100', '50' ) );
		$variable = $this->fields( $this->variable( [ '100', '50' ] ) );

		$this->assertSame( 119.0, $regular['price'] );
		$this->assertSame( 119.0, $regular['regular_price'] );
		$this->assertArrayNotHasKey( 'sale_price', $regular, 'A product with no sale price was given one.' );

		$this->assertSame( 59.5, $on_sale['price'] );
		$this->assertSame( 119.0, $on_sale['regular_price'] );
		$this->assertSame( 59.5, $on_sale['sale_price'] );
		$this->assertTrue( $on_sale['on_sale'] );

		$this->assertSame( 59.5, $variable['price'] );
		$this->assertSame( 59.5, $variable['price_min'] );
		$this->assertSame( 119.0, $variable['price_max'] );
	}

	/** (b) Gross prices entered, prices shown without tax. */
	public function test_gross_prices_are_indexed_without_tax_when_the_shop_shows_them_without_tax(): void {
		$this->tax_shop( true, 'excl' );

		$on_sale  = $this->fields( $this->simple( '119', '59.5' ) );
		$variable = $this->fields( $this->variable( [ '119', '59.5' ] ) );

		$this->assertSame( 50.0, $on_sale['price'] );
		$this->assertSame( 100.0, $on_sale['regular_price'] );
		$this->assertSame( 50.0, $on_sale['sale_price'] );

		$this->assertSame( 50.0, $variable['price_min'] );
		$this->assertSame( 100.0, $variable['price_max'] );
	}

	/** (c) Taxes switched off: the rate and the display setting are ignored. */
	public function test_prices_are_indexed_as_entered_when_taxes_are_off(): void {
		$this->tax_shop( false, 'incl' );
		update_option( 'woocommerce_calc_taxes', 'no' );

		$simple   = $this->fields( $this->simple( '100', '50' ) );
		$variable = $this->fields( $this->variable( [ '100', '50' ] ) );

		$this->assertSame( 50.0, $simple['price'] );
		$this->assertSame( 100.0, $simple['regular_price'] );
		$this->assertSame( 50.0, $simple['sale_price'] );
		$this->assertSame( 50.0, $variable['price_min'] );
		$this->assertSame( 100.0, $variable['price_max'] );
	}

	/** (d) A product whose tax status is "None" carries no tax in a taxed shop. */
	public function test_a_product_that_is_not_taxable_is_indexed_as_entered(): void {
		$this->tax_shop( false, 'incl' );

		$simple   = $this->fields( $this->simple( '100', '', 'none' ) );
		$variable = $this->fields( $this->variable( [ '100', '50' ], 'none' ) );

		$this->assertSame( 100.0, $simple['price'] );
		$this->assertSame( 100.0, $simple['regular_price'] );
		$this->assertSame( 50.0, $variable['price_min'] );
		$this->assertSame( 100.0, $variable['price_max'] );
	}

	/**
	 * A grouped product is shown at its children's prices, each converted with
	 * the child's own tax status and class. The grouped product's own tax
	 * settings are WooCommerce's defaults, which its product screen does not
	 * show, so converting its price with them taxed a voucher at the standard
	 * rate and a book at it in place of the reduced one.
	 */
	public function test_a_grouped_product_is_priced_from_its_childrens_display_prices(): void {
		$this->tax_shop( false, 'incl' );
		$this->reduced_rate();

		$grouped = $this->fields(
			$this->grouped(
				[
					$this->simple( '100', '', 'none' ),
					$this->simple( '150' ),
					$this->simple( '10', '', 'taxable', 'reduced-rate' ),
					$this->simple( '' ),
				]
			)
		);

		$this->assertSame( 10.7, $grouped['price'] );
		$this->assertSame( 10.7, $grouped['price_min'] );
		$this->assertSame( 178.5, $grouped['price_max'] );
		$this->assertSame( 'simple', $grouped['product_type'] );
		$this->assertFalse( $grouped['on_sale'] );
	}

	public function test_a_grouped_product_is_on_sale_when_a_child_is(): void {
		$this->tax_shop( false, 'incl' );

		$grouped = $this->fields( $this->grouped( [ $this->simple( '100' ), $this->simple( '50', '40' ) ] ) );

		$this->assertTrue( $grouped['on_sale'] );
		$this->assertSame( 47.6, $grouped['price_min'] );
	}

	/** Gross prices shown without tax: a child that is not taxable keeps its price. */
	public function test_a_grouped_product_keeps_the_price_of_a_child_that_is_not_taxable(): void {
		$this->tax_shop( true, 'excl' );

		$grouped = $this->fields( $this->grouped( [ $this->simple( '119', '', 'none' ), $this->simple( '238' ) ] ) );

		$this->assertSame( 119.0, $grouped['price_min'] );
		$this->assertSame( 200.0, $grouped['price_max'] );
	}

	/**
	 * Only the children a shopper sees count, for the price and for whether
	 * the product is on sale, whoever runs the sync: run as an administrator,
	 * WooCommerce's own filter would also keep a draft.
	 */
	public function test_a_grouped_product_is_priced_from_its_published_children_whoever_runs_the_sync(): void {
		$this->tax_shop( false, 'incl' );

		$draft = $this->simple( '20', '10' );
		$child = wc_get_product( $draft );
		$child->set_status( 'draft' );
		$child->save();

		$grouped = $this->grouped( [ $this->simple( '100' ), $draft ] );

		$as_nobody = $this->fields( $grouped );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		try {
			$as_administrator = $this->fields( $grouped );
		} finally {
			wp_set_current_user( 0 );
		}

		$this->assertSame( 119.0, $as_nobody['price_min'] );
		$this->assertFalse( $as_nobody['on_sale'] );
		$this->assertSame( $as_nobody, $as_administrator );
	}

	public function test_a_grouped_product_whose_children_have_no_price_has_none(): void {
		$this->tax_shop( false, 'incl' );

		$grouped = $this->fields( $this->grouped( [ $this->simple( '' ) ] ) );

		$this->assertArrayNotHasKey( 'price', $grouped );
		$this->assertArrayNotHasKey( 'price_min', $grouped );
	}

	/**
	 * WP-CLI gives WooCommerce a customer, the one `--user` names, and
	 * WooCommerce works the tax out for that customer's address. The index is
	 * priced for no shopper, as a sync run by WP-Cron prices it, so a customer
	 * who ships abroad leaves no product without tax.
	 */
	public function test_prices_are_not_worked_out_for_the_customer_running_the_sync(): void {
		$this->tax_shop( false, 'incl' );
		update_option( 'woocommerce_tax_based_on', 'shipping' );
		update_option( 'woocommerce_default_customer_address', 'base' );

		$customer = new \WC_Customer();
		$customer->set_billing_country( 'AT' );
		$customer->set_shipping_country( 'AT' );
		WC()->customer = $customer;

		$this->assertCount( 0, WC_Tax::get_rates(), 'The premise: the customer is where the shop has no rate.' );

		$this->assertSame( 119.0, $this->fields( $this->simple( '100' ) )['price'] );
		$this->assertSame( 119.0, $this->fields( $this->variable( [ '100' ] ) )['price'] );
		$this->assertSame( 119.0, $this->fields( $this->grouped( [ $this->simple( '100' ) ] ) )['price'] );
		$this->assertSame( $customer, WC()->customer, 'The customer is put back.' );
	}

	/** Nor for a customer who is exempt from VAT. */
	public function test_prices_are_not_worked_out_for_a_vat_exempt_customer_running_the_sync(): void {
		$this->tax_shop( true, 'incl' );

		$customer = new \WC_Customer();
		$customer->set_billing_country( 'DE' );
		$customer->set_shipping_country( 'DE' );
		$customer->set_is_vat_exempt( true );
		WC()->customer = $customer;

		$this->assertSame( 119.0, $this->fields( $this->simple( '119' ) )['price'] );
		$this->assertSame( 119.0, $this->fields( $this->variable( [ '119' ] ) )['price'] );
	}

	/**
	 * A sync run by WP-Cron has no customer: WooCommerce loads its cart only for
	 * a frontend request. With WooCommerce's own defaults (tax based on the
	 * customer's shipping address, default customer location the shop base) the
	 * shop base is then the location the tax is worked out for.
	 */
	public function test_a_sync_without_a_customer_prices_for_the_shop_base(): void {
		$this->tax_shop( false, 'incl' );
		update_option( 'woocommerce_tax_based_on', 'shipping' );
		update_option( 'woocommerce_default_customer_address', 'base' );
		WC()->customer = null;

		$this->assertCount( 1, WC_Tax::get_rates(), 'The premise: without a customer the rate is the shop base one.' );

		$simple   = $this->fields( $this->simple( '100' ) );
		$variable = $this->fields( $this->variable( [ '100' ] ) );

		$this->assertSame( 119.0, $simple['price'] );
		$this->assertSame( 119.0, $variable['price'] );
	}

	/**
	 * A shop in Germany with one 19% standard rate. Tax is worked out for the
	 * shop base whoever runs the sync, so the guest customer WooCommerce made
	 * at `init` for the test process (located at the install default, US:CA)
	 * cannot move the rate away.
	 */
	private function tax_shop( bool $prices_include_tax, string $display ): void {
		update_option( 'woocommerce_default_country', 'DE' );
		update_option( 'woocommerce_calc_taxes', 'yes' );
		update_option( 'woocommerce_prices_include_tax', $prices_include_tax ? 'yes' : 'no' );
		update_option( 'woocommerce_tax_display_shop', $display );
		update_option( 'woocommerce_tax_based_on', 'base' );
		update_option( 'woocommerce_tax_round_at_subtotal', 'no' );
		update_option( 'woocommerce_price_num_decimals', '2' );

		WC_Tax::_insert_tax_rate(
			[
				'tax_rate_country'  => 'DE',
				'tax_rate_state'    => '',
				'tax_rate'          => '19',
				'tax_rate_name'     => 'MwSt.',
				'tax_rate_priority' => 1,
				'tax_rate_compound' => 0,
				'tax_rate_shipping' => 1,
				'tax_rate_order'    => 1,
				'tax_rate_class'    => '',
			]
		);

		$this->assertCount( 1, WC_Tax::get_base_tax_rates(), 'The premise: the shop base has its 19% rate.' );
		$this->assertCount( 1, WC_Tax::get_rates(), 'The premise: the rate applies where the sync runs.' );
	}

	/**
	 * A 7% rate for WooCommerce's "Reduced rate" class in the shop base.
	 */
	private function reduced_rate(): void {
		if ( ! in_array( 'reduced-rate', WC_Tax::get_tax_class_slugs(), true ) ) {
			WC_Tax::create_tax_class( 'Reduced rate', 'reduced-rate' );
		}

		WC_Tax::_insert_tax_rate(
			[
				'tax_rate_country'  => 'DE',
				'tax_rate_state'    => '',
				'tax_rate'          => '7',
				'tax_rate_name'     => 'MwSt. ermäßigt',
				'tax_rate_priority' => 1,
				'tax_rate_compound' => 0,
				'tax_rate_shipping' => 1,
				'tax_rate_order'    => 1,
				'tax_rate_class'    => 'reduced-rate',
			]
		);

		$this->assertCount( 1, WC_Tax::get_rates( 'reduced-rate' ), 'The premise: the reduced rate applies where the sync runs.' );
	}

	private function simple( string $regular, string $sale = '', string $tax_status = 'taxable', string $tax_class = '' ): int {
		$product = new WC_Product_Simple();
		$product->set_name( 'Rain Coat' );
		$product->set_regular_price( $regular );
		$product->set_sale_price( $sale );
		$product->set_price( '' !== $sale ? $sale : $regular );
		$product->set_tax_status( $tax_status );
		$product->set_tax_class( $tax_class );
		$product->set_status( 'publish' );
		$product->save();

		return $product->get_id();
	}

	/**
	 * A variation takes its tax status from the parent when it is read, so the
	 * status is set on the parent only.
	 *
	 * @param array<int,string> $prices One variation per price.
	 */
	private function variable( array $prices, string $tax_status = 'taxable' ): int {
		$variable = new WC_Product_Variable();
		$variable->set_name( 'T-Shirt' );
		$variable->set_tax_status( $tax_status );
		$variable->set_status( 'publish' );
		$variable->save();

		foreach ( $prices as $price ) {
			$variation = new WC_Product_Variation();
			$variation->set_parent_id( $variable->get_id() );
			$variation->set_regular_price( $price );
			$variation->set_price( $price );
			$variation->save();
		}

		// Re-read so the parent sees its freshly saved variations.
		wc_get_product( $variable->get_id() )->save();

		return $variable->get_id();
	}

	/**
	 * @param array<int,int> $children
	 */
	private function grouped( array $children ): int {
		$grouped = new WC_Product_Grouped();
		$grouped->set_name( 'Gift Set' );
		$grouped->set_children( $children );
		$grouped->set_status( 'publish' );
		$grouped->save();

		return $grouped->get_id();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function fields( int $product_id ): array {
		return $this->woo->product_fields( get_post( $product_id ), self::PRICE_TOGGLES );
	}
}
