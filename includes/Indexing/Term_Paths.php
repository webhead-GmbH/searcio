<?php
/**
 * Category paths: a term with every level above it, "Fahrwerke >
 * Gewindefahrwerke > MTS Technik".
 *
 * A name is not unique in a taxonomy - a shop can have three "MTS Technik"
 * under three parents - but WordPress allows only one term of a name under one
 * parent, so the path from the top is. Searcio reads a facet field whose name
 * ends in `_paths` as a tree: each value is one category with its own count,
 * and on `/search` it also says the value's last level and its parent. A
 * filter on a path finds everything filed under it, as long as each document
 * carries every level, which {@see self::for_post()} sends.
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
 * @since 1.4.1
 */
final class Term_Paths {
	/** What joins two levels of a path, as Searcio reads it. */
	public const SEPARATOR = ' > ';

	/**
	 * The paths of the terms a post is filed under and of each of their
	 * ancestors, the top level first: a product filed under "MTS Technik"
	 * carries "Fahrwerke", "Fahrwerke > Gewindefahrwerke" and "Fahrwerke >
	 * Gewindefahrwerke > MTS Technik", so a filter on any of the three finds
	 * it.
	 *
	 * @return array<int,string>
	 */
	public static function for_post( WP_Post $post, string $taxonomy ): array {
		if ( '' === $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return [];
		}

		$terms = get_the_terms( $post, $taxonomy );

		if ( ! is_array( $terms ) ) {
			return [];
		}

		$paths = [];

		foreach ( $terms as $term ) {
			if ( ! $term instanceof WP_Term ) {
				continue;
			}

			$levels = [ self::level( $term->name ) ];

			foreach ( get_ancestors( $term->term_id, $taxonomy, 'taxonomy' ) as $ancestor_id ) {
				$ancestor = get_term( (int) $ancestor_id, $taxonomy );

				if ( $ancestor instanceof WP_Term ) {
					$levels[] = self::level( $ancestor->name );
				}
			}

			$levels = array_reverse( $levels );

			foreach ( array_keys( $levels ) as $index ) {
				$paths[] = implode( self::SEPARATOR, array_slice( $levels, 0, $index + 1 ) );
			}
		}

		return array_values( array_unique( $paths ) );
	}

	/**
	 * Term ID => path, for a whole taxonomy's terms, read from the terms given
	 * without asking the database again. A parent that is not among them ends
	 * the path there.
	 *
	 * @param  array<int,mixed>  $terms
	 * @return array<int,string>
	 */
	public static function of_terms( array $terms ): array {
		$by_id = [];

		foreach ( $terms as $term ) {
			if ( $term instanceof WP_Term ) {
				$by_id[ $term->term_id ] = $term;
			}
		}

		$paths = [];

		foreach ( $by_id as $id => $term ) {
			$levels = [];
			$seen   = [];

			// A parent loop, which only a broken database has, ends the walk.
			for ( $current = $term; null !== $current && ! isset( $seen[ $current->term_id ] ); $current = $by_id[ $current->parent ] ?? null ) {
				$seen[ $current->term_id ] = true;
				array_unshift( $levels, self::level( $current->name ) );
			}

			$paths[ $id ] = implode( self::SEPARATOR, $levels );
		}

		return $paths;
	}

	/**
	 * A stored term name as one level of a path: decoded as every indexed term
	 * name is (see {@see Term_Names}), and with a ">" that stands alone - "A >
	 * B", or one at either end - written as "›", which would otherwise split
	 * the name into two levels.
	 */
	public static function level( string $name ): string {
		$name = trim( Term_Names::decode( $name ) );

		return preg_replace( '/(?<=^|\s)>(?=\s|$)/u', '›', $name ) ?? $name;
	}
}
