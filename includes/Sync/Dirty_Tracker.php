<?php
/**
 * Per-post dirty tracking.
 *
 * Owns the sync meta written on every successful push so the full sync and the
 * incremental drain agree on one contract: a post is only re-pushed when its
 * rendered document hash changes, the mapping `config_version` moved, or a
 * re-sync is forced. The same meta is the record of which posts this site has
 * in the index, which the full sync's prune phase reads.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Dirty_Tracker {
	public function is_fresh( WP_Post $post, string $hash, int $config_version ): bool {
		$stored_cv   = (int) get_post_meta( $post->ID, Sync_Keys::META_CONFIG_VER, true );
		$stored_hash = (string) get_post_meta( $post->ID, Sync_Keys::META_DOC_HASH, true );

		if ( '' === $stored_hash || $stored_cv !== $config_version ) {
			return false;
		}

		return $stored_hash === $hash;
	}

	public function was_indexed( int $post_id ): bool {
		return '' !== (string) get_post_meta( $post_id, Sync_Keys::META_DOC_HASH, true );
	}

	/**
	 * The document id of every post {@see self::was_indexed()} holds true for,
	 * on the current site. Both the full sync and the incremental drain record
	 * a push through {@see self::mark_synced()}, and a successful delete clears
	 * it, so this is what the site has in the index whichever path put it
	 * there. Ids follow {@see \Webhead\WP\SearchCloud\Indexing\Document_Builder::document_id()}.
	 *
	 * @return array<int,string>
	 */
	public function indexed_document_ids(): array {
		global $wpdb;

		// One column, built in SQL: this can list the whole catalogue, so each
		// row should cost a single string rather than a row object and an array.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- read once per full sync; the meta API cannot list posts by key without loading each one.
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT CONCAT( p.post_type, '-', p.ID ) FROM {$wpdb->postmeta} m INNER JOIN {$wpdb->posts} p ON p.ID = m.post_id WHERE m.meta_key = %s AND m.meta_value <> '' ORDER BY p.ID ASC",
				Sync_Keys::META_DOC_HASH
			)
		);

		// A post can carry the key twice if something added it with add_post_meta().
		return is_array( $ids ) ? array_values( array_unique( array_map( 'strval', $ids ) ) ) : [];
	}

	public function mark_synced( int $post_id, string $hash, int $config_version ): void {
		update_post_meta( $post_id, Sync_Keys::META_SYNCED_AT, time() );
		update_post_meta( $post_id, Sync_Keys::META_DOC_HASH, $hash );
		update_post_meta( $post_id, Sync_Keys::META_CONFIG_VER, $config_version );
	}

	public function clear( int $post_id ): void {
		delete_post_meta( $post_id, Sync_Keys::META_SYNCED_AT );
		delete_post_meta( $post_id, Sync_Keys::META_DOC_HASH );
		delete_post_meta( $post_id, Sync_Keys::META_CONFIG_VER );
	}

	/**
	 * `$document_id` is a deterministic `{type}-{ID}` string; extract the ID.
	 */
	public function clear_for_document( string $document_id ): void {
		$position = strrpos( $document_id, '-' );

		if ( false === $position ) {
			return;
		}

		$post_id = (int) substr( $document_id, $position + 1 );

		if ( $post_id > 0 ) {
			$this->clear( $post_id );
		}
	}
}
