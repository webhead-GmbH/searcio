<?php
/**
 * Placement settings endpoint.
 *
 * Backs the Placement admin tab. The settings live in the `placement` option
 * owned by Plugin_Settings and are read and written through Placement_Config.
 * GET returns them with what the tab needs besides (the theme and the
 * selectors suggested for it, the content types, the preview's address); POST
 * cleans and stores them, and answers with what was stored, so a selector the
 * cleaning dropped is gone from the tab too.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Request;
use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\DTO\Look;
use Webhead\WP\SearchCloud\Frontend\Google_Fonts;
use Webhead\WP\SearchCloud\Frontend\Look_Styles;
use Webhead\WP\SearchCloud\Frontend\Placement_Preview;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Placement_Endpoint extends Rest_API {
	public function __construct(
		private Placement_Config $config
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/placement', methods: 'GET', permission_callback: 'can_view' )]
	public function get_placement(): WP_REST_Response {
		return new WP_REST_Response( $this->config->catalog() );
	}

	#[Route( '/placement', methods: 'POST', permission_callback: 'can_manage_settings', args: [ 'placement' => [ 'type' => 'object' ] ] )]
	public function save_placement( WP_REST_Request $request ): WP_REST_Response {
		$incoming = $request->get_param( 'placement' );

		if ( ! is_array( $incoming ) ) {
			return new WP_REST_Response(
				[ 'message' => __( 'The placement settings were missing from the request.', 'searcio' ) ],
				400
			);
		}

		$this->config->save( $incoming );

		$payload          = $this->config->catalog();
		$payload['saved'] = true;

		return new WP_REST_Response( $payload );
	}

	/**
	 * The CSS of a Look the editor has on screen, for the preview's instance,
	 * and the Google Fonts stylesheet it needs. The editor sends it into the
	 * preview as it changes, so the preview shows what the storefront will.
	 */
	#[Route( '/placement/look-css', methods: 'POST', permission_callback: 'can_manage_settings', args: [ 'look' => [ 'type' => 'object' ] ] )]
	public function look_css( WP_REST_Request $request ): WP_REST_Response {
		$look = Look::from_array( $request->get_param( 'look' ) );

		return new WP_REST_Response(
			[
				'css'   => Look_Styles::css( $look, Placement_Preview::INSTANCE ),
				'fonts' => Google_Fonts::url( Look_Styles::google_families( $look, Google_Fonts::site_families() ) ),
			]
		);
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}
}
