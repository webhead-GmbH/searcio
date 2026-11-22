<?php
/**
 * The names the shop gives its fields, told to Searcio.
 *
 * Its dashboard makes "Farbe" out of `attr_farbe` and can do nothing for
 * `brand`, which the shop reads from a taxonomy it calls "Marke". Searcio
 * takes one label per field once it reports `field_labels`, and the plugin
 * sends them beside the settings, never in them, and only when they differ.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Sync;

use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Field_Label_Sync_Test extends Integration_Test_Case {
	private const MAKER = 'whsc_maker';

	public function set_up(): void {
		parent::set_up();

		register_taxonomy(
			self::MAKER,
			'post',
			[
				'labels' => [
					'name'          => 'Produktmarken',
					'singular_name' => 'Marke',
				],
			]
		);

		$config = $this->service( 'index_config' );

		$config->save(
			[
				'post' => array_merge(
					$config->defaults_for( 'post' ),
					[
						'enabled' => true,
						'fields'  => [ [ 'as' => 'brand', 'source' => 'taxonomy:' . self::MAKER ] ],
					]
				),
			]
		);

		$this->connect_client();
	}

	public function tear_down(): void {
		unregister_taxonomy( self::MAKER );

		parent::tear_down();
	}

	public function test_the_labels_are_the_names_of_the_fields_the_documents_carry(): void {
		$this->assertSame( [ 'brand' => 'Marke' ], $this->sync()->labels() );
	}

	public function test_a_name_for_a_field_no_document_carries_is_not_sent(): void {
		$this->service( 'index_config' )->save( [ 'post' => array_merge( $this->service( 'index_config' )->defaults_for( 'post' ), [ 'enabled' => true, 'fields' => [] ] ) ] );

		$this->assertSame( [], $this->sync()->labels() );
	}

	/** Searcio refuses a request with one name it does not take, and every label with it. */
	public function test_a_label_is_cut_to_what_searcio_takes(): void {
		get_taxonomy( self::MAKER )->labels->singular_name = str_repeat( 'Ä', 150 );

		$this->assertSame( 100, mb_strlen( $this->sync()->labels()['brand'] ) );
	}

	public function test_the_labels_are_sent_alone_once_searcio_holds_others(): void {
		$sent = $this->searcio( [ 'field_labels' => [] ] );

		$this->assertTrue( $this->sync()->push() );
		$this->assertSame( [ [ 'field_labels' => [ 'brand' => 'Marke' ] ] ], $sent->puts );
	}

	/** A Searcio from before the key would drop it, and the request for nothing. */
	public function test_nothing_is_sent_to_a_searcio_that_does_not_report_the_key(): void {
		$sent = $this->searcio( [ 'weights' => [] ] );

		$this->assertFalse( $this->sync()->push() );
		$this->assertSame( [], $sent->puts );
	}

	public function test_nothing_is_sent_when_searcio_holds_what_the_shop_says(): void {
		$sent = $this->searcio( [ 'field_labels' => [ 'brand' => 'Marke' ] ] );

		$this->assertFalse( $this->sync()->push() );
		$this->assertSame( [], $sent->puts );
	}

	public function test_a_renamed_field_is_sent_again(): void {
		$sent = $this->searcio( [ 'field_labels' => [ 'brand' => 'Hersteller' ] ] );

		$this->assertTrue( $this->sync()->push() );
		$this->assertSame( [ [ 'field_labels' => [ 'brand' => 'Marke' ] ] ], $sent->puts );
	}

	/** Beside the settings of a save, not in them. */
	public function test_a_save_of_the_search_configuration_sends_them_in_a_request_of_their_own(): void {
		global $wp_rest_server;
		$wp_rest_server = new \WP_REST_Server();
		do_action( 'rest_api_init' );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$sent = $this->searcio( [ 'field_labels' => [] ] );

		$request = new \WP_REST_Request( 'PUT', '/searcio/v1/search-config' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( [ 'synonyms' => [] ] ) );

		$this->assertSame( 200, $wp_rest_server->dispatch( $request )->get_status() );
		$this->assertCount( 2, $sent->puts );
		$this->assertArrayHasKey( 'synonyms', $sent->puts[0] );
		$this->assertArrayNotHasKey( 'field_labels', $sent->puts[0] );
		$this->assertSame( [ 'field_labels' => [ 'brand' => 'Marke' ] ], $sent->puts[1] );

		$wp_rest_server = null;
	}

	public function test_the_daily_sync_tells_searcio(): void {
		$sent = $this->searcio( [ 'field_labels' => [] ] );

		$this->service( 'scheduled_sync_job' )();

		$this->assertContains( [ 'field_labels' => [ 'brand' => 'Marke' ] ], $sent->puts );
	}

	private function sync(): \Webhead\WP\SearchCloud\Sync\Field_Label_Sync {
		return $this->service( 'field_label_sync' );
	}

	/**
	 * A Searcio that answers a read of the search configuration with `$config`
	 * and takes every write; what was written is on the returned object.
	 *
	 * @param  array<string,mixed>  $config
	 */
	private function searcio( array $config ): object {
		$sent = (object) [ 'puts' => [] ];

		$this->fake_http(
			function ( string $url, array $args ) use ( $sent, $config ): array {
				$method = $args['method'] ?? 'GET';

				if ( 'PUT' === $method && str_contains( $url, '/search-config' ) ) {
					$sent->puts[] = json_decode( (string) ( $args['body'] ?? '' ), true );
				}

				return $this->http_ok( $config );
			}
		);

		return $sent;
	}
}
