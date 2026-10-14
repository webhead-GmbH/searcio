<?php
/**
 * WooCommerce indexing helper.
 *
 * WooCommerce is a *soft* dependency: every entry point is guarded so the plugin
 * never fatals when WooCommerce is inactive or below the minimum version. All
 * product data is read through `wc_get_product()` (not raw meta). Variable
 * products are indexed as the parent only — price becomes a range and the
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
		'categories'   => [ 'categories' ],
		'tags'         => [ 'product_tags' ],
		'featured'     => [ 'featured' ],
		'rating'       => [ 'rating' ],
		'review_count' => [ 'review_count' ],
	];

	/**
	 * "Shop and search results" and "Search results only". "Shop only" and
	 * "Hidden" are excluded from WooCommerce's own search.
	 */
	private const SEARCHABLE_VISIBILITIES = [ 'visible', 'search' ];

	public function is_active(): bool {
		return class_exists( 'WooCommerce' ) && function_exists( 'wc_get_product' );
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
			$label = isset( $attribute->attribute_label ) && '' !== $attribute->attribute_label
				? (string) $attribute->attribute_label
				: $name;

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
			$fields += $this->price_fields( $product, $is_variable, ! empty( $woo['regular_sale'] ) );
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
		// "Sneakers", while WooCommerce's own "Shoes" archive lists it.
		if ( ! empty( $woo['categories'] ) ) {
			$categories = Term_Names::for_post( $post, self::CATEGORY_TAXONOMY, true );

			if ( [] !== $categories ) {
				$fields['categories'] = $categories;
			}
		}

		if ( ! empty( $woo['tags'] ) ) {
			$tags = Term_Names::for_post( $post, 'product_tag' );

			if ( [] !== $tags ) {
				$fields['product_tags'] = $tags;
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
	 * then no product field is written at all.
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

			array_push( $names, ...$fields );
		}

		foreach ( $this->selected_attributes( $woo ) as $taxonomy ) {
			// A deleted attribute has no terms to write.
			if ( taxonomy_exists( $taxonomy ) ) {
				$names[] = $this->attribute_field( $taxonomy );
			}
		}

		return array_values( array_unique( $names ) );
	}

	/**
	 * The document field an attribute taxonomy is written to: `pa_color`
	 * becomes `attr_color`.
	 */
	public function attribute_field( string $taxonomy ): string {
		return 'attr_' . $this->attribute_key( $taxonomy );
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

			return [
				'price'        => min( $active ),
				'price_min'    => min( $active ),
				'price_max'    => max( $active ),
				'product_type' => 'variable',
				// A variable product is "on sale" if any variation is.
				'on_sale'      => $product->is_on_sale(),
			];
		}

		$price = $product->get_price();

		if ( '' === $price || null === $price ) {
			return [];
		}

		$fields = [
			'price'        => $this->display_price( $product, $price ),
			'product_type' => 'simple',
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
