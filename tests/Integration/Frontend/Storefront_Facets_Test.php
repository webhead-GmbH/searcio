<?php
/**
 * The filters the storefront config hands the search window.
 *
 * The window lays its filter bar out in the order Search Config lists the
 * facet fields. That order is the service's, and a page cannot ask the
 * service for it, so the plugin keeps a copy of `facet_fields` whenever an
 * admin reads or writes the search configuration, as it does `languages`.
 * With it go how each field is drawn and, for a WooCommerce attribute a
 * swatches plugin colours, the colour of each value.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Indexing\Facet_Config;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Storefront_Facets_Test extends Integration_Test_Case {
	/** A global attribute of this suite's own, which no WooCommerce install has. */
	private const ATTRIBUTE_SLUG = 'whsc_shade';

	private const ATTRIBUTE = 'pa_' . self::ATTRIBUTE_SLUG;

	private const FIELD = 'attr_' . self::ATTRIBUTE_SLUG;

	private int $attribute_id = 0;

	public function tear_down(): void {
		remove_all_filters( 'webhead_search_cloud/storefront/facet_display' );
		remove_all_filters( 'webhead_search_cloud/storefront/facet_colors' );

		if ( taxonomy_exists( self::ATTRIBUTE ) ) {
			unregister_taxonomy( self::ATTRIBUTE );
		}

		if ( $this->attribute_id > 0 && function_exists( 'wc_delete_attribute' ) ) {
			wc_delete_attribute( $this->attribute_id );
		}

		unset( $GLOBALS['wc_product_attributes'][ self::ATTRIBUTE ] );

		parent::tear_down();
	}

	public function test_nothing_is_handed_over_before_search_config_was_read(): void {
		$this->assertSame( [], $this->facets() );
	}

	public function test_the_fields_come_in_the_order_search_config_lists_them(): void {
		$this->facet_config()->set_fields( [ 'categories', 'brand', 'price', 'attr_size' ] );

		$this->assertSame(
			[
				[ 'field' => 'categories', 'order' => 0, 'display' => 'auto' ],
				[ 'field' => 'brand', 'order' => 1, 'display' => 'auto' ],
				[ 'field' => 'price', 'order' => 2, 'display' => 'auto' ],
				[ 'field' => 'attr_size', 'order' => 3, 'display' => 'auto' ],
			],
			$this->facets()
		);
	}

	public function test_the_copy_keeps_only_field_names_once_each(): void {
		$this->facet_config()->set_fields( [ ' brand ', 'brand', '', 7, [ 'x' ], 'categories' ] );

		$this->assertSame( [ 'brand', 'categories' ], $this->facet_config()->fields() );

		$this->facet_config()->set_fields( 'brand' );

		$this->assertSame( [], $this->facet_config()->fields() );
	}

	public function test_a_shop_can_say_how_a_field_is_drawn(): void {
		$this->facet_config()->set_fields( [ 'attr_size', 'brand' ] );

		add_filter(
			'webhead_search_cloud/storefront/facet_display',
			static fn ( $display, string $field ) => 'brand' === $field ? 'tiles' : 'swatches',
			10,
			2
		);

		$this->assertSame( [ 'auto', 'tiles' ], array_column( $this->facets(), 'display' ) );
	}

	/**
	 * "Variation Swatches for WooCommerce" keeps a term's colour in
	 * `product_attribute_color`; the window draws the attribute as colour pills
	 * when every value it shows has one. A term without a colour, or with
	 * something that is not one, is left out.
	 */
	public function test_an_attribute_a_swatches_plugin_colours_carries_its_colours(): void {
		$this->make_attribute();
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		$olive = $this->term( 'Oliv' );
		$black = $this->term( 'Schwarz' );
		$sand  = $this->term( 'Sand' );
		$bad   = $this->term( 'Rot' );

		update_term_meta( $olive, 'product_attribute_color', '#6f7a3a' );
		update_term_meta( $black, 'cfvsw_color', '#1F1F1F' );
		update_term_meta( $bad, 'product_attribute_color', 'red; background: url(x)' );
		unset( $sand );

		$this->assertSame( [ 'Oliv' => '#6f7a3a', 'Schwarz' => '#1F1F1F' ], $this->facets()[0]['colors'] );
	}

	public function test_a_shop_can_give_or_correct_the_colours(): void {
		$this->facet_config()->set_fields( [ 'colour' ] );

		add_filter(
			'webhead_search_cloud/storefront/facet_colors',
			static fn ( $colors, string $field, string $taxonomy ) => 'colour' === $field && '' === $taxonomy
				? [ 'Blau' => '#2f6fd0', 'Rot' => 'not a colour' ]
				: $colors,
			10,
			3
		);

		$this->assertSame( [ 'Blau' => '#2f6fd0' ], $this->facets()[0]['colors'] );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private function facets(): array {
		return $this->service( 'frontend_config' )->to_array()['facets'];
	}

	private function facet_config(): Facet_Config {
		return $this->service( 'facet_config' );
	}

	private function term( string $name ): int {
		$term = wp_insert_term( $name, self::ATTRIBUTE );

		$this->assertIsArray( $term );

		// Only a term in use is one the storefront can show.
		$product = self::factory()->post->create( [ 'post_type' => 'product' ] );
		wp_set_object_terms( $product, [ (int) $term['term_id'] ], self::ATTRIBUTE, true );

		return (int) $term['term_id'];
	}

	private function map_attribute(): void {
		/** @var Index_Config $config */
		$config   = $this->service( 'index_config' );
		$defaults = $config->defaults_for( 'product' );

		$config->save(
			[
				'product' => array_merge(
					$defaults,
					[
						'enabled' => true,
						'woo'     => array_merge( $defaults['woo'] ?? [], [ 'attributes' => [ self::ATTRIBUTE ] ] ),
					]
				),
			]
		);
	}

	/**
	 * A global attribute in WooCommerce's own table, with its taxonomy
	 * registered as WooCommerce registers it on `init`.
	 */
	private function make_attribute(): void {
		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_create_attribute' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$id = wc_create_attribute(
			[
				'name' => 'Farbton',
				'slug' => self::ATTRIBUTE_SLUG,
			]
		);

		$this->assertIsInt( $id );
		$this->attribute_id = $id;

		register_taxonomy( self::ATTRIBUTE, 'product' );
		$GLOBALS['wc_product_attributes'][ self::ATTRIBUTE ] = wc_get_attribute( $id );
	}
}
