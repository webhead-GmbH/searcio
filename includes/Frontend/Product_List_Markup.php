<?php
/**
 * Shared front-end markup for a product row placed on the storefront.
 *
 * The counterpart to {@see Trigger_Markup}: one render helper used by both the
 * Gutenberg block's `render.php` and the Elementor widget, so the two embed
 * points never drift apart.
 *
 * Two sources, and the difference between them is only which request the
 * front-end makes:
 *
 * - `similar` — "more like this" for the product being viewed, from
 *   `GET /search/similar`.
 * - `category` — a search filtered to one facet value. That filter is what
 *   makes a merchandising rule's category trigger fire at all: the rule
 *   applies to a request carrying `filter[field]=value`, so a listing rendered
 *   from the site's own database can never trigger one.
 *
 * Both resolve their subject from the page when the editor left it blank, so a
 * merchant places the block once on a product or category template rather than
 * on every product and every category.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use WP_Term;
use Webhead\WP\SearchCloud\Indexing\Term_Names;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.1.0
 */
final class Product_List_Markup {
	private const SOURCES = [ 'similar', 'category' ];

	private const LAYOUTS = [ 'carousel', 'grid' ];

	private const CARD_SOURCES = [ 'plugin', 'server' ];

	/**
	 * WooCommerce product categories reach the index as decoded term *names*,
	 * each with its ancestors, under the `categories` field (see
	 * {@see \Webhead\WP\SearchCloud\Indexing\Woo::product_fields()}), so that
	 * is what a category filter has to match by default.
	 */
	private const DEFAULT_FILTER_FIELD = 'categories';

	/** `GET /search/similar` validates `limit` as 1-20. */
	private const SIMILAR_MAX = 20;

	/** A category row is a `GET /search`, whose `per_page` allows up to 100. */
	private const SEARCH_MAX = 24;

	/**
	 * @param  array{source?:string,documentId?:string,filterField?:string,filterValue?:string,heading?:string,limit?:int,layout?:string,showBanner?:bool,cardSource?:string,className?:string,instanceClass?:string}  $attributes
	 */
	public static function render( array $attributes ): string {
		$source = in_array( $attributes['source'] ?? '', self::SOURCES, true )
			? (string) $attributes['source']
			: 'similar';

		$document_id  = self::text( $attributes['documentId'] ?? '' );
		$filter_field = self::text( $attributes['filterField'] ?? '' );
		$filter_value = self::text( $attributes['filterValue'] ?? '' );

		if ( 'similar' === $source && '' === $document_id ) {
			$document_id = self::current_document_id();
		}

		if ( 'category' === $source ) {
			if ( '' === $filter_field ) {
				$filter_field = self::DEFAULT_FILTER_FIELD;
			}

			if ( '' === $filter_value ) {
				$filter_value = self::current_term_name();
			}
		}

		// Nothing to ask the API for: on a page with no product and no category
		// there is no row to render, and an empty placeholder would still cost
		// the visitor a mount and a request.
		if ( 'similar' === $source && '' === $document_id ) {
			return '';
		}

		if ( 'category' === $source && '' === $filter_value ) {
			return '';
		}

		// `/search/similar` validates `limit` at 1-20, while `/search` allows a
		// per_page of 100 - so the cap depends on which one this row will call.
		// Sending 24 to the similar endpoint is a 422, and a 422 here means the
		// row silently disappears.
		$max_limit = 'similar' === $source ? self::SIMILAR_MAX : self::SEARCH_MAX;
		$limit     = isset( $attributes['limit'] ) && is_numeric( $attributes['limit'] )
			? max( 1, min( $max_limit, (int) $attributes['limit'] ) )
			: ( 'similar' === $source ? 6 : 12 );
		$layout = in_array( $attributes['layout'] ?? '', self::LAYOUTS, true ) ? (string) $attributes['layout'] : 'carousel';
		$cards  = in_array( $attributes['cardSource'] ?? '', self::CARD_SOURCES, true ) ? (string) $attributes['cardSource'] : 'plugin';
		// The banner shows unless explicitly disabled, and only ever applies to
		// a category row - `/search/similar` returns no merchandising.
		$show_banner = array_key_exists( 'showBanner', $attributes ) ? ! empty( $attributes['showBanner'] ) : true;

		$classes = implode(
			' ',
			array_filter(
				[
					'webhead-search-cloud-products',
					self::text( $attributes['instanceClass'] ?? '' ),
					self::text( $attributes['className'] ?? '' ),
				],
				static fn ( string $part ): bool => '' !== $part
			)
		);

		// `data-webhead-frontend-root` scopes the shared frontend reset to this
		// row, exactly as it does for a trigger.
		return sprintf(
			'<div class="%1$s" data-whsc-list data-webhead-frontend-root data-source="%2$s" data-doc-id="%3$s" data-filter-field="%4$s" data-filter-value="%5$s" data-heading="%6$s" data-limit="%7$d" data-layout="%8$s" data-show-banner="%9$s" data-card-source="%10$s"></div>',
			esc_attr( $classes ),
			esc_attr( $source ),
			esc_attr( $document_id ),
			esc_attr( $filter_field ),
			esc_attr( $filter_value ),
			esc_attr( self::text( $attributes['heading'] ?? '' ) ),
			$limit,
			esc_attr( $layout ),
			esc_attr( $show_banner ? '1' : '0' ),
			esc_attr( $cards )
		);
	}

	/**
	 * The document id of the post being viewed, in the same `{type}-{id}` form
	 * {@see \Webhead\WP\SearchCloud\Indexing\Document_Builder::document_id()}
	 * pushes to the index.
	 */
	private static function current_document_id(): string {
		if ( ! is_singular() ) {
			return '';
		}

		$post = get_post();

		if ( null === $post ) {
			return '';
		}

		return $post->post_type . '-' . $post->ID;
	}

	/**
	 * The name of the term being browsed. Names, not slugs: that is what the
	 * indexer sends, so it is what `filter[categories]=` has to match - and
	 * decoded the same way, since WordPress hands the name back HTML-escaped.
	 */
	private static function current_term_name(): string {
		if ( ! is_category() && ! is_tag() && ! is_tax() ) {
			return '';
		}

		$term = get_queried_object();

		return $term instanceof WP_Term ? Term_Names::decode( (string) $term->name ) : '';
	}

	private static function text( mixed $value ): string {
		return is_string( $value ) ? trim( $value ) : '';
	}
}
