<?php
/**
 * Product row markup integration tests.
 *
 * The interesting behaviour is not the HTML - it is what the helper resolves
 * from the page when the editor left a field blank, because that is what lets a
 * merchant place the block once on a template instead of on every product and
 * every category. Resolving it needs a real query, so these live here rather
 * than in the unit tier.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use WC_Product_Simple;
use WP_HTML_Tag_Processor;
use Webhead\WP\SearchCloud\Frontend\Product_List_Markup;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Product_List_Markup_Test extends Integration_Test_Case {
	public function test_similar_uses_the_post_being_viewed_when_no_product_is_pinned(): void {
		$post_id = self::factory()->post->create();

		$this->go_to( (string) get_permalink( $post_id ) );

		$markup = Product_List_Markup::render( [ 'source' => 'similar' ] );

		// Same `{type}-{id}` form the indexer pushes, so the id the API is asked
		// about is the one that was actually indexed.
		$this->assertStringContainsString( 'data-doc-id="post-' . $post_id . '"', $markup );
		$this->assertStringContainsString( 'data-source="similar"', $markup );
	}

	public function test_an_explicit_product_wins_over_the_page(): void {
		$post_id = self::factory()->post->create();

		$this->go_to( (string) get_permalink( $post_id ) );

		$markup = Product_List_Markup::render( [ 'source' => 'similar', 'documentId' => 'product-99' ] );

		$this->assertStringContainsString( 'data-doc-id="product-99"', $markup );
	}

	/**
	 * Nothing to ask the API about: rendering an empty placeholder would still
	 * cost the visitor a mount and a request that can only come back empty.
	 */
	public function test_similar_renders_nothing_off_a_single_post(): void {
		$this->go_to( home_url( '/' ) );

		$this->assertSame( '', Product_List_Markup::render( [ 'source' => 'similar' ] ) );
	}

	public function test_category_uses_the_term_being_browsed(): void {
		$term_id = self::factory()->category->create( [ 'name' => 'Winter Jackets' ] );
		self::factory()->post->create( [ 'post_category' => [ $term_id ] ] );

		$this->go_to( (string) get_term_link( $term_id ) );

		$markup = Product_List_Markup::render( [ 'source' => 'category' ] );

		// Names, not slugs: the indexer sends the term's name, so a slug here
		// would filter on a value no document carries.
		$this->assertStringContainsString( 'data-filter-value="Winter Jackets"', $markup );
		$this->assertStringContainsString( 'data-filter-field="categories"', $markup );
	}

	/**
	 * WordPress keeps a term name HTML-escaped and the browser reads the
	 * attribute decoded, so the row asks for "Hats & Scarves". The index has to
	 * hold that same string, or a row on any category with an "&" in its name
	 * filters on a value no document carries.
	 */
	public function test_a_category_row_filters_on_a_name_the_indexer_sent(): void {
		$this->require_woocommerce();

		$term    = wp_insert_term( 'Hats & Scarves', 'product_cat' );
		$product = $this->product_in( (int) $term['term_id'] );

		$this->go_to( (string) get_term_link( (int) $term['term_id'], 'product_cat' ) );

		$filter = $this->filter_value( Product_List_Markup::render( [ 'source' => 'category' ] ) );

		$this->assertSame( 'Hats & Scarves', $filter );
		$this->assertContains( $filter, $this->indexed_categories( $product ) );
	}

	/**
	 * Placed once on the category template, a parent category's row filters on
	 * the parent's name - which reaches products filed under a child only
	 * because the indexer sends every ancestor along with the category.
	 */
	public function test_a_parent_category_row_reaches_products_filed_under_a_child(): void {
		$this->require_woocommerce();

		$shoes    = wp_insert_term( 'Shoes', 'product_cat' );
		$sneakers = wp_insert_term( 'Sneakers', 'product_cat', [ 'parent' => (int) $shoes['term_id'] ] );
		$product  = $this->product_in( (int) $sneakers['term_id'] );

		$this->go_to( (string) get_term_link( (int) $shoes['term_id'], 'product_cat' ) );

		$filter = $this->filter_value( Product_List_Markup::render( [ 'source' => 'category' ] ) );

		$this->assertSame( 'Shoes', $filter );
		$this->assertContains( $filter, $this->indexed_categories( $product ) );
	}

	public function test_category_renders_nothing_off_an_archive(): void {
		$this->go_to( home_url( '/' ) );

		$this->assertSame( '', Product_List_Markup::render( [ 'source' => 'category' ] ) );
	}

	public function test_an_explicit_category_needs_no_page_context(): void {
		$this->go_to( home_url( '/' ) );

		$markup = Product_List_Markup::render(
			[ 'source' => 'category', 'filterField' => 'brand', 'filterValue' => 'Acme' ]
		);

		$this->assertStringContainsString( 'data-filter-field="brand"', $markup );
		$this->assertStringContainsString( 'data-filter-value="Acme"', $markup );
	}

	public function test_it_falls_back_to_safe_values_for_anything_unrecognised(): void {
		$markup = Product_List_Markup::render(
			[
				'source'     => 'nonsense',
				'documentId' => 'post-1',
				'layout'     => 'spiral',
				'cardSource' => 'elsewhere',
				'limit'      => 9999,
			]
		);

		$this->assertStringContainsString( 'data-source="similar"', $markup );
		$this->assertStringContainsString( 'data-layout="carousel"', $markup );
		$this->assertStringContainsString( 'data-card-source="plugin"', $markup );
		// Capped rather than passed on: the API rejects an oversized limit.
		$this->assertStringContainsString( 'data-limit="20"', $markup );
	}

	/**
	 * The two sources call different endpoints with different caps:
	 * `/search/similar` validates `limit` at 1-20, while a category row is a
	 * `/search`. Sending 24 to the similar endpoint is a 422, and a 422 makes
	 * the row disappear with nothing to explain it.
	 */
	public function test_the_limit_is_capped_to_whichever_endpoint_the_row_will_call(): void {
		$similar = Product_List_Markup::render(
			[ 'source' => 'similar', 'documentId' => 'post-1', 'limit' => 24 ]
		);
		$category = Product_List_Markup::render(
			[ 'source' => 'category', 'filterValue' => 'Shoes', 'limit' => 24 ]
		);

		$this->assertStringContainsString( 'data-limit="20"', $similar );
		$this->assertStringContainsString( 'data-limit="24"', $category );
	}

	public function test_the_banner_is_on_unless_switched_off(): void {
		$on  = Product_List_Markup::render( [ 'source' => 'category', 'filterValue' => 'Shoes' ] );
		$off = Product_List_Markup::render(
			[ 'source' => 'category', 'filterValue' => 'Shoes', 'showBanner' => false ]
		);

		$this->assertStringContainsString( 'data-show-banner="1"', $on );
		$this->assertStringContainsString( 'data-show-banner="0"', $off );
	}

	/**
	 * The row carries the same reset scope a trigger does, or the theme's own
	 * styles would reach the cards.
	 */
	public function test_the_row_scopes_the_frontend_reset(): void {
		$markup = Product_List_Markup::render( [ 'source' => 'category', 'filterValue' => 'Shoes' ] );

		$this->assertStringContainsString( 'data-webhead-frontend-root', $markup );
		$this->assertStringContainsString( 'data-whsc-list', $markup );
	}

	public function test_a_heading_is_escaped_into_the_attribute(): void {
		$markup = Product_List_Markup::render(
			[
				'source'      => 'category',
				'filterValue' => 'Shoes',
				'heading'     => 'You may also like "these" & more',
			]
		);

		$this->assertStringNotContainsString( 'like "these"', $markup );
		$this->assertStringContainsString( '&amp;', $markup );
	}

	private function require_woocommerce(): void {
		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_get_product' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}
	}

	private function product_in( int $term_id ): int {
		$product = new WC_Product_Simple();
		$product->set_name( 'Listed product' );
		$product->set_status( 'publish' );
		$product->save();
		wp_set_object_terms( $product->get_id(), [ $term_id ], 'product_cat' );

		return $product->get_id();
	}

	/**
	 * @return array<int,string>
	 */
	private function indexed_categories( int $product_id ): array {
		$fields = ( new Woo() )->product_fields( get_post( $product_id ), [ 'categories' => true ] );

		return $fields['categories'] ?? [];
	}

	/**
	 * `data-filter-value` as the browser reads it - entities decoded - which is
	 * what the front-end sends as `filter[categories]=`.
	 */
	private function filter_value( string $markup ): string {
		$tags = new WP_HTML_Tag_Processor( $markup );

		$this->assertTrue( $tags->next_tag( 'div' ), 'The row rendered no element.' );

		return (string) $tags->get_attribute( 'data-filter-value' );
	}
}
