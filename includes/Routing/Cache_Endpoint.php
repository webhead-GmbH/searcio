<?php
/**
 * Cache clear endpoint.
 *
 * Backs the General settings tab's "Clear cache" button. Clears two things:
 * PHP's opcode cache and this plugin's cache group. `opcache_reset()` only
 * clears the current PHP worker's own cache - under a busy multi-worker setup
 * other workers still hold their own copy until they next revalidate, so this
 * is a best-effort nudge, not a guaranteed instant site-wide clear.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Routing;

use WP_REST_Response;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Route;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Cache\Cache_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Routing\Rest_API;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Cache_Endpoint extends Rest_API {
	public function __construct( private Cache_Manager $cache_manager ) {}

	protected function get_rest_namespace(): string {
		return 'webhead-search-cloud/v1';
	}

	#[Route( '/cache/clear', methods: 'POST', permission_callback: 'can_manage_settings' )]
	public function clear(): WP_REST_Response {
		$opcache_cleared = function_exists( 'opcache_reset' ) && opcache_reset();

		$this->cache_manager->invalidate_group();

		return new WP_REST_Response(
			[
				'cleared'         => true,
				'opcache_cleared' => $opcache_cleared,
			]
		);
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}
}
