<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\DTO;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\DTO\Queued_Change;
use Webhead\WP\SearchCloud\Enums\Change_Action;

final class Queued_Change_Test extends TestCase {
	public function test_from_row_builds_a_fully_populated_change(): void {
		$change = Queued_Change::from_row(
			[
				'id'            => '7',
				'object_id'     => '42',
				'object_type'   => 'post',
				'change_action' => 'delete',
			]
		);

		$this->assertSame( 7, $change->id );
		$this->assertSame( 42, $change->object_id );
		$this->assertSame( 'post', $change->object_type );
		$this->assertSame( Change_Action::Delete, $change->action );
	}

	public function test_from_row_defaults_object_type_to_post_when_missing_or_empty(): void {
		$missing = Queued_Change::from_row( [ 'id' => 1, 'object_id' => 2 ] );
		$empty   = Queued_Change::from_row( [ 'id' => 1, 'object_id' => 2, 'object_type' => '' ] );

		$this->assertSame( 'post', $missing->object_type );
		$this->assertSame( 'post', $empty->object_type );
	}

	public function test_from_row_defaults_missing_ids_to_zero_and_action_to_upsert(): void {
		$change = Queued_Change::from_row( [] );

		$this->assertSame( 0, $change->id );
		$this->assertSame( 0, $change->object_id );
		$this->assertSame( Change_Action::Upsert, $change->action );
	}

	public function test_document_id_joins_type_and_object_id(): void {
		$change = Queued_Change::from_row( [ 'id' => 1, 'object_id' => 99, 'object_type' => 'product', 'change_action' => 'upsert' ] );

		$this->assertSame( 'product-99', $change->document_id() );
	}
}
