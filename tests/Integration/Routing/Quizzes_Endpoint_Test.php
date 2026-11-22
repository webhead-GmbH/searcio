<?php
/**
 * Quizzes REST endpoint integration tests.
 *
 * The Product finder tab makes and edits quizzes through this route, which
 * proxies to Searcio's `/quiz-templates` with the write credentials. Searcio
 * checks the question graph; the route cleans what it forwards, answers the
 * table's search, filters, order and page itself, and hands Searcio's verdict
 * back with its status.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Quizzes_Endpoint_Test extends Integration_Test_Case {
	private const ROUTE = '/searcio/v1/quizzes';

	private const QUIZZES = [
		[ 'id' => 1, 'name' => 'Schuh-Berater', 'status' => 'published', 'lang' => 'de', 'question_count' => 3, 'updated_at' => '2026-11-05T10:00:00+00:00' ],
		[ 'id' => 2, 'name' => 'Shoe finder', 'status' => 'draft', 'lang' => 'en', 'question_count' => 3, 'updated_at' => '2026-11-06T10:00:00+00:00' ],
		[ 'id' => 3, 'name' => 'Gift finder', 'status' => 'published', 'lang' => null, 'question_count' => 2, 'updated_at' => '2026-11-07T10:00:00+00:00' ],
	];

	private WP_REST_Server $server;

	/** @var array<int,array{method:string,path:string,body:mixed}> */
	private array $sent = [];

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		do_action( 'rest_api_init' );

		$this->connect_client();
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	public function test_the_routes_are_registered(): void {
		$routes = $this->server->get_routes();

		foreach ( [ self::ROUTE, self::ROUTE . '/facet-values', self::ROUTE . '/endings', self::ROUTE . '/(?P<id>\d+)' ] as $route ) {
			$this->assertArrayHasKey( $route, $routes );
		}
	}

	/** Quizzes are part of how the shop searches: the Search Config tab's capability, not just a view. */
	public function test_every_route_needs_the_settings_capability(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		foreach ( [ [ 'GET', self::ROUTE ], [ 'POST', self::ROUTE ], [ 'GET', self::ROUTE . '/3' ], [ 'PUT', self::ROUTE . '/3' ], [ 'DELETE', self::ROUTE . '/3' ], [ 'GET', self::ROUTE . '/facet-values' ], [ 'POST', self::ROUTE . '/endings' ] ] as [ $method, $route ] ) {
			$this->assertSame( 403, $this->server->dispatch( new WP_REST_Request( $method, $route ) )->get_status(), "$method $route" );
		}
	}

	/** Searcio returns every quiz at once; the table's search, filter, order and page are answered here. */
	public function test_the_list_is_searched_filtered_sorted_and_paged(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'quizzes' => self::QUIZZES, 'limit' => 50 ] ) );

		$names = fn ( array $query ): array => array_column( $this->get( self::ROUTE, $query )->get_data()['items'], 'name' );

		$this->assertSame( [ 'Gift finder', 'Shoe finder', 'Schuh-Berater' ], $names( [] ), 'The newest first by default.' );
		$this->assertSame( [ 'Gift finder', 'Schuh-Berater', 'Shoe finder' ], $names( [ 'order_by' => 'name', 'order' => 'asc' ] ) );
		$this->assertSame( [ 'Gift finder', 'Shoe finder' ], $names( [ 'search' => 'FINDER' ] ), 'Any case.' );
		$this->assertSame( [ 'Gift finder', 'Schuh-Berater' ], $names( [ 'status' => 'published' ] ) );
		$this->assertSame( [ 'Gift finder' ], $names( [ 'lang' => '-' ] ), 'A quiz for every language has none.' );
		$this->assertSame( [ 'Schuh-Berater' ], $names( [ 'lang' => 'de' ] ) );
		$this->assertSame( [ 'Shoe finder' ], $names( [ 'per_page' => 1, 'page' => 2 ] ) );

		$data = $this->get( self::ROUTE, [ 'per_page' => 1 ] )->get_data();
		$this->assertSame( 3, $data['total'] );
		$this->assertSame( 50, $data['limit'] );
	}

	/**
	 * What the editor sends is cleaned before it reaches Searcio: plain text,
	 * numbers for range bounds, an https image or none. The graph's own shape
	 * passes, and an answer that ends the quiz keeps its null.
	 */
	public function test_a_new_quiz_is_cleaned_and_created(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'id' => 9, 'name' => 'Locks', 'status' => 'draft' ], 201 ) );

		$response = $this->send(
			'POST',
			self::ROUTE,
			[
				'name'      => '<b>Locks</b>',
				'lang'      => 'de',
				'status'    => 'archived',
				'questions' => [
					[
						'id'      => 'what',
						'text'    => 'What do you want to lock?<script>x</script>',
						'image'   => 'javascript:alert(1)',
						'options' => [
							[
								'id'               => 'door',
								'label'            => 'A door',
								'next_question_id' => null,
								'tags_matched'     => [ [ 'field' => 'categories', 'value' => 'Jacken, Mäntel & Strick' ] ],
								'keywords'         => 'Panzerriegel, Zusatzschloss',
								'ranges_matched'   => [ [ 'field' => 'price', 'min' => '', 'max' => '150' ] ],
							],
						],
					],
				],
			]
		);

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 9, $response->get_data()['id'] );
		$this->assertCount( 1, $this->sent, 'A create is asked once.' );
		$this->assertSame( 'POST', $this->sent[0]['method'] );
		$this->assertStringEndsWith( '/quiz-templates', $this->sent[0]['path'] );

		$quiz = $this->sent[0]['body'];
		$this->assertSame( 'Locks', $quiz['name'] );
		$this->assertSame( 'de', $quiz['lang'] );
		$this->assertArrayNotHasKey( 'status', $quiz, 'A status Searcio has not is left out.' );
		$this->assertSame( 'What do you want to lock?', $quiz['questions'][0]['text'] );
		$this->assertArrayNotHasKey( 'image', $quiz['questions'][0] );
		$this->assertSame(
			[
				'id'               => 'door',
				'label'            => 'A door',
				'next_question_id' => null,
				'tags_matched'     => [ [ 'field' => 'categories', 'value' => 'Jacken, Mäntel & Strick' ] ],
				'keywords'         => 'Panzerriegel, Zusatzschloss',
				'ranges_matched'   => [ [ 'field' => 'price', 'min' => null, 'max' => 150 ] ],
			],
			$quiz['questions'][0]['options'][0]
		);
	}

	public function test_a_create_that_fails_is_not_asked_again(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'message' => 'Server Error' ], 500 ) );

		$response = $this->send( 'POST', self::ROUTE, [ 'name' => 'Locks' ] );

		$this->assertSame( 500, $response->get_status() );
		$this->assertCount( 1, $this->sent, 'A create that timed out may still have made the quiz.' );
	}

	/** An update sends only what changes: publishing sends the status and nothing else. */
	public function test_an_update_sends_only_what_changes(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'id' => 3, 'status' => 'published' ] ) );

		$this->send( 'PUT', self::ROUTE . '/3', [ 'status' => 'published' ] );

		$this->assertSame( 'PUT', $this->sent[0]['method'] );
		$this->assertStringEndsWith( '/quiz-templates/3', $this->sent[0]['path'] );
		$this->assertSame( [ 'status' => 'published' ], $this->sent[0]['body'] );
	}

	/** A refused publish reaches the editor with the sentences that say what to change. */
	public function test_a_refusal_reaches_the_editor_with_its_reasons(): void {
		$this->as_admin();
		$errors = [ 'message' => 'The quiz cannot be published.', 'errors' => [ 'questions' => [ 'Answer "A door" filters on "colour", which is not a filter of this site.' ] ] ];
		$this->fake_service( fn (): array => $this->http_ok( $errors, 422 ) );

		$response = $this->send( 'PUT', self::ROUTE . '/3', [ 'status' => 'published' ] );

		$this->assertSame( 422, $response->get_status() );
		$this->assertSame( $errors, $response->get_data() );
	}

	public function test_a_quiz_is_read_deleted_and_its_endings_counted(): void {
		$this->as_admin();
		$this->fake_service(
			function ( string $method, string $path ): array {
				if ( 'DELETE' === $method ) {
					return $this->http_ok( [], 204 );
				}

				return str_ends_with( $path, '/endings' )
					? $this->http_ok( [ 'endings' => [ [ 'answers' => [], 'count' => 0, 'unknown_fields' => [] ] ], 'truncated' => false ] )
					: $this->http_ok( [ 'id' => 3, 'name' => 'Gift finder', 'questions' => [] ] );
			}
		);

		$this->assertSame( 'Gift finder', $this->get( self::ROUTE . '/3' )->get_data()['name'] );
		$this->assertSame( [ 'deleted' => true ], $this->send( 'DELETE', self::ROUTE . '/3', null )->get_data() );

		$endings = $this->send( 'POST', self::ROUTE . '/endings', [ 'questions' => [ [ 'id' => 'q', 'text' => 'Who?', 'options' => [] ] ] ] );
		$this->assertSame( 0, $endings->get_data()['endings'][0]['count'] );
		$this->assertSame( [ 'questions' => [ [ 'id' => 'q', 'text' => 'Who?', 'options' => [] ] ] ], end( $this->sent )['body'] );
	}

	/**
	 * A German quiz counted 4 products for an ending that found none on the
	 * English pages it was also offered on: the endings are asked for in the
	 * quiz's language, which a service before it ignores.
	 */
	public function test_the_endings_of_a_quiz_in_one_language_are_counted_in_it(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'endings' => [], 'truncated' => false ] ) );

		$this->send( 'POST', self::ROUTE . '/endings', [ 'lang' => 'de', 'questions' => [] ] );
		$this->assertSame( 'de', end( $this->sent )['body']['lang'] ?? null );

		$this->send( 'POST', self::ROUTE . '/endings', [ 'lang' => null, 'questions' => [] ] );
		$this->assertArrayNotHasKey( 'lang', end( $this->sent )['body'] );
	}

	/**
	 * A quiz published in the Product finder tab stayed out of a visit's
	 * search window for ten minutes: the storefront keeps the list for the
	 * visit, keyed by when the plugin last changed it.
	 */
	public function test_a_change_to_a_quiz_makes_the_storefront_ask_for_the_quizzes_again(): void {
		$this->as_admin();
		$this->settings()->set( Plugin_Settings::STOREFRONT_VERSION, 0 );
		$this->fake_service( fn (): array => $this->http_ok( [ 'id' => 3, 'name' => 'Gift finder', 'status' => 'published' ] ) );

		$this->send( 'PUT', self::ROUTE . '/3', [ 'status' => 'published' ] );

		$this->assertGreaterThan( 0, (int) $this->settings()->get( Plugin_Settings::STOREFRONT_VERSION ) );
	}

	/** Searcio's own answer would only say "Unauthenticated"; the editor says what to do. */
	public function test_a_site_searcio_does_not_know_is_told_to_connect(): void {
		$this->as_admin();
		$this->fake_service( fn (): array => $this->http_ok( [ 'message' => 'Unauthenticated.' ], 401 ) );

		$response = $this->get( self::ROUTE );

		$this->assertSame( 401, $response->get_status() );
		$this->assertSame( 'searcio_not_connected', $response->get_data()['code'] );
		$this->assertStringContainsString( 'Connection tab', $response->get_data()['message'] );
	}

	public function test_an_unreachable_service_answers_502(): void {
		$this->as_admin();
		$this->fake_http( static fn () => new \WP_Error( 'http_request_failed', 'timed out' ) );

		$this->assertSame( 502, $this->get( self::ROUTE . '/facet-values' )->get_status() );
	}

	/**
	 * @param  callable(string,string):array<string,mixed>  $answer  Gets the method and the path.
	 */
	private function fake_service( callable $answer ): void {
		$this->fake_http(
			function ( string $url, array $args ) use ( $answer ): array {
				$method       = (string) ( $args['method'] ?? 'GET' );
				$path         = (string) wp_parse_url( $url, PHP_URL_PATH );
				$this->sent[] = [ 'method' => $method, 'path' => $path, 'body' => json_decode( (string) ( $args['body'] ?? 'null' ), true ) ];

				return $answer( $method, $path );
			}
		);
	}

	/**
	 * @param  array<string,mixed>  $query
	 */
	private function get( string $route, array $query = [] ): \WP_REST_Response {
		$request = new WP_REST_Request( 'GET', $route );
		$request->set_query_params( $query );

		return $this->server->dispatch( $request );
	}

	/**
	 * @param  array<string,mixed>|null  $quiz
	 */
	private function send( string $method, string $route, ?array $quiz ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, $route );

		if ( null !== $quiz ) {
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( (string) wp_json_encode( [ 'quiz' => $quiz ] ) );
		}

		return $this->server->dispatch( $request );
	}

	private function as_admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}
}
