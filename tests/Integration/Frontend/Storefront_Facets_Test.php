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
		remove_all_filters( 'webhead_search_cloud/storefront/facet_images' );
		remove_all_filters( 'product_attributes_type_selector' );
		delete_option( 'webhead_search_cloud_category_filter' );
		delete_option( 'webhead_search_cloud_category_filter_depth' );

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

	/**
	 * YITH's swatches keep a term's value under one key whatever the
	 * attribute's type, so it is a colour only for an attribute of its colour
	 * type. A term with two colours holds a list, an old release kept the
	 * value under the taxonomy's name, and a label is not a colour.
	 */
	public function test_yith_swatches_colour_an_attribute_of_their_colour_type(): void {
		$this->make_attribute( 'colorpicker' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		$olive = $this->term( 'Oliv' );
		$duo   = $this->term( 'Schwarz-Weiss' );
		$old   = $this->term( 'Sand' );
		$label = $this->term( 'XL' );

		update_term_meta( $olive, '_yith_wccl_value', '#6f7a3a' );
		update_term_meta( $duo, '_yith_wccl_value', [ '#111111', '#ffffff' ] );
		update_term_meta( $old, self::ATTRIBUTE . '_yith_wccl_value', '#c2b280' );
		update_term_meta( $label, '_yith_wccl_value', 'Extra large' );

		$this->assertSame(
			[ 'Oliv' => '#6f7a3a', 'Sand' => '#c2b280', 'Schwarz-Weiss' => '#111111' ],
			$this->facets()[0]['colors']
		);
	}

	public function test_yith_values_of_a_label_attribute_are_not_colours(): void {
		$this->make_attribute();
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		update_term_meta( $this->term( 'Oliv' ), '_yith_wccl_value', '#6f7a3a' );

		$this->assertArrayNotHasKey( 'colors', $this->facets()[0] );
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
	/**
	 * GetWooPlugins and RadiusTheme keep an attachment's id, CartFlows an
	 * address, and either way the storefront gets an address it can draw.
	 */
	public function test_an_attribute_of_the_image_type_carries_its_images(): void {
		$this->make_attribute( 'image' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		$attachment = self::factory()->attachment->create_upload_object( DIR_TESTDATA . '/images/canola.jpg' );
		$linen      = $this->term( 'Leinen' );
		$wool       = $this->term( 'Wolle' );
		$silk       = $this->term( 'Seide' );

		update_term_meta( $linen, 'product_attribute_image', (string) $attachment );
		update_term_meta( $wool, 'cfvsw_image', 'https://shop.test/wolle.jpg' );
		update_term_meta( $silk, 'product_attribute_color', '#ffffff' );

		$facet = $this->facets()[0];

		$this->assertSame( wp_get_attachment_image_url( $attachment, 'thumbnail' ), $facet['images']['Leinen'] );
		$this->assertSame( 'https://shop.test/wolle.jpg', $facet['images']['Wolle'] );
		$this->assertArrayNotHasKey( 'colors', $facet, 'A plugin keeps what was set before the type changed.' );
	}

	/** "Variation Swatches for WooCommerce" by ThemeAlien and "WCBoost - Variation Swatches". */
	public function test_plain_meta_keys_count_on_an_attribute_of_a_swatch_type(): void {
		$this->make_attribute( 'color' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		update_term_meta( $this->term( 'Oliv' ), 'color', '#6f7a3a' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $this->facets()[0]['colors'] );
	}

	/** Term meta named `color` or `image` could be anybody's. */
	public function test_plain_meta_keys_do_not_count_on_a_plain_attribute(): void {
		$this->make_attribute();
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		$term = $this->term( 'Oliv' );

		update_term_meta( $term, 'color', '#6f7a3a' );
		update_term_meta( $term, 'image', 'https://shop.test/oliv.jpg' );

		$this->assertSame( [ 'field' => self::FIELD, 'order' => 0, 'display' => 'auto' ], $this->facets()[0] );
	}

	public function test_a_value_of_two_colours_carries_both(): void {
		$this->make_attribute( 'color' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		$zebra = $this->term( 'Zebra' );
		$plain = $this->term( 'Schwarz' );

		update_term_meta( $zebra, 'product_attribute_color', '#000000' );
		update_term_meta( $zebra, 'is_dual_color', 'yes' );
		update_term_meta( $zebra, 'secondary_color', '#ffffff' );
		update_term_meta( $plain, 'product_attribute_color', '#111111' );
		update_term_meta( $plain, 'secondary_color', '#ffffff' );

		$this->assertSame( [ 'Zebra' => '#ffffff' ], $this->facets()[0]['secondColors'] );
	}

	public function test_yith_keeps_two_colours_in_a_list(): void {
		$this->make_attribute( 'colorpicker' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		update_term_meta( $this->term( 'Zebra' ), '_yith_wccl_value', [ '#000000', '#ffffff' ] );

		$facet = $this->facets()[0];

		$this->assertSame( [ 'Zebra' => '#000000' ], $facet['colors'] );
		$this->assertSame( [ 'Zebra' => '#ffffff' ], $facet['secondColors'] );
	}

	public function test_an_attribute_shown_as_buttons_is_drawn_as_tiles_with_its_labels(): void {
		$this->make_attribute( 'label' );
		$this->map_attribute();
		$this->facet_config()->set_fields( [ self::FIELD ] );

		update_term_meta( $this->term( 'Extra Large' ), 'label', 'XL' );

		$facet = $this->facets()[0];

		$this->assertSame( 'tiles', $facet['display'] );
		$this->assertSame( [ 'Extra Large' => 'XL' ], $facet['labels'] );
	}

	public function test_a_shop_can_give_or_correct_the_images(): void {
		$this->facet_config()->set_fields( [ 'attr_material' ] );

		add_filter(
			'webhead_search_cloud/storefront/facet_images',
			static fn (): array => [ 'Leinen' => 'https://shop.test/leinen.jpg', 'Wolle' => 'javascript:alert(1)', '' => 'https://shop.test/x.jpg' ]
		);

		$this->assertSame( [ 'Leinen' => 'https://shop.test/leinen.jpg' ], $this->facets()[0]['images'] );
	}

	public function test_the_category_filter_is_the_list_of_a_search_unless_asked(): void {
		$this->facet_config()->set_fields( [ 'categories' ] );
		self::factory()->category->create( [ 'name' => 'Kleidung' ] );

		$this->assertArrayNotHasKey( 'tree', $this->facets()[0] );
	}

	public function test_the_main_categories_alone_are_a_tree_of_one_level(): void {
		$this->facet_config()->set_fields( [ 'categories', 'brand' ] );
		update_option( 'webhead_search_cloud_category_filter', 'main' );

		$main = self::factory()->category->create( [ 'name' => 'Kleidung' ] );
		self::factory()->category->create( [ 'name' => 'Jacken', 'parent' => $main ] );

		$facets = $this->facets();

		$this->assertSame( 1, $facets[0]['tree']['depth'] );
		$this->assertSame( 'Kleidung', $facets[0]['tree']['parents']['Jacken'] );
		$this->assertArrayNotHasKey( 'tree', $facets[1], 'Only the category filter has a tree.' );
	}

	public function test_the_nested_filter_hands_on_the_levels_asked_for(): void {
		$this->facet_config()->set_fields( [ 'categories' ] );
		update_option( 'webhead_search_cloud_category_filter', 'nested' );
		update_option( 'webhead_search_cloud_category_filter_depth', 3 );

		$main = self::factory()->category->create( [ 'name' => 'Kleidung & Mode' ] );
		$sub  = self::factory()->category->create( [ 'name' => 'Jacken', 'parent' => $main ] );
		self::factory()->category->create( [ 'name' => 'Regenjacken', 'parent' => $sub ] );

		$tree = $this->facets()[0]['tree'];

		$this->assertSame( 3, $tree['depth'] );
		$this->assertSame( 'Kleidung & Mode', $tree['parents']['Jacken'], 'A name as the index holds it.' );
		$this->assertSame( 'Jacken', $tree['parents']['Regenjacken'] );
	}

	/** A search answers with names, so two categories of one name are one value. */
	public function test_a_name_that_is_a_main_category_anywhere_is_a_main_category(): void {
		$this->facet_config()->set_fields( [ 'categories' ] );
		update_option( 'webhead_search_cloud_category_filter', 'nested' );

		$main = self::factory()->category->create( [ 'name' => 'Kleidung' ] );
		self::factory()->category->create( [ 'name' => 'Sale' ] );
		self::factory()->category->create( [ 'name' => 'Sale', 'slug' => 'sale-kleidung', 'parent' => $main ] );

		$this->assertArrayNotHasKey( 'Sale', $this->facets()[0]['tree']['parents'] );
	}

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
	/**
	 * @param  string  $type  The attribute's type; a swatches plugin adds its own to WooCommerce's.
	 */
	private function make_attribute( string $type = 'select' ): void {
		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_create_attribute' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		if ( 'select' !== $type ) {
			add_filter( 'product_attributes_type_selector', static fn ( array $types ): array => $types + [ $type => $type ] );
		}

		$id = wc_create_attribute(
			[
				'name' => 'Farbton',
				'slug' => self::ATTRIBUTE_SLUG,
				'type' => $type,
			]
		);

		$this->assertIsInt( $id );
		$this->attribute_id = $id;

		register_taxonomy( self::ATTRIBUTE, 'product' );
		$GLOBALS['wc_product_attributes'][ self::ATTRIBUTE ] = wc_get_attribute( $id );
	}
}
