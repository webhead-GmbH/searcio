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

use Webhead\WP\SearchCloud\Frontend\Product_List_Markup;
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

		// Names, not slugs: `Woo::term_names()` indexes the term's name, so a
		// slug here would filter on a value no document carries.
		$this->assertStringContainsString( 'data-filter-value="Winter Jackets"', $markup );
		$this->assertStringContainsString( 'data-filter-field="categories"', $markup );
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
}
