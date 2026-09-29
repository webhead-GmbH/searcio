<?php
/**
 * Index configuration: the indexed-field list.
 *
 * {@see \Webhead\WP\SearchCloud\Indexing\Index_Config::indexed_fields()} is
 * what the Search Config tab suggests as searchable, facet and suggest fields
 * and checks configured ones against. It must name every field a built
 * document carries and nothing else - a facet configured on a name the
 * indexer does not write is accepted by the API and stays empty forever. The
 * product half of this contract is in `Woo_Test`, which needs WooCommerce.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Index_Config_Test extends Integration_Test_Case {
	private function config(): Index_Config {
		return $this->service( 'index_config' );
	}

	/**
	 * A block as the Indexing tab sends it: every key present, since a source
	 * left out of a save is stored as cleared.
	 *
	 * @param  array<string,mixed>  $overrides
	 * @return array<string,mixed>
	 */
	private function block( string $post_type, array $overrides = [] ): array {
		return array_merge( $this->config()->defaults_for( $post_type ), [ 'enabled' => true ], $overrides );
	}

	public function test_lists_the_fields_an_enabled_post_type_writes(): void {
		$this->config()->save(
			[
				'post' => $this->block(
					'post',
					[
						'fields' => [
							[
								'as'     => 'subtitle',
								'source' => 'meta:subtitle',
							],
						],
					]
				),
			]
		);

		$this->assertSame(
			[ 'title', 'content', 'excerpt', 'type', 'url', 'image', 'subtitle' ],
			$this->config()->indexed_fields()
		);
	}

	/**
	 * `id` is the document key, and a cleared source writes nothing.
	 */
	public function test_leaves_out_the_document_key_and_cleared_sources(): void {
		$this->config()->save(
			[
				'page' => $this->block(
					'page',
					[
						'include_excerpt' => false,
						'content_source'  => '',
						'image_source'    => '',
					]
				),
			]
		);

		$fields = $this->config()->indexed_fields();

		$this->assertSame( [ 'title', 'type', 'url' ], $fields );
		$this->assertNotContains( 'id', $fields );
	}

	public function test_a_disabled_post_type_contributes_nothing(): void {
		$this->config()->save(
			[
				'post' => $this->block(
					'post',
					[
						'enabled' => false,
						'fields'  => [
							[
								'as'     => 'subtitle',
								'source' => 'meta:subtitle',
							],
						],
					]
				),
			]
		);

		$this->assertSame( [], $this->config()->indexed_fields() );
	}

	public function test_fields_shared_by_several_post_types_are_listed_once(): void {
		$this->config()->save(
			[
				'post' => $this->block( 'post' ),
				'page' => $this->block( 'page' ),
			]
		);

		$fields = $this->config()->indexed_fields();

		$this->assertSame( array_values( array_unique( $fields ) ), $fields );
		$this->assertContains( 'title', $fields );
	}

	/**
	 * The Search Config tab reads the list from `GET /indexing/config`, which
	 * returns the catalog verbatim.
	 */
	public function test_the_catalog_reports_the_indexed_fields(): void {
		$this->config()->save( [ 'post' => $this->block( 'post' ) ] );

		$catalog = $this->config()->catalog();

		$this->assertArrayHasKey( 'indexed_fields', $catalog );
		$this->assertSame( $this->config()->indexed_fields(), $catalog['indexed_fields'] );
	}

	/**
	 * The drift guard: a field the builder starts writing without being listed
	 * here fails this test instead of going unsuggested.
	 */
	public function test_every_field_a_built_post_document_carries_is_listed(): void {
		$this->config()->save(
			[
				'post' => $this->block(
					'post',
					[
						'fields' => [
							[
								'as'     => 'subtitle',
								'source' => 'meta:subtitle',
							],
						],
					]
				),
			]
		);

		$post_id = self::factory()->post->create(
			[
				'post_title'   => 'Listed',
				'post_content' => 'Body text',
				'post_excerpt' => 'A summary',
				'post_status'  => 'publish',
			]
		);
		update_post_meta( $post_id, 'subtitle', 'A subtitle' );
		set_post_thumbnail( $post_id, self::factory()->attachment->create_upload_object( DIR_TESTDATA . '/images/canola.jpg', $post_id ) );

		/** @var Document_Builder $builder */
		$builder  = $this->service( 'document_builder' );
		$document = $builder->build( get_post( $post_id ) );

		$this->assertIsArray( $document );

		$written = array_diff( array_keys( $document ), [ 'id' ] );

		$this->assertEqualsCanonicalizing( $written, $this->config()->indexed_fields() );
	}
}
