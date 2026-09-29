<?php
/**
 * WooCommerce indexing tests.
 *
 * Exercises {@see \Webhead\WP\SearchCloud\Indexing\Woo} against real WooCommerce
 * product objects (created through WooCommerce's own CRUD, not raw meta) and the
 * {@see \Webhead\WP\SearchCloud\Indexing\Document_Builder} product path, so a
 * change to the product field mapping, price handling, or visibility rules is
 * caught here. The whole class skips when WooCommerce is not loaded into the
 * test environment (see `tests/Integration/bootstrap.php`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use WC_Product_Simple;
use WC_Product_Variable;
use WC_Product_Variation;
use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Woo_Test extends Integration_Test_Case {
	private Woo $woo;

	public function set_up(): void {
		parent::set_up();

		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_get_product' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->woo = new Woo();
	}

	public function test_is_active_and_meets_minimum(): void {
		$this->assertTrue( $this->woo->is_active() );
		$this->assertTrue( $this->woo->meets_minimum(), 'The installed WooCommerce is below the supported minimum.' );
	}

	public function test_simple_product_fields(): void {
		$product = new WC_Product_Simple();
		$product->set_name( 'Blue Shirt' );
		$product->set_regular_price( '30' );
		$product->set_price( '30' );
		$product->set_sku( 'SHIRT-1' );
		$product->set_manage_stock( false );
		$product->set_stock_status( 'instock' );
		$product->save();

		$fields = $this->woo->product_fields(
			get_post( $product->get_id() ),
			[ 'price' => true, 'sku' => true, 'stock_status' => true ]
		);

		$this->assertSame( 30.0, $fields['price'] );
		$this->assertSame( 'simple', $fields['product_type'] );
		$this->assertSame( 'SHIRT-1', $fields['sku'] );
		$this->assertSame( 'instock', $fields['stock_status'] );
		$this->assertTrue( $fields['in_stock'] );
	}

	public function test_regular_and_sale_price_fields(): void {
		$product = new WC_Product_Simple();
		$product->set_regular_price( '50' );
		$product->set_sale_price( '35' );
		$product->set_price( '35' );
		$product->save();

		$fields = $this->woo->product_fields(
			get_post( $product->get_id() ),
			[ 'price' => true, 'regular_sale' => true ]
		);

		$this->assertSame( 35.0, $fields['price'] );
		$this->assertSame( 50.0, $fields['regular_price'] );
		$this->assertSame( 35.0, $fields['sale_price'] );
		$this->assertTrue( $fields['on_sale'] );
	}

	public function test_categories_are_indexed_by_name(): void {
		$term = wp_insert_term( 'Outerwear', 'product_cat' );
		$this->assertIsArray( $term );

		$product = new WC_Product_Simple();
		$product->set_name( 'Winter Coat' );
		$product->set_regular_price( '120' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ (int) $term['term_id'] ], 'product_cat' );

		$fields = $this->woo->product_fields( get_post( $product->get_id() ), [ 'categories' => true ] );

		$this->assertContains( 'Outerwear', $fields['categories'] );
	}

	/**
	 * A product is filed under its most specific category only. Without the
	 * ancestors, `filter[categories]=Footwear` - and every quiz answer and
	 * merchandising rule naming it - matches nothing filed under "Boots".
	 */
	public function test_categories_include_every_ancestor_of_the_assigned_category(): void {
		$footwear = wp_insert_term( 'Footwear', 'product_cat' );
		$shoes    = wp_insert_term( 'Shoes', 'product_cat', [ 'parent' => (int) $footwear['term_id'] ] );
		$boots    = wp_insert_term( 'Boots', 'product_cat', [ 'parent' => (int) $shoes['term_id'] ] );

		$product = new WC_Product_Simple();
		$product->set_name( 'Chelsea Boot' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ (int) $boots['term_id'] ], 'product_cat' );

		$fields = $this->woo->product_fields( get_post( $product->get_id() ), [ 'categories' => true ] );

		// The assigned category leads, then its ancestors nearest first.
		$this->assertSame( [ 'Boots', 'Shoes', 'Footwear' ], $fields['categories'] );
	}

	public function test_a_parent_shared_by_two_assigned_categories_is_listed_once(): void {
		$shoes   = wp_insert_term( 'Shoes', 'product_cat' );
		$boots   = wp_insert_term( 'Boots', 'product_cat', [ 'parent' => (int) $shoes['term_id'] ] );
		$sandals = wp_insert_term( 'Sandals', 'product_cat', [ 'parent' => (int) $shoes['term_id'] ] );

		$product = new WC_Product_Simple();
		$product->set_name( 'Convertible Sandal Boot' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ (int) $boots['term_id'], (int) $sandals['term_id'] ], 'product_cat' );

		$fields = $this->woo->product_fields( get_post( $product->get_id() ), [ 'categories' => true ] );

		$this->assertEqualsCanonicalizing( [ 'Boots', 'Sandals', 'Shoes' ], $fields['categories'] );
	}

	/**
	 * WordPress stores a term name HTML-escaped. Sent as is, a facet chip and
	 * the compare table read "Vergaser &amp; Ansaugung", and a filter for the
	 * name as typed matches nothing.
	 */
	public function test_category_names_are_indexed_decoded(): void {
		$parent = wp_insert_term( 'Motorrad & Roller', 'product_cat' );
		$child  = wp_insert_term( 'Vergaser & Ansaugung', 'product_cat', [ 'parent' => (int) $parent['term_id'] ] );

		// The premise: what WordPress hands back is the escaped form.
		$this->assertSame( 'Vergaser &amp; Ansaugung', get_term( (int) $child['term_id'], 'product_cat' )->name );

		$product = new WC_Product_Simple();
		$product->set_name( 'Carburettor' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ (int) $child['term_id'] ], 'product_cat' );

		$fields = $this->woo->product_fields( get_post( $product->get_id() ), [ 'categories' => true ] );

		$this->assertSame( [ 'Vergaser & Ansaugung', 'Motorrad & Roller' ], $fields['categories'] );
	}

	public function test_tag_names_are_indexed_decoded_and_without_parents(): void {
		$product = new WC_Product_Simple();
		$product->set_name( 'Scarf' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ 'Black & White' ], 'product_tag' );

		$fields = $this->woo->product_fields( get_post( $product->get_id() ), [ 'tags' => true ] );

		$this->assertSame( [ 'Black & White' ], $fields['product_tags'] );
	}

	public function test_variable_product_price_range_and_variation_skus(): void {
		$variable = new WC_Product_Variable();
		$variable->set_name( 'T-Shirt' );
		$variable->save();

		foreach ( [ [ '10', 'TS-S' ], [ '25', 'TS-L' ] ] as [ $price, $sku ] ) {
			$variation = new WC_Product_Variation();
			$variation->set_parent_id( $variable->get_id() );
			$variation->set_regular_price( $price );
			$variation->set_price( $price );
			$variation->set_sku( $sku );
			$variation->save();
		}

		// Re-read so the parent sees its freshly saved variations.
		$parent = wc_get_product( $variable->get_id() );
		$parent->save();

		$fields = $this->woo->product_fields(
			get_post( $variable->get_id() ),
			[ 'price' => true, 'skus' => true ]
		);

		$this->assertSame( 'variable', $fields['product_type'] );
		$this->assertSame( 10.0, $fields['price_min'] );
		$this->assertSame( 25.0, $fields['price_max'] );
		$this->assertEqualsCanonicalizing( [ 'TS-S', 'TS-L' ], $fields['skus'] );
	}

	public function test_is_visible_product(): void {
		$visible = new WC_Product_Simple();
		$visible->set_name( 'On the shelf' );
		$visible->set_regular_price( '5' );
		$visible->set_catalog_visibility( 'visible' );
		$visible->set_status( 'publish' );
		$visible->save();

		$hidden = new WC_Product_Simple();
		$hidden->set_name( 'Hidden' );
		$hidden->set_regular_price( '5' );
		$hidden->set_catalog_visibility( 'hidden' );
		$hidden->set_status( 'publish' );
		$hidden->save();

		$this->assertTrue( $this->woo->is_visible_product( get_post( $visible->get_id() ) ) );
		$this->assertFalse( $this->woo->is_visible_product( get_post( $hidden->get_id() ) ) );
	}

	public function test_returns_no_fields_for_a_non_product_post(): void {
		$post_id = self::factory()->post->create();

		$this->assertSame( [], $this->woo->product_fields( get_post( $post_id ), [ 'price' => true ] ) );
	}

	public function test_document_builder_includes_woo_fields_for_a_product(): void {
		$this->service( 'index_config' )->save(
			[
				'product' => [
					'enabled' => true,
					'woo'     => [ 'price' => true, 'sku' => true, 'only_visible' => false ],
				],
			]
		);

		$product = new WC_Product_Simple();
		$product->set_name( 'Indexed Product' );
		$product->set_regular_price( '42' );
		$product->set_price( '42' );
		$product->set_sku( 'IDX-42' );
		$product->set_status( 'publish' );
		$product->save();

		/** @var Document_Builder $builder */
		$builder  = $this->service( 'document_builder' );
		$document = $builder->build( get_post( $product->get_id() ) );

		$this->assertIsArray( $document );
		$this->assertSame( 'product-' . $product->get_id(), $document['id'] );
		$this->assertSame( 'Indexed Product', $document['title'] );
		$this->assertSame( 42.0, $document['price'] );
		$this->assertSame( 'IDX-42', $document['sku'] );
	}
}
