<?php
/**
 * Search configuration endpoint.
 *
 * Backs the "Search Config" admin tab. This is a thin proxy - Searcio's
 * `/search-config` is the source of truth for searchable fields/weights, type
 * boosts, facet/suggest fields, synonyms and languages, unlike `Plugin_Settings`,
 * which owns plugin-local config. GET/PUT pass the API's own response straight
 * through (status code included) so a `422` validation envelope reaches the
 * admin UI with its field-level errors intact.
 *
 * A save that changed the languages starts a sync: which posts are indexed
 * depends on them, and so does the language each document is searched in.
 * The answer then carries `sync`, `{ started, message }`, beside the
 * configuration.
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
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Indexing\Facet_Config;
use Webhead\WP\SearchCloud\Indexing\Language_Config;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Search_Config_Endpoint extends Rest_API {
	public function __construct(
		private Search_Cloud_Client $client,
		private Language_Config $language_config,
		private Facet_Config $facet_config,
		private Woo $woo,
		private Sync_Service $sync
	) {}

	protected function get_rest_namespace(): string {
		return 'searcio/v1';
	}

	/**
	 * Read from Searcio each time, not from the copy kept for ten minutes: the
	 * same settings are edited in the Searcio dashboard, and the tab showed a
	 * boost changed there as it had been, then wrote that back over it.
	 */
	#[Route( '/search-config', methods: 'GET', permission_callback: 'can_view' )]
	public function get_config(): WP_REST_Response {
		return $this->respond( $this->client->get_search_config( true ) );
	}

	#[Route( '/search-config', methods: 'PUT', permission_callback: 'can_manage_settings' )]
	public function update_config( WP_REST_Request $request ): WP_REST_Response {
		$payload = $request->get_json_params();

		if ( ! is_array( $payload ) ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Invalid search configuration payload.', 'searcio' ) ],
				400
			);
		}

		// The shop's currency goes with every save; the tab has no field for it.
		$currency = $this->woo->currency();

		if ( null !== $currency ) {
			$payload['currency'] = $currency;
		}

		$before   = $this->language_config->enabled_languages();
		$response = $this->client->update_search_config( $payload );
		$answer   = $this->respond( $response );

		if ( $response->ok() && ! $this->same_languages( $before, $this->language_config->enabled_languages() ) ) {
			$user_id = get_current_user_id();
			$started = $this->sync->start( Sync_Trigger::Manual, $user_id > 0 ? $user_id : null, false );
			$body    = $answer->get_data();

			if ( is_array( $body ) ) {
				// Not started: no credentials yet, nothing to index, or a sync
				// already running, which does not see the change for the posts
				// it has passed.
				$body['sync'] = [
					'started' => ! empty( $started['ok'] ),
					'message' => (string) ( $started['message'] ?? '' ),
				];

				$answer->set_data( $body );
			}
		}

		return $answer;
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}

	/**
	 * @param  array<int,string>  $before
	 * @param  array<int,string>  $after
	 */
	private function same_languages( array $before, array $after ): bool {
		sort( $before );
		sort( $after );

		return $before === $after;
	}

	private function respond( Api_Response $response ): WP_REST_Response {
		if ( $response->transport_error ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Could not reach Searcio.', 'searcio' ) ],
				502
			);
		}

		// Mirror `languages` and `facet_fields` locally on every successful read/write so
		// `Document_Builder`, the front-end language filter and the search window's filter
		// order don't need a live API round trip on every sync or page load.
		if ( $response->ok() ) {
			$this->language_config->set_enabled_languages( $response->body()['languages'] ?? [] );
			$this->facet_config->set_fields( $response->body()['facet_fields'] ?? [] );
			$this->facet_config->set_match( $response->body()['facet_match'] ?? [] );
		}

		return new WP_REST_Response( $response->body(), $response->status );
	}
}
