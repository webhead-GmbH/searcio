<?php
/**
 * Quizzes endpoint.
 *
 * Backs the "Product finder" admin tab, where a shop makes and edits the
 * quizzes of its product finder without opening the Searcio panel. Searcio
 * holds the quizzes (`/quiz-templates`, `docs/api/quiz.md`); this proxies to
 * it with the site's write credentials, which never reach the browser.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Connection\Api_Response;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\DTO\Quiz_Payload;
use Webhead\WP\SearchCloud\Enums\Quiz_Status;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Quizzes_Endpoint extends Rest_API {
	/**
	 * What the quiz table asks with. Searcio returns every quiz of a site at
	 * once (fifty at most), so the search, the filters, the order and the page
	 * are applied here, and the table shows what the server sent.
	 */
	private const LIST_ARGS = [
		'search'   => [ 'type' => 'string' ],
		'status'   => [ 'type' => 'string' ],
		'lang'     => [ 'type' => 'string' ],
		'order_by' => [ 'type' => 'string' ],
		'order'    => [ 'type' => 'string' ],
		'page'     => [ 'type' => 'integer' ],
		'per_page' => [ 'type' => 'integer' ],
	];

	private const QUIZ_ARGS = [
		'id' => [ 'type' => 'integer' ],
	];

	private const ORDER_BY = [ 'name', 'status', 'lang', 'question_count', 'updated_at' ];

	public function __construct( private Search_Cloud_Client $client ) {}

	protected function get_rest_namespace(): string {
		return 'searcio/v1';
	}

	#[Route( '/quizzes', methods: 'GET', permission_callback: 'can_manage', args: self::LIST_ARGS )]
	public function list( WP_REST_Request $request ): WP_REST_Response {
		$response = $this->client->list_quizzes();

		if ( ! $response->ok() ) {
			return $this->respond( $response );
		}

		$body    = $response->body();
		$quizzes = array_values( array_filter( is_array( $body['quizzes'] ?? null ) ? $body['quizzes'] : [], 'is_array' ) );
		$search  = mb_strtolower( trim( (string) ( $request->get_param( 'search' ) ?? '' ) ) );
		$status  = Quiz_Status::tryFrom( (string) ( $request->get_param( 'status' ) ?? '' ) );
		$lang    = (string) ( $request->get_param( 'lang' ) ?? '' );

		$quizzes = array_values(
			array_filter(
				$quizzes,
				static fn ( array $quiz ): bool => ( '' === $search || str_contains( mb_strtolower( (string) ( $quiz['name'] ?? '' ) ), $search ) )
					&& ( null === $status || ( $quiz['status'] ?? '' ) === $status->value )
					// "-" is a quiz for every language, which has none.
					&& ( '' === $lang || ( '-' === $lang ? null === ( $quiz['lang'] ?? null ) : ( $quiz['lang'] ?? null ) === $lang ) )
			)
		);

		$order_by = in_array( $request->get_param( 'order_by' ), self::ORDER_BY, true ) ? (string) $request->get_param( 'order_by' ) : 'updated_at';
		$order    = 'asc' === $request->get_param( 'order' ) ? 1 : -1;

		usort(
			$quizzes,
			static function ( array $a, array $b ) use ( $order_by, $order ): int {
				$left  = $a[ $order_by ] ?? '';
				$right = $b[ $order_by ] ?? '';
				$by    = is_numeric( $left ) && is_numeric( $right )
					? $left <=> $right
					: strnatcasecmp( (string) $left, (string) $right );

				return $order * ( 0 !== $by ? $by : ( (int) ( $a['id'] ?? 0 ) <=> (int) ( $b['id'] ?? 0 ) ) );
			}
		);

		$per_page = max( 1, min( 100, (int) ( $request->get_param( 'per_page' ) ?? 20 ) ) );
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );

		return new WP_REST_Response(
			[
				'items' => array_slice( $quizzes, ( $page - 1 ) * $per_page, $per_page ),
				'total' => count( $quizzes ),
				'limit' => (int) ( $body['limit'] ?? 0 ),
			]
		);
	}

	#[Route( '/quizzes', methods: 'POST', permission_callback: 'can_manage', args: [ 'quiz' => [ 'type' => 'object' ] ] )]
	public function create( WP_REST_Request $request ): WP_REST_Response {
		return $this->respond( $this->client->create_quiz( $this->payload( $request ) ) );
	}

	#[Route( '/quizzes/facet-values', methods: 'GET', permission_callback: 'can_manage' )]
	public function facet_values(): WP_REST_Response {
		return $this->respond( $this->client->quiz_facet_values() );
	}

	#[Route( '/quizzes/endings', methods: 'POST', permission_callback: 'can_manage', args: [ 'quiz' => [ 'type' => 'object' ] ] )]
	public function endings( WP_REST_Request $request ): WP_REST_Response {
		$quiz = $this->payload( $request );

		return $this->respond( $this->client->quiz_endings( $quiz['questions'] ?? [], $quiz['lang'] ?? null ) );
	}

	#[Route( '/quizzes/(?P<id>\\d+)', methods: 'GET', permission_callback: 'can_manage', args: self::QUIZ_ARGS )]
	public function show( WP_REST_Request $request ): WP_REST_Response {
		return $this->respond( $this->client->get_quiz( (int) $request->get_param( 'id' ) ) );
	}

	#[Route( '/quizzes/(?P<id>\\d+)', methods: 'PUT', permission_callback: 'can_manage', args: self::QUIZ_ARGS + [ 'quiz' => [ 'type' => 'object' ] ] )]
	public function update( WP_REST_Request $request ): WP_REST_Response {
		return $this->respond( $this->client->update_quiz( (int) $request->get_param( 'id' ), $this->payload( $request ) ) );
	}

	#[Route( '/quizzes/(?P<id>\\d+)', methods: 'DELETE', permission_callback: 'can_manage', args: self::QUIZ_ARGS )]
	public function delete( WP_REST_Request $request ): WP_REST_Response {
		$response = $this->client->delete_quiz( (int) $request->get_param( 'id' ) );

		return $response->ok() ? new WP_REST_Response( [ 'deleted' => true ] ) : $this->respond( $response );
	}

	/**
	 * Quizzes are part of how the shop's search works, like the Search Config
	 * tab, and need the same capability.
	 */
	public function can_manage(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}

	/**
	 * The quiz under `quiz` in the request body, cleaned.
	 *
	 * @return array<string,mixed>
	 */
	private function payload( WP_REST_Request $request ): array {
		$quiz = $request->get_param( 'quiz' );

		return Quiz_Payload::from_array( is_array( $quiz ) ? $quiz : [] )->values;
	}

	/**
	 * Searcio's answer with its status, so a `422` reaches the editor with the
	 * sentences that say what to change (`errors.questions`, `errors.quiz`).
	 */
	private function respond( Api_Response $response ): WP_REST_Response {
		if ( $response->transport_error ) {
			return new WP_REST_Response( [ 'message' => __( 'Could not reach Searcio.', 'searcio' ) ], 502 );
		}

		// Searcio does not know the site's keys: it is not connected, or no
		// longer. Its own answer would only say "Unauthenticated".
		if ( 401 === $response->status ) {
			return new WP_REST_Response(
				[
					'code'    => 'searcio_not_connected',
					'message' => __( 'Connect this site to Searcio on the Connection tab first.', 'searcio' ),
				],
				401
			);
		}

		return new WP_REST_Response( $response->body(), $response->status );
	}
}
