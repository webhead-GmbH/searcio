<?php
/**
 * Deletes the index refused.
 *
 * The full sync's prune phase finds documents to remove from the snapshot of
 * the last completed run and from the sync meta on each post. A post deleted
 * outright takes its meta with it, and a document only the incremental drain
 * ever pushed is in no snapshot, so once the drain's delete for such a post
 * fails, neither record names the document any more. The same happens when
 * the prune phase's own delete is refused for a document only the snapshot
 * named, because the run then writes a snapshot of what it saw. This list
 * names both, until a delete succeeds: the prune phase reads it and retries
 * on every full sync.
 *
 * It is a per-site option, like the rest of the sync state, so each site of a
 * network keeps its own. It only grows by deletes the index refused, and
 * nothing is written while it has nothing to change.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.5
 */
final class Failed_Deletes {
	/**
	 * @return array<int,string>
	 */
	public function ids(): array {
		$value = get_option( Sync_Keys::OPTION_FAILED_DELETES, [] );

		return is_array( $value ) ? $this->normalize( $value ) : [];
	}

	/**
	 * @param  array<int,string>  $document_ids
	 */
	public function add( array $document_ids ): void {
		$current = $this->ids();
		$next    = $this->normalize( array_merge( $current, $document_ids ) );

		if ( $next !== $current ) {
			$this->store( $next );
		}
	}

	/**
	 * @param  array<int,string>  $document_ids
	 */
	public function forget( array $document_ids ): void {
		$current = $this->ids();

		if ( [] === $current || [] === $document_ids ) {
			return;
		}

		$next = array_values( array_diff( $current, $this->normalize( $document_ids ) ) );

		if ( $next !== $current ) {
			$this->store( $next );
		}
	}

	/**
	 * @param  array<mixed>  $ids
	 * @return array<int,string>
	 */
	private function normalize( array $ids ): array {
		$ids = array_filter( array_map( 'strval', $ids ), static fn( string $id ): bool => '' !== $id );

		return array_values( array_unique( $ids ) );
	}

	/**
	 * @param  array<int,string>  $document_ids
	 */
	private function store( array $document_ids ): void {
		if ( [] === $document_ids ) {
			delete_option( Sync_Keys::OPTION_FAILED_DELETES );

			return;
		}

		update_option( Sync_Keys::OPTION_FAILED_DELETES, $document_ids, false );
	}
}
