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

	public function test_a_post_without_a_title_is_indexed_under_its_id(): void {
		$this->index_posts();

		$post_id  = self::factory()->post->create( [ 'post_title' => '&nbsp;' ] );
		$document = $this->build( $post_id );

		$this->assertSame( '#' . $post_id, $document['title'] );
	}
}
