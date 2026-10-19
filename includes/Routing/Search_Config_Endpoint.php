<?php
/**
 * Search configuration endpoint.
 *
 * Backs the "Search Config" admin tab. This is a thin proxy - Search Cloud's
 * `/search-config` is the source of truth for searchable fields/weights, type
 * boosts, facet/suggest fields, synonyms and languages, unlike `Plugin_Settings`,
 * which owns plugin-local config. GET/PUT pass the API's own response straight
 * through (status code included) so a `422` validation envelope reaches the
 * admin UI with its field-level errors intact.
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
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Search_Config_Endpoint extends Rest_API {
	public function __construct(
		private Search_Cloud_Client $client,
		private Language_Config $language_config
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/search-config', methods: 'GET', permission_callback: 'can_view' )]
	public function get_config(): WP_REST_Response {
		return $this->respond( $this->client->get_search_config() );
	}

	#[Route( '/search-config', methods: 'PUT', permission_callback: 'can_manage_settings' )]
	public function update_config( WP_REST_Request $request ): WP_REST_Response {
		$payload = $request->get_json_params();

		if ( ! is_array( $payload ) ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Invalid search configuration payload.', 'webhead-search-cloud' ) ],
				400
			);
		}

		return $this->respond( $this->client->update_search_config( $payload ) );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}

	private function respond( Api_Response $response ): WP_REST_Response {
		if ( $response->transport_error ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Could not reach Search Cloud.', 'webhead-search-cloud' ) ],
				502
			);
		}

		// Mirror `languages` locally on every successful read/write so `Document_Builder` and the
		// front-end language filter don't need a live API round trip on every sync or page load.
		if ( $response->ok() ) {
			$this->language_config->set_enabled_languages( $response->body()['languages'] ?? [] );
		}

		return new WP_REST_Response( $response->body(), $response->status );
	}
}
