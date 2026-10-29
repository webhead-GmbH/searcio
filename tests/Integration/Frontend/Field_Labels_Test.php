<?php
/**
 * The names the storefront gives the fields a site names itself.
 *
 * The search window heads a facet group, a comparison row and a quiz answer
 * with a field's name. The plugin's own fields are translated in the bundle;
 * a WooCommerce attribute (`attr_color`) and a field mapped from a taxonomy
 * (`brand` from `product_brand`) used to be named from their key, so a German
 * shop read "COLOR", "SIZE" and "BRAND". The configuration now carries the
 * site's own names (`fieldLabels`), read on the request that prints the
 * storefront, so they are in that page's language.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Field_Labels_Test extends Integration_Test_Case {
	/** A taxonomy of this suite's own, named as WooCommerce names its brands. */
	private const MAKER = 'whsc_maker';

	/** A global attribute of this suite's own, which no WooCommerce install has. */
	private const ATTRIBUTE_SLUG = 'whsc_colour';

	private const ATTRIBUTE = 'pa_' . self::ATTRIBUTE_SLUG;

	private int $attribute_id = 0;

	public function set_up(): void {
		parent::set_up();

		register_taxonomy(
			self::MAKER,
			[ 'post', 'product' ],
			[
				'labels' => [
					'name'          => 'Produktmarken',
					'singular_name' => 'Marke',
				],
			]
		);
	}

	public function tear_down(): void {
		foreach ( [ self::MAKER, self::ATTRIBUTE, 'whsc_unnamed' ] as $taxonomy ) {
			if ( taxonomy_exists( $taxonomy ) ) {
				unregister_taxonomy( $taxonomy );
			}
		}

		if ( $this->attribute_id > 0 && function_exists( 'wc_delete_attribute' ) ) {
			wc_delete_attribute( $this->attribute_id );
		}

		unset( $GLOBALS['wc_product_attributes'][ self::ATTRIBUTE ] );

		parent::tear_down();
	}

	public function test_a_field_mapped_from_a_taxonomy_is_named_by_its_singular_name(): void {
		$this->map( [ 'post' => [ 'fields' => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ] ] ] );

		$this->assertSame( [ 'brand' => 'Marke' ], $this->labels() );
	}

	/**
	 * A field read from post meta or a post property has no name anywhere but
	 * its key, which the storefront humanizes as before.
	 */
	public function test_a_field_read_from_meta_or_a_property_is_not_named(): void {
		$this->map(
			[
				'post' => [
					'fields' => [
						$this->field( 'subtitle', 'meta:subtitle' ),
						$this->field( 'written_by', 'property:author' ),
						$this->field( 'gone', 'taxonomy:whsc_never_registered' ),
					],
				],
			]
		);

		$this->assertSame( [], $this->labels() );
	}

	/**
	 * WordPress names a taxonomy registered without labels "Tags" or
	 * "Categories", which says nothing about what it holds. Its own two
	 * taxonomies are named by them.
	 */
	public function test_a_taxonomy_with_no_name_of_its_own_is_not_named(): void {
		register_taxonomy( 'whsc_unnamed', 'post' );

		$this->map(
			[
				'post' => [
					'fields' => [
						$this->field( 'mood', 'taxonomy:whsc_unnamed' ),
						$this->field( 'section', 'taxonomy:category' ),
					],
				],
			]
		);

		$this->assertSame( [ 'section' => get_taxonomy( 'category' )->labels->singular_name ], $this->labels() );
	}

	public function test_a_name_is_shown_as_it_was_typed(): void {
		get_taxonomy( self::MAKER )->labels->singular_name = 'Marke &amp; Hersteller';

		$this->map( [ 'post' => [ 'fields' => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ] ] ] );

		$this->assertSame( [ 'brand' => 'Marke & Hersteller' ], $this->labels() );
	}

	public function test_a_disabled_post_type_names_nothing(): void {
		$this->map(
			[
				'post' => [
					'enabled' => false,
					'fields'  => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ],
				],
			]
		);

		$this->assertSame( [], $this->labels() );
	}

	/**
	 * Polylang and WPML give a taxonomy the labels of the visitor's language
	 * once they know it. The name is read on the request that prints the
	 * storefront, so it is that language's, not the one of the last save.
	 */
	public function test_a_taxonomy_name_is_read_when_the_storefront_is_printed(): void {
		$this->map( [ 'post' => [ 'fields' => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ] ] ] );
		$this->assertSame( [ 'brand' => 'Marke' ], $this->labels() );

		get_taxonomy( self::MAKER )->labels->singular_name = 'Brand';

		$this->assertSame( [ 'brand' => 'Brand' ], $this->labels() );
	}

	public function test_an_attribute_field_is_named_as_the_shop_names_the_attribute(): void {
		$this->make_attribute( 'Farbe' );
		$this->map( [ 'product' => [ 'woo' => [ 'attributes' => [ self::ATTRIBUTE ] ] ] ] );

		$this->assertSame( [ 'attr_' . self::ATTRIBUTE_SLUG => 'Farbe' ], $this->labels() );
	}

	/**
	 * WooCommerce Multilingual and Polylang for WooCommerce name an attribute
	 * per language through `woocommerce_attribute_label`, as the demo shop's
	 * own code does for its English pages.
	 */
	public function test_an_attribute_name_follows_the_language_of_the_page(): void {
		$this->make_attribute( 'Farbe' );
		$this->map( [ 'product' => [ 'woo' => [ 'attributes' => [ self::ATTRIBUTE ] ] ] ] );

		$language = 'de';
		add_filter(
			'woocommerce_attribute_label',
			static function ( $label, $name ) use ( &$language ) {
				return 'en' === $language && self::ATTRIBUTE === $name ? 'Colour' : $label;
			},
			10,
			2
		);

		$this->assertSame( 'Farbe', $this->labels()[ 'attr_' . self::ATTRIBUTE_SLUG ] );

		$language = 'en';

		$this->assertSame( 'Colour', $this->labels()[ 'attr_' . self::ATTRIBUTE_SLUG ] );
	}

	/**
	 * The demo shop's mapping: its attributes, and its brands from a taxonomy
	 * of their own. An attribute that was deleted since has no field to name.
	 */
	public function test_a_product_mapping_names_its_attributes_and_its_mapped_taxonomy(): void {
		$this->make_attribute( 'Farbe' );
		$this->map(
			[
				'product' => [
					'fields' => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ],
					'woo'    => [ 'attributes' => [ self::ATTRIBUTE, 'pa_whsc_deleted' ] ],
				],
			]
		);

		$this->assertSame(
			[
				'brand'                       => 'Marke',
				'attr_' . self::ATTRIBUTE_SLUG => 'Farbe',
			],
			$this->labels()
		);
	}

	/** Mapped from an attribute's taxonomy, a field takes the attribute's name in the visitor's language. */
	public function test_a_field_mapped_from_an_attribute_taxonomy_is_named_as_the_attribute(): void {
		$this->make_attribute( 'Farbe' );
		add_filter( 'woocommerce_attribute_label', static fn ( $label, $name ) => self::ATTRIBUTE === $name ? 'Colour' : $label, 10, 2 );

		$this->map( [ 'product' => [ 'fields' => [ $this->field( 'colour', 'taxonomy:' . self::ATTRIBUTE ) ] ] ] );

		$this->assertSame( [ 'colour' => 'Colour' ], $this->labels() );
	}

	/**
	 * A field the WooCommerce mapping writes overwrites a mapped field of the
	 * same name in the document, so it keeps the name the storefront gives
	 * WooCommerce's field.
	 */
	public function test_a_mapped_field_woocommerce_overwrites_is_not_named_after_the_taxonomy(): void {
		$this->skip_without_woocommerce();
		$this->map(
			[
				'product' => [
					'fields' => [ $this->field( 'categories', 'taxonomy:' . self::MAKER ) ],
					'woo'    => [ 'categories' => true ],
				],
			]
		);

		$this->assertArrayNotHasKey( 'categories', $this->labels() );
	}

	/**
	 * The demo shop's journal maps its post categories as `categories`, the
	 * field WooCommerce's mapping writes the product categories to. One index
	 * holds both, so the facet lists both, under the plugin's own name for it
	 * ("Kategorien") rather than the post taxonomy's ("Kategorie").
	 */
	public function test_a_field_woocommerce_writes_keeps_its_name_when_another_post_type_maps_it(): void {
		$this->skip_without_woocommerce();
		$this->map(
			[
				'post'    => [ 'fields' => [ $this->field( 'categories', 'taxonomy:category' ) ] ],
				'product' => [
					'fields' => [ $this->field( 'brand', 'taxonomy:' . self::MAKER ) ],
					'woo'    => [ 'categories' => true ],
				],
			]
		);

		$this->assertSame( [ 'brand' => 'Marke' ], $this->labels() );
	}

	/** Without a product mapping, the field is the post taxonomy's alone. */
	public function test_a_post_type_may_name_a_field_woocommerce_does_not_write(): void {
		$this->map( [ 'post' => [ 'fields' => [ $this->field( 'categories', 'taxonomy:category' ) ] ] ] );

		$this->assertSame( [ 'categories' => get_taxonomy( 'category' )->labels->singular_name ], $this->labels() );
	}

	/**
	 * @return array<string,string>
	 */
	private function labels(): array {
		return $this->service( 'frontend_config' )->to_array()['fieldLabels'];
	}

	/**
	 * Save an enabled block for each post type, on top of its defaults, as
	 * the only mapping the site has.
	 *
	 * @param  array<string,array<string,mixed>>  $overrides  Post type => what differs from its defaults.
	 */
	private function map( array $overrides ): void {
		$config = $this->index_config();
		$blocks = [];

		foreach ( $overrides as $post_type => $block ) {
			$defaults = $config->defaults_for( $post_type );

			$blocks[ $post_type ] = array_merge( $defaults, [ 'enabled' => true ], $block );

			if ( isset( $block['woo'] ) ) {
				$blocks[ $post_type ]['woo'] = array_merge( $defaults['woo'] ?? [], $block['woo'] );
			}
		}

		$config->save( $blocks );
	}

	/**
	 * @return array{as:string,source:string}
	 */
	private function field( string $as, string $source ): array {
		return [
			'as'     => $as,
			'source' => $source,
		];
	}

	private function index_config(): Index_Config {
		return $this->service( 'index_config' );
	}

	/**
	 * A global attribute in WooCommerce's own table, with its taxonomy
	 * registered as WooCommerce registers it on `init`: the taxonomy, and its
	 * entry in `$wc_product_attributes`, which `taxonomy_is_product_attribute()`
	 * reads.
	 */
	private function make_attribute( string $label ): void {
		$this->skip_without_woocommerce();

		$id = wc_create_attribute(
			[
				'name' => $label,
				'slug' => self::ATTRIBUTE_SLUG,
			]
		);

		$this->assertIsInt( $id );
		$this->attribute_id = $id;

		register_taxonomy( self::ATTRIBUTE, 'product' );
		$GLOBALS['wc_product_attributes'][ self::ATTRIBUTE ] = wc_get_attribute( $id );
	}

	private function skip_without_woocommerce(): void {
		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_create_attribute' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}
	}
}
