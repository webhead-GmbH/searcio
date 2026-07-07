<?php
/**
 * Field source resolver.
 *
 * Resolves a mapping "source" string against a WP_Post into a value suitable for
 * a Search Cloud document field. Three source schemes are supported (v1 scope —
 * ACF is post meta, so it is covered by `meta:`):
 *
 * - `meta:{key}`        — a single post meta value (custom field).
 * - `taxonomy:{tax}`    — the post's term names for a taxonomy (array of strings).
 * - `property:{name}`   — an internal object property (`title`, `content`,
 *                         `excerpt`, `permalink`, `thumbnail`, `date`,
 *                         `modified`, `author`, `slug`).
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
		if ( '' === $key ) {
			return null;
		}

		$value = get_post_meta( $post->ID, $key, true );

		if ( '' === $value || null === $value || [] === $value ) {
			return null;
		}

		return $value;
	}

	/**
	 * @return array<int,string>|null
	 */
	private function resolve_taxonomy( string $taxonomy, WP_Post $post ): ?array {
		if ( '' === $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return null;
		}

		$terms = get_the_terms( $post, $taxonomy );

		if ( ! is_array( $terms ) ) {
			return null;
		}

		$names = array_values(
			array_filter(
				array_map(
					static fn( $term ): string => isset( $term->name ) ? (string) $term->name : '',
					$terms
				),
				static fn( string $name ): bool => '' !== $name
			)
		);

		return [] === $names ? null : $names;
	}

	private function resolve_property( string $name, WP_Post $post ): mixed {
		return match ( strtolower( $name ) ) {
			'title', 'post_title'       => $this->clean( get_the_title( $post ) ),
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
		$content = (string) $post->post_content;

		if ( function_exists( 'excerpt_remove_blocks' ) ) {
			$content = excerpt_remove_blocks( $content );
		}

		if ( function_exists( 'strip_shortcodes' ) ) {
			$content = strip_shortcodes( $content );
		}

		return $this->clean( $content );
	}

	private function excerpt( WP_Post $post ): string {
		if ( '' !== trim( (string) $post->post_excerpt ) ) {
			return (string) $post->post_excerpt;
		}

		return wp_trim_words( wp_strip_all_tags( (string) $post->post_content ), 55, '' );
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
		$name = get_the_author_meta( 'display_name', (int) $post->post_author );

		return '' === trim( (string) $name ) ? null : (string) $name;
	}

	private function date( string $gmt ): ?string {
		if ( '' === $gmt || '0000-00-00 00:00:00' === $gmt ) {
			return null;
		}

		return gmdate( 'c', (int) strtotime( $gmt . ' UTC' ) );
	}

	private function clean( string $value ): ?string {
		$value = trim( wp_strip_all_tags( $value ) );

		return '' === $value ? null : $value;
	}
}
