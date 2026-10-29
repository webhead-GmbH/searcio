<?php
/**
 * Field source tests.
 *
 * A `taxonomy:{tax}` mapping reads real terms, and the text properties read
 * what WordPress stored, through its own save filters, so both are proved
 * against a real database here rather than in the unit tier.
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

	/**
	 * `get_the_title()` writes the apostrophe, the quotes, the spaced hyphen,
	 * the double hyphen and the three dots as numeric entities, and kses or
	 * `convert_chars()` writes the ampersand as one. A result card printed
	 * "Women&#8217;s".
	 */
	public function test_the_title_is_sent_as_typed(): void {
		$title   = 'Fjellmark Women\'s "Storm" Rain Jacket - 2--3 Layers & More...';
		$post_id = self::factory()->post->create( [ 'post_title' => $title ] );
		$post    = get_post( $post_id );

		$this->assertSame( $title, ( new Field_Source_Resolver() )->resolve( 'property:title', $post ) );
		$this->assertSame( $title, ( new Field_Source_Resolver() )->resolve( 'property:post_title', $post ) );
	}

	public function test_a_private_title_is_sent_without_the_private_prefix(): void {
		$post_id = self::factory()->post->create(
			[
				'post_title'  => 'Staff Notes',
				'post_status' => 'private',
			]
		);

		$this->assertSame( 'Staff Notes', ( new Field_Source_Resolver() )->resolve( 'property:title', get_post( $post_id ) ) );
	}

	/**
	 * The block editor saves a typed `&` as `&amp;` and a hard space as
	 * `&nbsp;`. An entity that spells a tag is text, and stays text.
	 */
	public function test_the_content_and_the_excerpt_are_sent_as_text(): void {
		$content = '<!-- wp:paragraph --><p>Salt &amp; pepper&nbsp;mill for &#039;fresh&#039; &lt;ground&gt; spice</p><!-- /wp:paragraph -->';
		$text    = "Salt & pepper mill for 'fresh' <ground> spice";
		$typed   = self::factory()->post->create(
			[
				'post_content' => $content,
				'post_excerpt' => 'Tea &amp; biscuits&nbsp;&#8230;',
			]
		);
		$derived = self::factory()->post->create(
			[
				'post_content' => $content,
				'post_excerpt' => '',
			]
		);
		$source  = new Field_Source_Resolver();

		$this->assertSame( $text, $source->resolve( 'property:content', get_post( $typed ) ) );
		$this->assertSame( "Tea & biscuits \u{2026}", $source->resolve( 'property:excerpt', get_post( $typed ) ) );
		$this->assertSame( $text, $source->resolve( 'property:excerpt', get_post( $derived ) ) );
	}

	/**
	 * WordPress stores a display name escaped, as it stores a term name.
	 */
	public function test_the_author_is_sent_as_typed(): void {
		$user_id = self::factory()->user->create( [ 'display_name' => 'Smith & Sons' ] );
		$post_id = self::factory()->post->create( [ 'post_author' => $user_id ] );

		$this->assertSame( 'Smith & Sons', ( new Field_Source_Resolver() )->resolve( 'property:author', get_post( $post_id ) ) );
	}
}
