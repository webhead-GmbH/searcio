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
	 * The field the purchase price is read from is a meta key and is kept as
	 * one; a mapping saved before the field existed has none.
	 */
	public function test_the_purchase_price_field_is_kept_as_a_meta_key(): void {
		if ( ! post_type_exists( 'product' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		$this->assertFalse( $this->config()->defaults_for( 'product' )['woo']['cost_price'], 'Off until the shop turns it on.' );
		$this->assertSame( '', $this->config()->defaults_for( 'product' )['woo']['cost_meta'] );

		$block = $this->block( 'product' );

		$block['woo']['cost_price'] = true;
		$block['woo']['cost_meta']  = " _wc_cog_cost' OR 1";
		$this->config()->save( [ 'product' => $block ] );

		$this->assertTrue( $this->config()->all()['product']['woo']['cost_price'] );
		$this->assertSame( '_wc_cog_costOR1', $this->config()->all()['product']['woo']['cost_meta'] );

		unset( $block['woo']['cost_meta'] );
		$this->config()->save( [ 'product' => $block ] );

		$this->assertSame( '', $this->config()->all()['product']['woo']['cost_meta'] );
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

	/**
	 * The tester's "interne_notiz", read from a protected key that is never
	 * sent, was offered as a facet and a searchable field and flagged as
	 * nothing, since the list named every mapped field.
	 */
	public function test_a_field_read_from_a_protected_key_is_not_listed(): void {
		$this->config()->save(
			[
				'post' => $this->block(
					'post',
					[
						'fields' => [
							[ 'as' => 'interne_notiz', 'source' => 'meta:_interne_notiz' ],
							[ 'as' => 'lesezeit', 'source' => 'meta:lesezeit' ],
						],
					]
				),
			]
		);

		$this->assertNotContains( 'interne_notiz', $this->config()->indexed_fields() );
		$this->assertContains( 'lesezeit', $this->config()->indexed_fields() );

		add_filter( 'searcio_index_allow_protected_meta', static fn ( bool $allow, string $key ): bool => '_interne_notiz' === $key, 10, 2 );

		$this->assertContains( 'interne_notiz', $this->config()->indexed_fields(), 'A key the site allows is sent, and listed.' );

		remove_all_filters( 'searcio_index_allow_protected_meta' );
	}

	/**
	 * A renamed type: the documents of posts carry "artikel", and the search
	 * window, which is told "post", asks for that.
	 */
	public function test_each_post_type_is_named_by_the_type_its_documents_carry(): void {
		$this->config()->save(
			[
				'post' => $this->block( 'post', [ 'type' => 'Artikel' ] ),
				'page' => $this->block( 'page' ),
			]
		);

		$this->assertSame( [ 'post' => 'artikel', 'page' => 'page' ], $this->config()->document_types() );
		$this->assertArrayHasKey( 'artikel', $this->config()->document_type_labels() );
		$this->assertArrayNotHasKey( 'post', $this->config()->document_type_labels() );
		$this->assertArrayHasKey( 'post', $this->config()->indexable_post_type_labels(), 'The Placement tab still picks a post type.' );
	}

	/**
	 * Elementor's templates and floating elements, and a type the site keeps
	 * out of its own search, were offered as content to search. One that is
	 * indexed already stays.
	 */
	public function test_builder_parts_and_types_kept_out_of_search_are_not_offered(): void {
		register_post_type( 'elementor_library', [ 'public' => true, 'label' => 'My Templates' ] );
		register_post_type( 'whsc_faq', [ 'public' => true, 'exclude_from_search' => true, 'label' => 'FAQ' ] );

		try {
			$offered = static fn ( Index_Config $config ): array => array_column( $config->catalog()['post_types'], 'slug' );

			$this->assertNotContains( 'elementor_library', $offered( $this->config() ) );
			$this->assertNotContains( 'whsc_faq', $offered( $this->config() ) );
			$this->assertContains( 'post', $offered( $this->config() ) );

			$this->config()->save( [ 'whsc_faq' => $this->block( 'whsc_faq' ) ] );

			$this->assertContains( 'whsc_faq', $offered( $this->config() ) );
		} finally {
			unregister_post_type( 'elementor_library' );
			unregister_post_type( 'whsc_faq' );
		}
	}

	/**
	 * A site that maps its post categories as "kategorien" saw every
	 * subcategory under "Main categories only": only `categories` was the
	 * category filter.
	 */
	public function test_a_field_mapped_from_the_categories_is_a_category_field(): void {
		$this->config()->save(
			[
				'post' => $this->block(
					'post',
					[
						'fields' => [
							[ 'as' => 'kategorien', 'source' => 'taxonomy:category' ],
							[ 'as' => 'schlagworte', 'source' => 'taxonomy:post_tag' ],
						],
					]
				),
			]
		);

		$fields = $this->config()->category_fields();

		$this->assertSame( [ 'category' ], $fields['kategorien'] );
		$this->assertArrayHasKey( 'categories', $fields );
		$this->assertArrayNotHasKey( 'schlagworte', $fields );
	}
}
