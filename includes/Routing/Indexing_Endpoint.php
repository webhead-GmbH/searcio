<?php
/**
 * Indexing configuration endpoint.
 *
 * Backs the Indexing admin tab. It does not invent a second settings store - the
 * mapping lives in the `index_config` option owned by Plugin_Settings and is
 * read/written through Index_Config (which wraps the framework Settings_Manager).
 * GET returns the mapping plus the catalog the UI needs (post types, taxonomies,
 * WooCommerce availability and store attributes); POST validates and persists,
 * bumping the config version.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Indexing_Endpoint extends Rest_API {
	public function __construct(
		private Index_Config $config
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
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

		$version = $this->config->save( $incoming );

		$payload                   = $this->config->catalog();
		$payload['saved']          = true;
		$payload['config_version'] = $version;

		return new WP_REST_Response( $payload );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}
}
