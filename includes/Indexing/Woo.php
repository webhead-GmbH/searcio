<?php
/**
 * WooCommerce indexing helper.
 *
 * WooCommerce is a *soft* dependency: every entry point is guarded so the plugin
 * never fatals when WooCommerce is inactive or below the minimum version. All
 * product data is read through `wc_get_product()` (not raw meta). Variable
 * products are indexed as the parent only - price becomes a range and the
 * variation SKUs are collected into a searchable `skus` array. Prices are the
 * shop's display prices, with or without tax as WooCommerce shows them.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Woo {
	public const MIN_VERSION       = '8.0';
	public const POST_TYPE         = 'product';
	public const CATEGORY_TAXONOMY = 'product_cat';

	/** WooCommerce's own brands, since WooCommerce 9.6. */
	public const BRAND_TAXONOMY = 'product_brand';

	/**
	 * Each product-mapping toggle and the document fields `product_fields()`
	 * writes when it is on. The toggle list itself is derived from these keys,
	 * and the Search Config tab's field suggestions from the values, so a field
	 * renamed here is renamed everywhere rather than left suggested under its
	 * old name.
	 *
	 * @var array<string,array<int,string>>
	 */
	public const TOGGLE_FIELDS = [
		'price'        => [ 'price', 'price_min', 'price_max', 'product_type', 'on_sale' ],
		'regular_sale' => [ 'regular_price', 'sale_price' ],
		'sku'          => [ 'sku' ],
		'skus'         => [ 'skus' ],
		'stock_status' => [ 'stock_status', 'in_stock' ],
		'categories'   => [ 'categories', 'category_paths' ],
		'tags'         => [ 'product_tags' ],
		'brands'       => [ 'brands' ],
		'featured'     => [ 'featured' ],
		'rating'       => [ 'rating' ],
		'review_count' => [ 'review_count' ],
		'custom_attributes' => [ 'custom_attributes' ],
		'cost_price'   => [ 'cost_price' ],
	];

	/**
	 * Fields written for Searcio alone: it never returns them and refuses them
	 * as searchable, facet or suggest fields, so they are not offered as one.
	 * The purchase price is what its profit ranking works the margin out from.
	 */
	public const PRIVATE_FIELDS = [ 'cost_price' ];

	/**
	 * The pages WooCommerce makes for itself, by the name `wc_get_page_id()`
	 * knows them by. They hold a shortcode or a block and nothing to search
	 * for, and the shop page is the product archive the search window already
	 * is.
	 */
	private const SYSTEM_PAGES = [ 'cart', 'checkout', 'myaccount', 'shop' ];

	/**
	 * "Shop and search results" and "Search results only". "Shop only" and
	 * "Hidden" are excluded from WooCommerce's own search.
	 */
	private const SEARCHABLE_VISIBILITIES = [ 'visible', 'search' ];

	public function is_active(): bool {
		return class_exists( 'WooCommerce' ) && function_exists( 'wc_get_product' );
	}

	/**
	 * The ids of the cart, checkout, account and shop pages, as WooCommerce is
	 * set up; none without WooCommerce.
	 *
	 * @return array<int,int>
	 */
	public function system_page_ids(): array {
		if ( ! $this->is_active() || ! function_exists( 'wc_get_page_id' ) ) {
			return [];
		}

		return array_values(
			array_filter(
				array_map( static fn ( string $page ): int => (int) wc_get_page_id( $page ), self::SYSTEM_PAGES ),
				static fn ( int $id ): bool => $id > 0
			)
		);
	}

	/**
	 * The product-mapping toggles the Indexing tab offers: brands only where
	 * WooCommerce has them.
	 *
	 * @return array<int,string>
	 */
	public function toggles(): array {
		return array_values(
			array_filter(
				array_keys( self::TOGGLE_FIELDS ),
				static fn ( string $toggle ): bool => 'brands' !== $toggle || taxonomy_exists( self::BRAND_TAXONOMY )
			)
		);
	}

	/**
	 * The shop's currency, ISO 4217 (`EUR`), or null without WooCommerce.
	 * Searcio's shopping assistant writes prices in it; without it the model
	 * guessed dollars on a euro shop.
	 */
	public function currency(): ?string {
		if ( ! $this->is_active() || ! function_exists( 'get_woocommerce_currency' ) ) {
			return null;
		}

		$code = strtoupper( (string) get_woocommerce_currency() );

		return 1 === preg_match( '/^[A-Z]{3}$/', $code ) ? $code : null;
	}

	public function version(): string {
		if ( defined( 'WC_VERSION' ) ) {
			return (string) WC_VERSION;
		}

		return '';
	}

	public function meets_minimum(): bool {
		$version = $this->version();

		return '' !== $version && version_compare( $version, self::MIN_VERSION, '>=' );
	}

	/**
	 * Global `pa_*` taxonomies and their WC labels, so the admin can choose
	 * which to push as `attr_{slug}` fields.
	 *
	 * @return array<int,array{slug:string,label:string}>
	 */
	public function attributes(): array {
		if ( ! $this->is_active() || ! function_exists( 'wc_get_attribute_taxonomies' ) ) {
			return [];
		}

		$out = [];

		foreach ( wc_get_attribute_taxonomies() as $attribute ) {
			$name = isset( $attribute->attribute_name ) ? (string) $attribute->attribute_name : '';

			if ( '' === $name ) {
				continue;
			}

			$slug  = function_exists( 'wc_attribute_taxonomy_name' ) ? wc_attribute_taxonomy_name( $name ) : 'pa_' . $name;
			// WooCommerce saves an attribute's name through wc_clean(), which
			// writes a "<" with no ">" after it, and an "&" behind it, as entities.
			$label = trim( Term_Names::decode( (string) ( $attribute->attribute_label ?? '' ) ) );
			$label = '' !== $label ? $label : $name;

			$out[] = [
				'slug'  => $slug,
				'label' => $label,
			];
		}

		return $out;
	}

	/**
	 * Whether a product may appear in search results: the question
	 * WooCommerce's own search answers, not the one `WC_Product::is_visible()`
	 * answers.
	 *
	 * `is_visible()` settles "Search results only" and "Shop only" with
	 * `is_search()`, which is always false where a sync runs (WP-Cron, WP-CLI,
	 * REST), so it would index shop-only products and drop search-only ones.
	 * Catalog visibility is read directly instead. Of the other checks
	 * `is_visible()` makes:
	 *
	 * - Post status is not checked. Whether a private product is indexed is
	 *   the mapping's `include_private` decision, made by the caller, and
	 *   WooCommerce's check also asks whether the current user can edit the
	 *   product, which would make the answer depend on who triggered the sync.
	 * - "Hide out of stock items from the catalog" applies, because WooCommerce
	 *   applies it to its search results too.
	 * - A product whose parent is not published is left out, as WooCommerce
	 *   hides it from shoppers. Only variations have a parent, and they reach
	 *   the index through their parent, so this matters only if one is passed.
	 * - The `woocommerce_product_is_visible` filter still runs, so an extension
	 *   that hides products from shoppers keeps them out of search as well.
	 *   Its callbacks run in the sync's context: there is no search query, and
	 *   usually no logged-in user.
	 */
	public function is_visible_product( WP_Post $post ): bool {
		if ( ! $this->is_active() ) {
			return false;
		}

		$product = wc_get_product( $post->ID );

		if ( ! $product ) {
			return false;
		}

		$visible = in_array( $product->get_catalog_visibility(), self::SEARCHABLE_VISIBILITIES, true );

		if ( 'yes' === get_option( 'woocommerce_hide_out_of_stock_items' ) && ! $product->is_in_stock() ) {
			$visible = false;
		}

		$parent_id = (int) $product->get_parent_id();

		if ( $parent_id > 0 && 'publish' !== get_post_status( $parent_id ) ) {
			$visible = false;
		}

		return (bool) apply_filters( 'woocommerce_product_is_visible', $visible, $product->get_id() );
	}

	/**
	 * Returns an empty array when WooCommerce is inactive.
	 *
	 * @param  array<string,mixed>  $woo  The `woo` block of the product mapping.
	 * @return array<string,mixed>
	 */
	public function product_fields( WP_Post $post, array $woo ): array {
		if ( ! $this->is_active() ) {
			return [];
		}

		$product = wc_get_product( $post->ID );

		if ( ! $product ) {
			return [];
		}

		$is_variable = $product->is_type( 'variable' );
		$fields      = [];

		if ( ! empty( $woo['price'] ) ) {
			$fields += $this->without_customer( fn () => $this->price_fields( $product, $is_variable, ! empty( $woo['regular_sale'] ) ) );
		}

		if ( ! empty( $woo['sku'] ) ) {
			$sku = (string) $product->get_sku();

			if ( '' !== $sku ) {
				$fields['sku'] = $sku;
			}
		}

		if ( ! empty( $woo['skus'] ) && $is_variable ) {
			$skus = $this->variation_skus( $product );

			if ( [] !== $skus ) {
				$fields['skus'] = $skus;
			}
		}

		if ( ! empty( $woo['stock_status'] ) ) {
			$fields['stock_status'] = (string) $product->get_stock_status();
			$fields['in_stock']     = $product->is_in_stock();
		}

		// A product is usually filed under the most specific category only, so
		// its ancestors are sent with it: without them a filter, a quiz answer
		// or a merchandising rule naming "Shoes" matches nothing filed under
		// "Sneakers", while WooCommerce's own "Shoes" archive lists it. The
		// paths are the same categories told apart where two share a name,
		// for the category filter's tree.
		if ( ! empty( $woo['categories'] ) ) {
			$categories = Term_Names::for_post( $post, self::CATEGORY_TAXONOMY, true );
			$paths      = Term_Paths::for_post( $post, self::CATEGORY_TAXONOMY );

			if ( [] !== $categories ) {
				$fields['categories'] = $categories;
			}

			if ( [] !== $paths ) {
				$fields['category_paths'] = $paths;
			}
		}

		if ( ! empty( $woo['tags'] ) ) {
			$tags = Term_Names::for_post( $post, 'product_tag' );

			if ( [] !== $tags ) {
				$fields['product_tags'] = $tags;
			}
		}

		if ( ! empty( $woo['brands'] ) ) {
			$brands = Term_Names::for_post( $post, self::BRAND_TAXONOMY );

			if ( [] !== $brands ) {
				$fields['brands'] = $brands;
			}
		}

		if ( ! empty( $woo['featured'] ) ) {
			$fields['featured'] = $product->is_featured();
		}

		if ( ! empty( $woo['rating'] ) ) {
			$fields['rating'] = (float) $product->get_average_rating();
		}

		if ( ! empty( $woo['review_count'] ) ) {
			$fields['review_count'] = (int) $product->get_review_count();
		}

		if ( ! empty( $woo['custom_attributes'] ) ) {
			$custom = $this->custom_attributes( $product );

			if ( [] !== $custom ) {
				$fields['custom_attributes'] = $custom;
			}
		}

		if ( ! empty( $woo['cost_price'] ) ) {
			$meta_key = is_string( $woo['cost_meta'] ?? null ) ? $woo['cost_meta'] : '';
			$cost     = $this->without_customer( fn () => $this->cost_price( $product, $is_variable, $meta_key ) );

			if ( null !== $cost ) {
				$fields['cost_price'] = $cost;
			}
		}

		foreach ( $this->selected_attributes( $woo ) as $taxonomy ) {
			$values = Term_Names::for_post( $post, $taxonomy );

			if ( [] !== $values ) {
				$fields[ $this->attribute_field( $taxonomy ) ] = $values;
			}
		}

		return $fields;
	}

	/**
	 * Every field `product_fields()` can write for this mapping - the union
	 * across product kinds, so `price_min` is listed even though only a
	 * variable product carries it. Empty when WooCommerce is inactive, because
	 * then no product field is written at all. The {@see self::PRIVATE_FIELDS}
	 * are left out: they are for Searcio alone, which refuses them as fields to
	 * search or filter.
	 *
	 * @param  array<string,mixed>  $woo  The `woo` block of the product mapping.
	 * @return array<int,string>
	 */
	public function field_names( array $woo ): array {
		if ( ! $this->is_active() ) {
			return [];
		}

		$names = [];

		foreach ( self::TOGGLE_FIELDS as $toggle => $fields ) {
			if ( empty( $woo[ $toggle ] ) ) {
				continue;
			}

			// The regular and sale prices are written beside the price, never
			// on their own.
			if ( 'regular_sale' === $toggle && empty( $woo['price'] ) ) {
				continue;
			}

			// A shop on a WooCommerce without brands has none to write.
			if ( 'brands' === $toggle && ! taxonomy_exists( self::BRAND_TAXONOMY ) ) {
				continue;
			}

			array_push( $names, ...$fields );
		}

		foreach ( $this->selected_attributes( $woo ) as $taxonomy ) {
			// A deleted attribute has no terms to write.
			if ( taxonomy_exists( $taxonomy ) ) {
				$names[] = $this->attribute_field( $taxonomy );
			}
		}

		return array_values( array_diff( array_unique( $names ), self::PRIVATE_FIELDS ) );
	}

	/**
	 * The document field an attribute taxonomy is written to: `pa_color`
	 * becomes `attr_color`.
	 */
	public function attribute_field( string $taxonomy ): string {
		return 'attr_' . $this->attribute_key( $taxonomy );
	}

	/**
	 * The attribute fields this mapping writes, each with the attribute's name
	 * as the shop shows it to the current visitor (see {@see self::attribute_label()}).
	 *
	 * @param  array<string,mixed>  $woo  The `woo` block of the product mapping.
	 * @return array<string,string>
	 */
	public function attribute_labels( array $woo ): array {
		$labels = [];

		foreach ( $this->selected_attributes( $woo ) as $taxonomy ) {
			$label = taxonomy_exists( $taxonomy ) ? $this->attribute_label( $taxonomy ) : '';

			if ( '' !== $label ) {
				$labels[ $this->attribute_field( $taxonomy ) ] = $label;
			}
		}

		return $labels;
	}

	/**
	 * The attribute fields this mapping writes, each with the taxonomy it is
	 * read from: `attr_color` => `pa_color`.
	 *
	 * @param  array<string,mixed>  $woo  The `woo` block of the product mapping.
	 * @return array<string,string>
	 */
	public function attribute_taxonomies( array $woo ): array {
		$taxonomies = [];

		foreach ( $this->selected_attributes( $woo ) as $taxonomy ) {
			if ( taxonomy_exists( $taxonomy ) ) {
				$taxonomies[ $this->attribute_field( $taxonomy ) ] = $taxonomy;
			}
		}

		return $taxonomies;
	}

	/**
	 * A global attribute's name in the language of the current request: "Farbe"
	 * for `pa_color` on a German page. It is read through `wc_attribute_label()`,
	 * whose `woocommerce_attribute_label` filter is where WooCommerce
	 * Multilingual, Polylang for WooCommerce and a shop's own code name an
	 * attribute per language. Empty for a taxonomy that is not a WooCommerce
	 * attribute, or when WooCommerce is inactive.
	 */
	public function attribute_label( string $taxonomy ): string {
		if ( ! $this->is_active() || ! function_exists( 'taxonomy_is_product_attribute' ) || ! taxonomy_is_product_attribute( $taxonomy ) ) {
			return '';
		}

		return trim( Term_Names::decode( (string) wc_attribute_label( $taxonomy ) ) );
	}

	/**
	 * The attributes a product defines for itself instead of taking one of the
	 * shop's, each value as "Name: value": the name is the product's own, so
	 * there is no field of the shop's to give it. Those the product page shows
	 * - as a row of its additional information, or as the choice of a
	 * variation - and no others, which are a merchant's notes.
	 *
	 * @return array<int,string>
	 */
	private function custom_attributes( $product ): array {
		$values = [];

		foreach ( $product->get_attributes() as $attribute ) {
			if ( ! $attribute instanceof \WC_Product_Attribute || $attribute->is_taxonomy() ) {
				continue;
			}

			if ( ! $attribute->get_visible() && ! $attribute->get_variation() ) {
				continue;
			}

			// Saved through wc_clean(), which writes some characters as entities.
			$name = trim( Term_Names::decode( (string) $attribute->get_name() ) );

			foreach ( $attribute->get_options() as $option ) {
				$option = trim( Term_Names::decode( (string) $option ) );

				if ( '' !== $name && '' !== $option ) {
					$values[] = $name . ': ' . $option;
				}
			}
		}

		return array_values( array_unique( $values ) );
	}

	/**
	 * What the product costs the shop, for Searcio's profit ranking: from
	 * WooCommerce's own "Cost of goods" (9.5 and later, with the feature on),
	 * else from the meta key the mapping names, which a cost of goods plugin
	 * keeps it in (`_wc_cog_cost`, `_alg_wc_cog_cost`). A variable product's is
	 * its cheapest variation's, whose price is the one sent; a variation
	 * without a meta value of its own takes the product's.
	 *
	 * A purchase price is entered without tax. Where the shop shows prices
	 * with tax, it is taxed as the price is, so the margin is worked out
	 * between two amounts on one basis. Null for a product with none.
	 */
	private function cost_price( $product, bool $is_variable, string $meta_key ): ?float {
		$source = $product;

		if ( $is_variable && method_exists( $product, 'get_variation_prices' ) ) {
			$active = array_map( 'floatval', (array) ( $product->get_variation_prices( true )['price'] ?? [] ) );

			if ( [] === $active ) {
				return null;
			}

			$variation = wc_get_product( (int) array_search( min( $active ), $active, true ) );

			if ( ! $variation instanceof \WC_Product ) {
				return null;
			}

			$source = $variation;
		}

		$cost = $this->cogs_value( $source );

		if ( null === $cost && '' !== $meta_key ) {
			$cost = $this->number( get_post_meta( $source->get_id(), $meta_key, true ) );

			if ( null === $cost && $source !== $product ) {
				$cost = $this->number( get_post_meta( $product->get_id(), $meta_key, true ) );
			}
		}

		if ( null === $cost || $cost <= 0 ) {
			return null;
		}

		if ( wc_tax_enabled() && 'incl' === get_option( 'woocommerce_tax_display_shop' ) && $source->is_taxable() ) {
			$cost += array_sum( \WC_Tax::calc_tax( $cost, \WC_Tax::get_rates( $source->get_tax_class() ), false ) );
		}

		return (float) wc_format_decimal( $cost, wc_get_price_decimals() );
	}

	/** WooCommerce's "Cost of goods" of a product or variation, null where the feature is off or the value is not set. */
	private function cogs_value( $product ): ?float {
		if ( ! method_exists( $product, 'get_cogs_total_value' ) || ! class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			return null;
		}

		if ( ! \Automattic\WooCommerce\Utilities\FeaturesUtil::feature_is_enabled( 'cost_of_goods_sold' ) ) {
			return null;
		}

		$value = (float) $product->get_cogs_total_value();

		return $value > 0 ? $value : null;
	}

	/** A number kept as text, with a comma or a point; null for anything else. */
	private function number( mixed $value ): ?float {
		$text = is_scalar( $value ) ? str_replace( ',', '.', trim( (string) $value ) ) : '';

		return is_numeric( $text ) ? (float) $text : null;
	}

	/**
	 * @param  array<string,mixed>  $woo
	 * @return array<int,string>
	 */
	private function selected_attributes( array $woo ): array {
		$attributes = isset( $woo['attributes'] ) && is_array( $woo['attributes'] ) ? $woo['attributes'] : [];

		return array_map( 'strval', $attributes );
	}

	/**
	 * The prices as the shop displays them: with tax when WooCommerce is set to
	 * show prices with tax in the shop, without when it is not, whichever way
	 * they were entered. The index is shown to every shopper as it is, so it
	 * carries the shop's own display price, and a variable product's range and
	 * a simple product's price are on the same basis.
	 *
	 * `product_type` is WooCommerce's: `simple`, `variable`, `grouped`,
	 * `external`, or an extension's own.
	 *
	 * A variable product on sale carries the regular and the sale price of its
	 * cheapest variation, the one its "from" price is, so a card can strike
	 * that variation's regular price through.
	 *
	 * @return array<string,mixed>
	 */
	private function price_fields( $product, bool $is_variable, bool $with_regular_sale ): array {
		if ( $is_variable && method_exists( $product, 'get_variation_prices' ) ) {
			// `true` asks for the display prices, already rounded to the shop's
			// decimals.
			$prices = $product->get_variation_prices( true );
			$active = is_array( $prices['price'] ?? null ) ? array_map( 'floatval', $prices['price'] ) : [];

			if ( [] === $active ) {
				return [];
			}

			$fields = [
				'price'        => min( $active ),
				'price_min'    => min( $active ),
				'price_max'    => max( $active ),
				'product_type' => 'variable',
				// A variable product is "on sale" if any variation is.
				'on_sale'      => $product->is_on_sale(),
			];

			if ( $with_regular_sale && $fields['on_sale'] ) {
				$regular  = is_array( $prices['regular_price'] ?? null ) ? array_map( 'floatval', $prices['regular_price'] ) : [];
				$cheapest = array_search( $fields['price_min'], $active, true );

				if ( false !== $cheapest && isset( $regular[ $cheapest ] ) && $regular[ $cheapest ] > $active[ $cheapest ] ) {
					$fields['regular_price'] = $regular[ $cheapest ];
					$fields['sale_price']    = $active[ $cheapest ];
				}
			}

			return $fields;
		}

		if ( $product->is_type( 'grouped' ) ) {
			return $this->grouped_price_fields( $product );
		}

		$price = $product->get_price();

		if ( '' === $price || null === $price ) {
			return [];
		}

		$fields = [
			'price'        => $this->display_price( $product, $price ),
			'product_type' => (string) $product->get_type(),
			'on_sale'      => $product->is_on_sale(),
		];

		if ( $with_regular_sale ) {
			$regular = $product->get_regular_price();
			$sale    = $product->get_sale_price();

			if ( '' !== $regular && null !== $regular ) {
				$fields['regular_price'] = $this->display_price( $product, $regular );
			}

			if ( '' !== $sale && null !== $sale ) {
				$fields['sale_price'] = $this->display_price( $product, $sale );
			}
		}

		return $fields;
	}

	/**
	 * A grouped product's price is its children's, each converted with the
	 * child's own tax status and class, as WooCommerce displays it: the range
	 * from the cheapest visible child that has a price to the dearest. The
	 * grouped product's own price is the cheapest child's as entered, and its
	 * own tax settings are WooCommerce's defaults, which the product screen
	 * does not show, so it is not converted itself.
	 *
	 * @return array<string,mixed>
	 */
	private function grouped_price_fields( $product ): array {
		$prices  = [];
		$on_sale = false;

		// The children a shopper sees. WooCommerce's own filter also keeps the
		// ones the current user may edit, which would price the product for
		// whoever runs the sync.
		$children = array_filter(
			array_map( 'wc_get_product', $product->get_children() ),
			static fn ( $child ): bool => $child instanceof \WC_Product && 'publish' === $child->get_status()
		);

		foreach ( $children as $child ) {
			$price = $child->get_price();

			if ( '' !== $price && null !== $price ) {
				$prices[] = $this->display_price( $child, $price );
			}

			// As `WC_Product_Grouped::is_on_sale()` decides it, over the same
			// children.
			$on_sale = $on_sale || ( $child->is_purchasable() && ! $child->has_child() && $child->is_on_sale() );
		}

		if ( [] === $prices ) {
			return [];
		}

		return [
			'price'        => min( $prices ),
			'price_min'    => min( $prices ),
			'price_max'    => max( $prices ),
			'product_type' => 'grouped',
			// A grouped product is "on sale" if a child is.
			'on_sale'      => (bool) apply_filters( 'woocommerce_product_is_on_sale', $on_sale, $product ),
		];
	}

	/**
	 * Runs `$build` as a sync run by WP-Cron runs it: with no customer. WP-CLI
	 * gives WooCommerce one, the user `--user` names or a guest, and WooCommerce
	 * works the tax out for that customer's address and VAT exemption. The
	 * index is shown to every shopper, so it is priced for none, whoever runs
	 * the sync.
	 *
	 * @template T
	 * @param  callable():T  $build
	 * @return T
	 */
	private function without_customer( callable $build ) {
		if ( ! function_exists( 'WC' ) || null === WC()->customer ) {
			return $build();
		}

		$customer      = WC()->customer;
		WC()->customer = null;

		try {
			return $build();
		} finally {
			WC()->customer = $customer;
		}
	}

	/**
	 * A price as entered, converted the way WooCommerce converts it for the
	 * shop and rounded as it rounds a variation's display price, so the same
	 * entered price is indexed the same for a simple product and a variation.
	 *
	 * Only a price that is there is converted: WooCommerce reads an empty one
	 * as the product's active price.
	 *
	 * @param  int|float|string  $price
	 */
	private function display_price( $product, $price ): float {
		return (float) wc_format_decimal(
			wc_get_price_to_display( $product, [ 'price' => $price ] ),
			wc_get_price_decimals()
		);
	}

	/**
	 * @return array<int,string>
	 */
	private function variation_skus( $product ): array {
		$skus = [];

		foreach ( $product->get_children() as $variation_id ) {
			$variation = wc_get_product( $variation_id );

			if ( ! $variation ) {
				continue;
			}

			$sku = (string) $variation->get_sku();

			if ( '' !== $sku ) {
				$skus[] = $sku;
			}
		}

		return array_values( array_unique( $skus ) );
	}

	/**
	 * Reduce a `pa_color` taxonomy to a stable `color` field-name fragment.
	 */
	private function attribute_key( string $taxonomy ): string {
		$key = str_starts_with( $taxonomy, 'pa_' ) ? substr( $taxonomy, 3 ) : $taxonomy;

		return sanitize_key( $key );
	}
}
