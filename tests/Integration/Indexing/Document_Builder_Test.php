<?php
/**
 * Document builder: the title a document carries.
 *
 * The storefront prints `title` as text in suggestions and on result cards,
 * so it has to reach the index as the words of the title and not as the HTML
 * `get_the_title()` makes of them. Both paths that write it are covered: the
 * mapped title source and the fallback taken when that source is empty.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use Webhead\WP\SearchCloud\Indexing\Document_Builder;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Document_Builder_Test extends Integration_Test_Case {
	private const TITLE = 'Fjellmark Women\'s "Storm" Rain Jacket - 2--3 Layers & More...';

	/**
	 * @param  array<string,mixed>  $overrides
	 */
	private function index_posts( array $overrides = [] ): void {
		/** @var Index_Config $config */
		$config = $this->service( 'index_config' );

		$config->save( [ 'post' => array_merge( $config->defaults_for( 'post' ), [ 'enabled' => true ], $overrides ) ] );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function build( int $post_id ): array {
		/** @var Document_Builder $builder */
		$builder  = $this->service( 'document_builder' );
		$document = $builder->build( get_post( $post_id ) );

		$this->assertIsArray( $document );

		return $document;
	}

	public function test_the_title_is_indexed_as_typed(): void {
		$this->index_posts();

		$document = $this->build( self::factory()->post->create( [ 'post_title' => self::TITLE ] ) );

		$this->assertSame( self::TITLE, $document['title'] );
	}

	public function test_an_empty_title_source_falls_back_to_the_title_as_typed(): void {
		$this->index_posts( [ 'title_source' => 'meta:whsc_missing_title' ] );

		$document = $this->build( self::factory()->post->create( [ 'post_title' => self::TITLE ] ) );

		$this->assertSame( self::TITLE, $document['title'] );
	}

	public function test_a_post_without_a_title_or_text_is_indexed_under_its_id(): void {
		$this->index_posts();

		$post_id  = self::factory()->post->create( [ 'post_title' => '&nbsp;', 'post_content' => '' ] );
		$document = $this->build( $post_id );

		$this->assertSame( '#' . $post_id, $document['title'] );
	}

	/** "#66" in the results said nothing of what the post was about. */
	public function test_a_post_without_a_title_is_named_by_the_first_words_of_its_text(): void {
		$this->index_posts();

		$post_id = self::factory()->post->create(
			[
				'post_title'   => '',
				'post_content' => '<p>Wolle richtig waschen: lauwarm, mit wenig Waschmittel und nie im Trockner.</p>',
			]
		);

		$this->assertSame( 'Wolle richtig waschen: lauwarm, mit wenig Waschmittel und…', $this->build( $post_id )['title'] );
	}

	/** ACF keeps an image field as the attachment's id; a card needs its address. */
	public function test_an_image_from_a_custom_field_holding_an_attachment_id_is_sent_as_its_address(): void {
		$attachment = self::factory()->attachment->create_upload_object( DIR_TESTDATA . '/images/canola.jpg' );

		$this->index_posts( [ 'image_source' => 'meta:hero_image' ] );

		$post_id = self::factory()->post->create();
		update_post_meta( $post_id, 'hero_image', (string) $attachment );

		$this->assertSame( wp_get_attachment_image_url( $attachment, 'medium_large' ), $this->build( $post_id )['image'] );
	}

	/**
	 * A post's categories share the `categories` field with the products', so
	 * the category filter's tree needs their paths as it needs the products'.
	 */
	public function test_a_post_whose_categories_are_mapped_carries_their_paths(): void {
		$this->index_posts( [ 'fields' => [ [ 'source' => 'taxonomy:category', 'as' => 'categories' ] ] ] );

		$news    = self::factory()->category->create( [ 'name' => 'News' ] );
		$local   = self::factory()->category->create( [ 'name' => 'Local', 'parent' => $news ] );
		$post_id = self::factory()->post->create();

		wp_set_post_categories( $post_id, [ $local ] );

		$document = $this->build( $post_id );

		$this->assertSame( [ 'Local', 'News' ], $document['categories'], 'A hierarchical taxonomy sends the parents too, as a product\'s categories do.' );
		$this->assertSame( [ 'News', 'News > Local' ], $document['category_paths'] );
		$this->assertContains( 'category_paths', $this->service( 'index_config' )->indexed_fields() );
	}

	/**
	 * The tester's "Ratgeber › Pflege › Wolle" went as "Wolle" alone, so a
	 * filter on "Ratgeber" did not find the post. Tags have no parents.
	 */
	public function test_a_mapped_hierarchical_taxonomy_sends_the_parents_too(): void {
		$this->index_posts( [ 'fields' => [ [ 'source' => 'taxonomy:category', 'as' => 'kategorien' ], [ 'source' => 'taxonomy:post_tag', 'as' => 'schlagworte' ] ] ] );

		$guide   = self::factory()->category->create( [ 'name' => 'Ratgeber' ] );
		$care    = self::factory()->category->create( [ 'name' => 'Pflege', 'parent' => $guide ] );
		$wool    = self::factory()->category->create( [ 'name' => 'Wolle', 'parent' => $care ] );
		$post_id = self::factory()->post->create( [ 'tags_input' => [ 'Winter' ] ] );

		wp_set_post_categories( $post_id, [ $wool ] );

		$document = $this->build( $post_id );

		$this->assertSame( [ 'Wolle', 'Pflege', 'Ratgeber' ], $document['kategorien'] );
		$this->assertSame( [ 'Winter' ], $document['schlagworte'] );
	}

	public function test_a_post_without_its_categories_mapped_carries_no_paths(): void {
		$this->index_posts( [ 'fields' => [ [ 'source' => 'taxonomy:post_tag', 'as' => 'categories' ] ] ] );

		$post_id = self::factory()->post->create( [ 'tags_input' => [ 'Wetter' ] ] );

		$this->assertArrayNotHasKey( 'category_paths', $this->build( $post_id ), 'Tags have no levels to tell apart.' );
		$this->assertNotContains( 'category_paths', $this->service( 'index_config' )->indexed_fields() );
	}

	/**
	 * "The newest products" listed the site's oldest pages: Searcio had no
	 * date to sort by. It reads `published_at` as an ISO 8601 date, in UTC
	 * whatever the site's timezone.
	 */
	public function test_every_document_carries_when_it_was_published_in_utc(): void {
		update_option( 'timezone_string', 'Europe/Vienna' );
		$this->index_posts();

		$post_id = self::factory()->post->create(
			[
				'post_status'   => 'publish',
				'post_date'     => '2026-11-01 09:00:00',
				'post_date_gmt' => '2026-11-01 08:00:00',
			]
		);

		$this->assertSame( '2026-11-01T08:00:00Z', $this->build( $post_id )['published_at'] );
		$this->assertNotContains( 'published_at', $this->service( 'index_config' )->indexed_fields(), 'A date to sort by, not a field to search or filter on.' );
		$this->assertSame( [ 'published_at' ], Document_Builder::SORT_FIELDS );
	}
}
