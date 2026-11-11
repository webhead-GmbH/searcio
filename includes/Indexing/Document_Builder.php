<?php
/**
 * Document builder.
 *
 * Turns a WP_Post into a Searcio document using the per-post-type mapping
 * ({@see Index_Config}) and the field source resolvers. Also produces a stable
 * payload hash used by the sync engine (Phase 3) for dirty detection - a post is
 * only re-pushed when its rendered document actually changes.
 *
 * Document identity is deterministic and type-prefixed (`{post_type}-{ID}`) so
 * re-sending an id upserts the whole document.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use WP_Post;
use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Document_Builder {
	/** The words of its text a post without a title is named by. */
	private const UNTITLED_WORDS = 8;

	public function __construct(
		private Index_Config $config,
		private Field_Source_Resolver $resolver,
		private Woo $woo,
		private Multilingual_Support $multilingual,
		private Language_Config $language_config
	) {}

	public function document_id( WP_Post $post ): string {
		return $post->post_type . '-' . $post->ID;
	}

	/**
	 * Used by the sync engine to decide upsert vs. delete.
	 */
	public function is_indexable( WP_Post $post ): bool {
		$block = $this->config->block_for( $post->post_type );

		if ( null === $block ) {
			return false;
		}

		// A password-protected post is published, but only a reader who has its
		// password may read it, so it is indexed with the private ones, when
		// the mapping asks for those, and never for being published: indexed
		// as published, its text was in every visitor's search window and the
		// shopping assistant read it out.
		if ( 'publish' === $post->post_status && ! $this->is_password_protected( $post ) ) {
			$ok = true;
		} elseif ( in_array( $post->post_status, [ 'publish', 'private' ], true ) ) {
			$ok = ! empty( $block['include_private'] );
		} else {
			return false;
		}

		if ( ! $ok ) {
			return false;
		}

		if ( Woo::POST_TYPE === $post->post_type && ! empty( $block['woo']['only_visible'] ) ) {
			if ( ! $this->woo->is_visible_product( $post ) ) {
				return false;
			}
		}

		return ! $this->is_language_excluded( $post );
	}

	public function is_password_protected( WP_Post $post ): bool {
		return '' !== (string) $post->post_password;
	}

	/**
	 * A post whose language isn't in the site's enabled set is skipped
	 * entirely, so ingest quota is never spent on a disabled language. A post
	 * whose language can't be resolved at all is treated as unrestricted
	 * rather than excluded, since there's nothing concrete to exclude it for.
	 */
	public function is_language_excluded( WP_Post $post ): bool {
		if ( ! $this->multilingual->is_active() ) {
			return false;
		}

		$enabled = $this->language_config->enabled_languages();

		if ( [] === $enabled ) {
			return false;
		}

		$lang = $this->multilingual->post_language( $post->ID );

		return null !== $lang && ! in_array( $lang, $enabled, true );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function build( WP_Post $post ): ?array {
		$block = $this->config->block_for( $post->post_type );

		if ( null === $block || ! $this->is_indexable( $post ) ) {
			return null;
		}

		$document = [
			'id'   => $this->document_id( $post ),
			'type' => (string) $block['type'],
		];

		// Tagged whenever resolvable, independent of whether the site currently
		// restricts languages at all, so the front-end can scope results to a
		// visitor's language. Costs nothing extra since `is_indexable()` above
		// already confirmed this post's language (if any) is in the enabled set.
		$lang = $this->multilingual->post_language( $post->ID );

		if ( null !== $lang ) {
			$document['lang'] = $lang;
		}

		$document['title'] = $this->title( $post, (string) $block['title_source'] );

		$content = $this->resolver->resolve( (string) $block['content_source'], $post );

		if ( is_string( $content ) && '' !== $content ) {
			$document['content'] = $content;
		}

		if ( ! empty( $block['include_excerpt'] ) ) {
			$excerpt = $this->resolver->resolve( 'property:excerpt', $post );

			if ( is_string( $excerpt ) && '' !== $excerpt ) {
				$document['excerpt'] = $excerpt;
			}
		}

		$this->assign_recognised( $document, 'url', (string) $block['url_source'], $post );
		$this->assign_recognised( $document, 'image', (string) $block['image_source'], $post );

		foreach ( $block['fields'] as $field ) {
			$value = $this->resolver->resolve( (string) $field['source'], $post );

			if ( null !== $value && [] !== $value && '' !== $value ) {
				$document[ (string) $field['as'] ] = $value;
			}
		}

		$paths_taxonomy = $this->config->category_paths_taxonomy( $block );
		$paths          = '' === $paths_taxonomy ? [] : Term_Paths::for_post( $post, $paths_taxonomy );

		if ( [] !== $paths ) {
			$document[ Facet_Config::CATEGORY_PATHS_FIELD ] = $paths;
		}

		if ( Woo::POST_TYPE === $post->post_type ) {
			$woo = isset( $block['woo'] ) && is_array( $block['woo'] ) ? $block['woo'] : [];

			foreach ( $this->woo->product_fields( $post, $woo ) as $key => $value ) {
				$document[ $key ] = $value;
			}
		}

		return $document;
	}

	/**
	 * @param  array<string,mixed>  $document
	 */
	public function hash( array $document ): string {
		$sorted = $this->deep_sort( $document );

		return md5( (string) wp_json_encode( $sorted ) );
	}

	private function title( WP_Post $post, string $source ): string {
		$title = $this->resolver->resolve( $source, $post );

		if ( is_string( $title ) && '' !== trim( $title ) ) {
			return $title;
		}

		// The post's own title, decoded as the default source decodes it.
		$fallback = $this->resolver->resolve( 'property:title', $post );

		if ( is_string( $fallback ) && '' !== trim( $fallback ) ) {
			return $fallback;
		}

		// A post without a title showed as "#66", which says nothing of what
		// it holds: the first words of its text say more.
		$text  = $this->resolver->resolve( 'property:content', $post );
		$words = is_string( $text ) ? wp_trim_words( $text, self::UNTITLED_WORDS, '…' ) : '';

		return '' !== trim( $words ) ? $words : '#' . $post->ID;
	}

	/**
	 * @param  array<string,mixed>  $document
	 */
	private function assign_recognised( array &$document, string $key, string $source, WP_Post $post ): void {
		if ( '' === $source ) {
			return;
		}

		$value = $this->resolver->resolve( $source, $post );

		// An image from a custom field is usually an attachment's id - what ACF
		// stores - and a card needs its address, at the size the featured
		// image is sent in.
		if ( 'image' === $key && ( is_int( $value ) || ( is_string( $value ) && ctype_digit( $value ) ) ) ) {
			$url   = wp_get_attachment_image_url( (int) $value, 'medium_large' );
			$value = is_string( $url ) ? $url : null;
		}

		if ( is_string( $value ) && '' !== $value ) {
			$document[ $key ] = $value;
		}
	}

	/**
	 * @param  array<mixed>  $value
	 * @return array<mixed>
	 */
	private function deep_sort( array $value ): array {
		foreach ( $value as &$item ) {
			if ( is_array( $item ) ) {
				$item = $this->deep_sort( $item );
			}
		}

		unset( $item );

		if ( ! $this->is_list( $value ) ) {
			ksort( $value );
		}

		return $value;
	}

	/**
	 * @param  array<mixed>  $value
	 */
	private function is_list( array $value ): bool {
		return [] === $value || array_keys( $value ) === range( 0, count( $value ) - 1 );
	}
}
