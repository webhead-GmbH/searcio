<?php
/**
 * Field source resolver.
 *
 * Resolves a mapping "source" string against a WP_Post into a value suitable for
 * a Searcio document field. Three source schemes are supported (v1 scope -
 * ACF is post meta, so it is covered by `meta:`):
 *
 * - `meta:{key}`        - a single post meta value (custom field).
 * - `taxonomy:{tax}`    - the post's term names for a taxonomy (array of strings,
 *                         HTML entities decoded).
 * - `property:{name}`   - an internal object property (`title`, `content`,
 *                         `excerpt`, `permalink`, `thumbnail`, `date`,
 *                         `modified`, `author`, `slug`). The text ones
 *                         (`title`, `content`, `excerpt`, `author`) are plain
 *                         text, HTML entities decoded.
 *
 * Unknown or empty schemes resolve to `null` so the document builder can skip
 * the field cleanly.
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
final class Field_Source_Resolver {
	/**
	 * A tag that ends a word where it stands: a line break, a rule, or the
	 * start or end of a block-level element. Stripped like any other tag,
	 * `<li>Wool</li><li>Silk</li>` read "WoolSilk", and "list.</p><h2>Road"
	 * read "list.Road", which a search tokenizer keeps as one word.
	 */
	private const WORD_BREAK = '#<(?:br|hr|/?(?:p|div|h[1-6]|ul|ol|li|dl|dt|dd|blockquote|pre|table|caption|thead|tbody|tfoot|tr|th|td|figure|figcaption|section|article|aside|header|footer|nav|main|address|details|summary))\b[^>]*>#i';

	/**
	 * Resolve a source string for a post.
	 *
	 * @return mixed Scalar, array of strings, or null when nothing resolves.
	 */
	public function resolve( string $source, WP_Post $post ): mixed {
		$source = trim( $source );

		if ( '' === $source || ! str_contains( $source, ':' ) ) {
			return null;
		}

		[ $scheme, $key ] = explode( ':', $source, 2 );
		$key              = trim( $key );

		return match ( strtolower( trim( $scheme ) ) ) {
			'meta'     => $this->resolve_meta( $key, $post ),
			'taxonomy' => $this->resolve_taxonomy( $key, $post ),
			'property' => $this->resolve_property( $key, $post ),
			default    => null,
		};
	}

	private function resolve_meta( string $key, WP_Post $post ): mixed {
		if ( '' === $key || $this->is_protected_meta_key( $key, $post ) ) {
			return null;
		}

		$value = get_post_meta( $post->ID, $key, true );

		if ( '' === $value || null === $value || [] === $value ) {
			return null;
		}

		return $this->decoded( $value );
	}

	/**
	 * A meta value's text as it was typed. ACF and the custom fields box save
	 * what a user without `unfiltered_html` sends through kses, which writes an
	 * "&" as "&amp;", and a field is shown and filtered on as text, as the title
	 * is ({@see self::clean()}). Numbers and flags stay what they are, and a
	 * list stays a list.
	 */
	private function decoded( mixed $value ): mixed {
		if ( is_string( $value ) ) {
			return Term_Names::decode( $value );
		}

		if ( is_array( $value ) ) {
			return array_map( fn ( mixed $one ): mixed => $this->decoded( $one ), $value );
		}

		return $value;
	}

	/**
	 * WordPress treats `_`-prefixed keys as protected meta: internal values
	 * hidden from the custom-fields UI (order internals, plugin bookkeeping,
	 * transient handshakes). They are never pushed to Searcio by default so
	 * an over-broad mapping cannot silently leak internal data into public
	 * search. A site that deliberately needs one indexed can allow it per key
	 * through the `searcio_index_allow_protected_meta` filter.
	 */
	private function is_protected_meta_key( string $key, WP_Post $post ): bool {
		$protected = function_exists( 'is_protected_meta' )
			? is_protected_meta( $key, 'post' )
			: str_starts_with( $key, '_' );

		if ( ! $protected ) {
			return false;
		}

		return ! (bool) apply_filters( 'searcio_index_allow_protected_meta', false, $key, $post );
	}

	/**
	 * The names of the terms the post is assigned, decoded like every other
	 * indexed term name (see {@see Term_Names}). Ancestors are not added here:
	 * a mapped taxonomy sends exactly the terms the post carries.
	 *
	 * @return array<int,string>|null
	 */
	private function resolve_taxonomy( string $taxonomy, WP_Post $post ): ?array {
		$names = Term_Names::for_post( $post, $taxonomy );

		return [] === $names ? null : $names;
	}

	private function resolve_property( string $name, WP_Post $post ): mixed {
		return match ( strtolower( $name ) ) {
			'title', 'post_title'       => $this->clean( (string) $post->post_title ),
			'content', 'post_content'   => $this->render_content( $post ),
			'excerpt', 'post_excerpt'   => $this->clean( $this->excerpt( $post ) ),
			'permalink', 'url'          => $this->permalink( $post ),
			'thumbnail', 'image'        => $this->thumbnail( $post ),
			'date', 'published'         => $this->date( $post->post_date_gmt ),
			'modified'                  => $this->date( $post->post_modified_gmt ),
			'author'                    => $this->author( $post ),
			'slug', 'post_name'         => '' !== $post->post_name ? $post->post_name : null,
			'id'                        => $post->ID,
			default                     => null,
		};
	}

	/**
	 * Plain-text content for full-text indexing. The raw post content is stripped
	 * of HTML and block delimiters rather than run through `the_content`, which is
	 * intentionally avoided: rendering filters are slow and have side effects
	 * (script enqueues, counters) that are unsafe to trigger during bulk sync.
	 */
	private function render_content( WP_Post $post ): ?string {
		return $this->clean( $this->content_markup( $post ) );
	}

	/**
	 * The post's content without the blocks an excerpt leaves out and without
	 * shortcodes, still as markup.
	 */
	private function content_markup( WP_Post $post ): string {
		$content = (string) $post->post_content;

		if ( function_exists( 'excerpt_remove_blocks' ) ) {
			$content = excerpt_remove_blocks( $content );
		}

		if ( function_exists( 'strip_shortcodes' ) ) {
			$content = strip_shortcodes( $content );
		}

		return $content;
	}

	/**
	 * The excerpt as written, or the first 55 words of the content. Still
	 * HTML-encoded either way: {@see clean()} decodes it once.
	 */
	private function excerpt( WP_Post $post ): string {
		if ( '' !== trim( (string) $post->post_excerpt ) ) {
			return (string) $post->post_excerpt;
		}

		return wp_trim_words( $this->with_word_breaks( $this->content_markup( $post ) ), 55, '' );
	}

	/**
	 * A space in place of every tag that ends a word, so the text on either
	 * side of it stays two words once the tags are stripped.
	 */
	private function with_word_breaks( string $markup ): string {
		return (string) preg_replace( self::WORD_BREAK, ' ', $markup );
	}

	private function permalink( WP_Post $post ): ?string {
		$url = get_permalink( $post );

		return false === $url ? null : (string) $url;
	}

	private function thumbnail( WP_Post $post ): ?string {
		$id = get_post_thumbnail_id( $post );

		if ( ! $id ) {
			return null;
		}

		$url = wp_get_attachment_image_url( (int) $id, 'large' );

		return false === $url || null === $url ? null : (string) $url;
	}

	private function author( WP_Post $post ): ?string {
		return $this->clean( (string) get_the_author_meta( 'display_name', (int) $post->post_author ) );
	}

	private function date( string $gmt ): ?string {
		if ( '' === $gmt || '0000-00-00 00:00:00' === $gmt ) {
			return null;
		}

		return gmdate( 'c', (int) strtotime( $gmt . ' UTC' ) );
	}

	/**
	 * Text as a reader sees it on the site, without markup or HTML entities.
	 *
	 * WordPress hands its text back HTML-encoded in more than one way: kses
	 * stores the `&` of a title saved without `unfiltered_html` as `&amp;`,
	 * the block editor saves a typed `&` as `&amp;` and a hard space as
	 * `&nbsp;`, and a display name is stored escaped. A result card prints a
	 * field as text, so an entity left in reached the shopper as written, and
	 * nothing a shopper types contains one. The title is read from the post
	 * rather than through `get_the_title()`, whose display filters write
	 * quotes, dashes and ellipses as entities and put "Private:" before the
	 * title of a private post: the index holds the title as it was typed.
	 *
	 * Tags are stripped before entities are decoded, so `&lt;b&gt;` stays the
	 * text it is. A tag that ends a word leaves a space ({@see WORD_BREAK}),
	 * and a hard space becomes a space, which a search tokenizer splits words
	 * on. A run of spaces then becomes one, and a line loses the spaces at
	 * its ends.
	 */
	private function clean( string $value ): ?string {
		$value = html_entity_decode( wp_strip_all_tags( $this->with_word_breaks( $value ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$value = str_replace( "\u{00A0}", ' ', $value );
		$value = trim( (string) preg_replace( [ '/[ \t]{2,}/', '/ *\n */' ], [ ' ', "\n" ], $value ) );

		return '' === $value ? null : $value;
	}
}
