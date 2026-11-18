<?php
/**
 * Variation changes reaching the change queue.
 *
 * A variable product's document carries its cheapest variation's price, its
 * stock and, with the purchase price on, that variation's cost. WooCommerce
 * writes a variation whose price, stock or custom field changed without
 * touching its post row, so `save_post` does not fire for it: only
 * `woocommerce_update_product_variation` does. Left unheard, a price or a
 * purchase price changed on a variation stayed as it was in search until the
 * product itself was saved.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use WC_Product_Simple;
use WC_Product_Variable;
use WC_Product_Variation;
use Webhead\WP\SearchCloud\Database\Tables\Change_Queue_Table;
use Webhead\WP\SearchCloud\DTO\Queued_Change;
use Webhead\WP\SearchCloud\Enums\Change_Action;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Change_Listener_Variations_Test extends Integration_Test_Case {
	private const COST_META = '_whsc_cost';

	public function set_up(): void {
		parent::set_up();

		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_get_product' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$config = $this->service( 'index_config' );

		$config->save(
			[
				'product' => array_merge(
					$config->defaults_for( 'product' ),
					[
						'enabled' => true,
						'woo'     => array_merge( $config->defaults_for( 'product' )['woo'], [ 'cost_price' => true, 'cost_meta' => self::COST_META ] ),
					]
				),
			]
		);
	}

	public function test_a_variations_price_change_queues_its_parent(): void {
		[ $parent, $variations ] = $this->variable_product();

		$variation = wc_get_product( $variations[0] );
		$variation->set_regular_price( '55' );
		$variation->save();

		$this->assertSame( [ $parent ], $this->queued_ids(), 'The product, not the variation, is the document.' );
	}

	public function test_a_variations_stock_change_queues_its_parent(): void {
		[ $parent, $variations ] = $this->variable_product();

		$variation = wc_get_product( $variations[1] );
		$variation->set_stock_status( 'outofstock' );
		$variation->save();

		$this->assertSame( [ $parent ], $this->queued_ids() );
	}

	/**
	 * The purchase price of a variation, kept in a custom field and saved with
	 * the variation's other data.
	 */
	public function test_a_variations_purchase_price_saved_with_it_queues_its_parent(): void {
		[ $parent, $variations ] = $this->variable_product();

		$variation = wc_get_product( $variations[0] );
		$variation->update_meta_data( self::COST_META, '12' );
		$variation->save();

		$this->assertSame( [ $parent ], $this->queued_ids() );
	}

	public function test_a_new_variation_queues_its_parent(): void {
		[ $parent ] = $this->variable_product();

		$variation = new WC_Product_Variation();
		$variation->set_parent_id( $parent );
		$variation->set_regular_price( '30' );
		$variation->save();

		$this->assertSame( [ $parent ], $this->queued_ids() );
	}

	/**
	 * Without the variation its price range, and with it the price the
	 * document carries, are different.
	 */
	public function test_a_removed_variation_queues_its_parent_as_an_edit(): void {
		[ $parent, $variations ] = $this->variable_product();

		wp_trash_post( $variations[0] );

		$this->assertSame( [ $parent ], $this->queued_ids() );

		foreach ( $this->queue()->claim( 100 ) as $change ) {
			$this->assertSame( Change_Action::Upsert, $change->action, 'The product stays in the index.' );
		}
	}

	/**
	 * A purchase price written by something other than WooCommerce's own save:
	 * an import, a cost of goods plugin, a script.
	 */
	public function test_the_purchase_price_field_written_outside_a_save_queues_the_product(): void {
		[ $parent, $variations ] = $this->variable_product();
		$simple                  = $this->simple_product();
		$this->empty_queue();

		update_post_meta( $variations[0], self::COST_META, '20' );
		update_post_meta( $simple, self::COST_META, '5' );

		$this->assertEqualsCanonicalizing( [ $parent, $simple ], $this->queued_ids() );

		$this->empty_queue();
		delete_post_meta( $variations[0], self::COST_META );

		$this->assertSame( [ $parent ], $this->queued_ids(), 'A purchase price taken away is a change too.' );
	}

	public function test_another_field_written_outside_a_save_queues_nothing(): void {
		[ , $variations ] = $this->variable_product();

		update_post_meta( $variations[0], '_whsc_unrelated', '20' );

		$this->assertSame( [], $this->queued_ids() );
	}

	public function test_the_purchase_price_field_is_not_watched_while_the_purchase_price_is_off(): void {
		$config = $this->service( 'index_config' );
		$config->save( [ 'product' => array_merge( $config->defaults_for( 'product' ), [ 'enabled' => true ] ) ] );

		[ , $variations ] = $this->variable_product();

		update_post_meta( $variations[0], self::COST_META, '20' );

		$this->assertSame( [], $this->queued_ids() );
	}

	/**
	 * The whole way: a purchase price edited on the variation that carries the
	 * product's price reaches Searcio with the next drain, with no sync started
	 * by hand. A variation that does not carry it leaves the document as it
	 * was, so nothing is sent for it.
	 */
	public function test_a_purchase_price_edited_on_a_variation_reaches_searcio_with_the_drain(): void {
		$this->connect_client();

		[ $parent, $variations ] = $this->variable_product();
		$sent                    = [];

		$this->fake_http(
			function ( string $url, array $args ) use ( &$sent ): array {
				if ( str_ends_with( (string) wp_parse_url( $url, PHP_URL_PATH ), '/documents' ) ) {
					foreach ( (array) ( json_decode( (string) ( $args['body'] ?? '' ), true )['documents'] ?? [] ) as $document ) {
						$sent[] = $document;
					}
				}

				return $this->http_ok( [ 'status' => 'queued' ], 202 );
			}
		);

		$edit = function ( int $variation, string $cost ): void {
			$product = wc_get_product( $variation );
			$product->update_meta_data( self::COST_META, $cost );
			$product->save();
		};
		$drain = fn () => $this->service( 'incremental_service' )->drain();
		$costs = static fn ( array $documents ): array => array_map( 'floatval', array_column( $documents, 'cost_price' ) );

		// The product's price is its cheapest variation's, 40: that cost counts.
		$edit( $variations[0], '10' );
		$drain();

		$this->assertSame( [ 10.0 ], $costs( $sent ) );

		$edit( $variations[0], '12' );
		$drain();

		$this->assertSame( [ 10.0, 12.0 ], $costs( $sent ), 'The new purchase price is sent without a sync by hand.' );

		$edit( $variations[1], '99' );
		$drain();

		$this->assertCount( 2, $sent, 'The dearer variation carries no price of the product: its document is the same, so nothing is sent.' );
		$this->assertSame( 'product-' . $parent, $sent[0]['id'] );
	}

	/**
	 * @return array{0:int,1:array<int,int>} The product and its two variations.
	 */
	private function variable_product(): array {
		$variable = new WC_Product_Variable();
		$variable->set_name( 'Fleece Jacket' );
		$variable->set_status( 'publish' );
		$variable->save();

		$variations = [];

		foreach ( [ '40', '60' ] as $price ) {
			$variation = new WC_Product_Variation();
			$variation->set_parent_id( $variable->get_id() );
			$variation->set_regular_price( $price );
			$variation->save();

			$variations[] = $variation->get_id();
		}

		wc_get_product( $variable->get_id() )->save();
		$this->empty_queue();

		return [ $variable->get_id(), $variations ];
	}

	private function simple_product(): int {
		$product = new WC_Product_Simple();
		$product->set_name( 'Wool Hat' );
		$product->set_regular_price( '15' );
		$product->set_status( 'publish' );
		$product->save();

		return $product->get_id();
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
		return array_values( array_unique( array_map( static fn( Queued_Change $change ): int => $change->object_id, $this->queue()->claim( 100 ) ) ) );
	}
}
