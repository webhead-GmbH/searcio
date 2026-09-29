<?php
/**
 * Term names as the index holds them.
 *
 * WordPress stores a term's name HTML-escaped: `pre_term_name` runs
 * `_wp_specialchars()` on every save, so a category typed as "Vergaser &
 * Ansaugung" reads back as "Vergaser &amp; Ansaugung". Pushed as is, the entity
 * is what a facet chip displays and what a `filter[field]=` value has to match
 * - and nothing a shopper or a browser sends ever contains it. Every term name
 * the plugin indexes, and every term name it later filters on, is decoded here
 * so the two sides cannot disagree.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use WP_Post;
use WP_Term;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.1.0
 */
final class Term_Names {
	/**
	 * Names of the terms a post is filed under.
	 *
	 * With `$with_ancestors`, every ancestor of those terms follows them,
	 * nearest parent first, so a product filed only under "Sneakers" also
	 * carries "Shoes" and matches a filter or a rule naming the parent. A name
	 * reached twice - two children of one parent, or two terms that happen to
	 * share a name - is listed once.
	 *
	 * @return array<int,string>
	 */
	public static function for_post( WP_Post $post, string $taxonomy, bool $with_ancestors = false ): array {
		if ( '' === $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return [];
		}

		$terms = get_the_terms( $post, $taxonomy );

		if ( ! is_array( $terms ) ) {
			return [];
		}

		if ( $with_ancestors && is_taxonomy_hierarchical( $taxonomy ) ) {
			$terms = array_merge( $terms, self::ancestors( $terms, $taxonomy ) );
		}

		$names = [];

		foreach ( $terms as $term ) {
			$name = $term instanceof WP_Term ? self::decode( $term->name ) : '';

			if ( '' !== $name ) {
				$names[] = $name;
			}
		}

		return array_values( array_unique( $names ) );
	}

	/**
	 * A stored term name as it was typed: "A &amp; B" becomes "A & B".
	 */
	public static function decode( string $name ): string {
		return html_entity_decode( $name, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	/**
	 * @param  array<int,mixed>  $terms
	 * @return array<int,WP_Term>
	 */
	private static function ancestors( array $terms, string $taxonomy ): array {
		$ancestors = [];

		foreach ( $terms as $term ) {
			if ( ! $term instanceof WP_Term ) {
				continue;
			}

			foreach ( get_ancestors( $term->term_id, $taxonomy, 'taxonomy' ) as $ancestor_id ) {
				$ancestor = get_term( (int) $ancestor_id, $taxonomy );

				if ( $ancestor instanceof WP_Term ) {
					$ancestors[ $ancestor->term_id ] = $ancestor;
				}
			}
		}

		return array_values( $ancestors );
	}
}
