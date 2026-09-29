<?php
/**
 * Taxonomy field source tests.
 *
 * A `taxonomy:{tax}` mapping reads real terms, so it is proved against a real
 * database here rather than in the unit tier.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use Webhead\WP\SearchCloud\Indexing\Field_Source_Resolver;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Field_Source_Resolver_Test extends Integration_Test_Case {
	public function test_a_taxonomy_source_sends_term_names_decoded(): void {
		$term_id = self::factory()->category->create( [ 'name' => 'News & Events' ] );
		$post_id = self::factory()->post->create( [ 'post_category' => [ $term_id ] ] );

		$names = ( new Field_Source_Resolver() )->resolve( 'taxonomy:category', get_post( $post_id ) );

		$this->assertSame( [ 'News & Events' ], $names );
	}

	/**
	 * Ancestors are a WooCommerce category rule. A mapped taxonomy sends exactly
	 * the terms the post carries.
	 */
	public function test_a_taxonomy_source_sends_only_the_assigned_terms(): void {
		$parent  = self::factory()->category->create( [ 'name' => 'News' ] );
		$child   = self::factory()->category->create( [ 'name' => 'Local', 'parent' => $parent ] );
		$post_id = self::factory()->post->create( [ 'post_category' => [ $child ] ] );

		$names = ( new Field_Source_Resolver() )->resolve( 'taxonomy:category', get_post( $post_id ) );

		$this->assertSame( [ 'Local' ], $names );
	}

	public function test_a_taxonomy_source_with_no_terms_resolves_to_null(): void {
		$post_id = self::factory()->post->create();

		$this->assertNull( ( new Field_Source_Resolver() )->resolve( 'taxonomy:post_tag', get_post( $post_id ) ) );
	}
}
