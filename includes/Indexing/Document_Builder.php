<?php
/**
 * Document builder.
 *
 * Turns a WP_Post into a Search Cloud document using the per-post-type mapping
 * ({@see Index_Config}) and the field source resolvers. Also produces a stable
 * payload hash used by the sync engine (Phase 3) for dirty detection — a post is
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

		if ( 'publish' === $post->post_status ) {
			$ok = true;
		} elseif ( in_array( $post->post_status, [ 'private' ], true ) ) {
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

		$fallback = trim( wp_strip_all_tags( get_the_title( $post ) ) );

		return '' !== $fallback ? $fallback : '#' . $post->ID;
	}

	/**
	 * @param  array<string,mixed>  $document
	 */
	private function assign_recognised( array &$document, string $key, string $source, WP_Post $post ): void {
		if ( '' === $source ) {
			return;
		}

		$value = $this->resolver->resolve( $source, $post );

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
