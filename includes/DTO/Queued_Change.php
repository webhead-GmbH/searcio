<?php
/**
 * A single queued incremental change.
 *
 * Immutable value object the drain job works with: which queue row, which post,
 * and whether it should be upserted or deleted. Built from a queue table row by
 * {@see self::from_row()}.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Enums\Change_Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Queued_Change {
	public function __construct(
		public readonly int $id,
		public readonly int $object_id,
		public readonly string $object_type,
		public readonly Change_Action $action
	) {}

	/**
	 * The deterministic `{type}-{id}` document id this change targets.
	 */
	public function document_id(): string {
		return $this->object_type . '-' . $this->object_id;
	}

	/**
	 * @param  array<string,mixed>  $row
	 */
	public static function from_row( array $row ): self {
		return new self(
			(int) ( $row['id'] ?? 0 ),
			(int) ( $row['object_id'] ?? 0 ),
			isset( $row['object_type'] ) && '' !== (string) $row['object_type'] ? (string) $row['object_type'] : 'post',
			Change_Action::from_storage( isset( $row['change_action'] ) ? (string) $row['change_action'] : null )
		);
	}
}
