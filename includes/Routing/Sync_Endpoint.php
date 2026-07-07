<?php
/**
 * Sync control + history endpoint.
 *
 * Backs the Sync dashboard: status poll, control actions (start/pause/resume/cancel/force
 * re-sync), and DataViews history (filtered, sorted, paginated) with per-row delete and a
 * clear-finished action. State lives in the sync_runs table via Sync_State. Permission is
 * split: read-only status/history requires {@see Plugin_Capabilities::VIEW}; operational
 * actions require {@see Plugin_Capabilities::RUN_SYNC}. History retention
 * (`sync_retention_days`) is managed on the schema-driven General settings tab, not here.
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
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Sync\Sync_State;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_Endpoint extends Rest_API {
	public function __construct(
		private Sync_Service $service,
		private Sync_State $state
	) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/sync/status', methods: 'GET', permission_callback: 'can_view' )]
	public function status(): WP_REST_Response {
		return new WP_REST_Response( $this->service->status() );
	}

	#[Route( '/sync/start', methods: 'POST', permission_callback: 'can_run_sync' )]
	public function start( WP_REST_Request $request ): WP_REST_Response {
		$force  = (bool) $request->get_param( 'force' );
		$result = $this->service->start( Sync_Trigger::Manual, get_current_user_id() ?: null, $force );

		return new WP_REST_Response( $result, $result['ok'] ? 200 : 409 );
	}

	#[Route( '/sync/pause', methods: 'POST', permission_callback: 'can_run_sync' )]
	public function pause( WP_REST_Request $request ): WP_REST_Response {
		return $this->control( $request, 'pause' );
	}

	#[Route( '/sync/resume', methods: 'POST', permission_callback: 'can_run_sync' )]
	public function resume( WP_REST_Request $request ): WP_REST_Response {
		return $this->control( $request, 'resume' );
	}

	#[Route( '/sync/cancel', methods: 'POST', permission_callback: 'can_run_sync' )]
	public function cancel( WP_REST_Request $request ): WP_REST_Response {
		return $this->control( $request, 'cancel' );
	}

	#[Route( '/sync/history', methods: 'GET', permission_callback: 'can_view' )]
	public function history( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->state->history(
			[
				'page'        => (int) ( $request->get_param( 'page' ) ?? 1 ),
				'per_page'    => (int) ( $request->get_param( 'per_page' ) ?? 20 ),
				'order_by'    => (string) ( $request->get_param( 'order_by' ) ?? 'id' ),
				'order'       => (string) ( $request->get_param( 'order' ) ?? 'desc' ),
				'status'      => (string) ( $request->get_param( 'status' ) ?? '' ),
				'trigger'     => (string) ( $request->get_param( 'trigger' ) ?? '' ),
				'date_after'  => (string) ( $request->get_param( 'date_after' ) ?? '' ),
				'date_before' => (string) ( $request->get_param( 'date_before' ) ?? '' ),
			]
		);

		return new WP_REST_Response( $result );
	}

	#[Route( '/sync/history/(?P<id>\\d+)', methods: 'DELETE', permission_callback: 'can_run_sync' )]
	public function delete( WP_REST_Request $request ): WP_REST_Response {
		$deleted = $this->state->delete( (int) $request->get_param( 'id' ) );

		if ( ! $deleted ) {
			return new WP_REST_Response(
				[ 'message' => __( 'That run could not be deleted. The active run is protected.', 'webhead-search-cloud' ) ],
				409
			);
		}

		return new WP_REST_Response( [ 'deleted' => true ] );
	}

	#[Route( '/sync/history', methods: 'DELETE', permission_callback: 'can_run_sync' )]
	public function clear(): WP_REST_Response {
		return new WP_REST_Response( [ 'deleted' => $this->state->clear_finished() ] );
	}

	public function can_view(): bool {
		return current_user_can( Plugin_Capabilities::VIEW );
	}

	public function can_run_sync(): bool {
		return current_user_can( Plugin_Capabilities::RUN_SYNC );
	}

	private function control( WP_REST_Request $request, string $action ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );

		if ( $id <= 0 ) {
			$active = $this->state->active();
			$id     = null === $active ? 0 : (int) $active['id'];
		}

		$ok = match ( $action ) {
			'pause'  => $this->service->pause( $id ),
			'resume' => $this->service->resume( $id ),
			'cancel' => $this->service->cancel( $id ),
			default  => false,
		};

		if ( ! $ok ) {
			return new WP_REST_Response(
				[ 'message' => __( 'That action is not available for the current run state.', 'webhead-search-cloud' ) ],
				409
			);
		}

		$active = $this->state->active();

		return new WP_REST_Response(
			[
				'ok'  => true,
				'run' => null === $active ? null : $this->state->present( $active ),
			]
		);
	}
}
