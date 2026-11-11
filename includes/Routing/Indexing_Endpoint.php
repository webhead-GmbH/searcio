<?php
/**
 * Indexing configuration endpoint.
 *
 * Backs the Indexing admin tab. It does not invent a second settings store - the
 * mapping lives in the `index_config` option owned by Plugin_Settings and is
 * read/written through Index_Config (which wraps the framework Settings_Manager).
 * GET returns the mapping plus the catalog the UI needs (post types, taxonomies,
 * WooCommerce availability and store attributes); POST validates and persists,
 * bumping the config version. A save that changed the mapping starts a sync,
 * which sends the documents the change altered and takes out the ones it left
 * out: until the next scheduled one, a post the mapping no longer indexes,
 * such as a private one, was still found by every visitor.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Indexing_Endpoint extends Rest_API {
	public function __construct(
		private Index_Config $config,
		private Sync_Service $sync
	) {}

	protected function get_rest_namespace(): string {
		return 'searcio/v1';
	}

	#[Route( '/indexing/config', methods: 'GET', permission_callback: 'can_view' )]
	public function get_config(): WP_REST_Response {
		return new WP_REST_Response( $this->config->catalog() );
	}

	#[Route( '/indexing/config', methods: 'POST', permission_callback: 'can_manage_settings', args: [ 'config' => [ 'type' => 'object' ] ] )]
	public function save_config( WP_REST_Request $request ): WP_REST_Response {
		$incoming = $request->get_param( 'config' );

		if ( ! is_array( $incoming ) ) {
			return new WP_REST_Response(
				[ 'message' => __( 'Invalid indexing configuration payload.', 'searcio' ) ],
				400
			);
		}

		$previous = $this->config->config_version();
		$version  = $this->config->save( $incoming );

		$payload                   = $this->config->catalog();
		$payload['saved']          = true;
		$payload['config_version'] = $version;

		if ( $version !== $previous ) {
			$user_id = get_current_user_id();
			$started = $this->sync->start( Sync_Trigger::Manual, $user_id > 0 ? $user_id : null, false );

			// Not started: no credentials yet, nothing indexed, or a sync
			// already running, which does not see the change for the posts it
			// has passed.
			$payload['sync'] = [
				'started' => ! empty( $started['ok'] ),
				'message' => (string) ( $started['message'] ?? '' ),
			];
		}

		return new WP_REST_Response( $payload );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}
}
