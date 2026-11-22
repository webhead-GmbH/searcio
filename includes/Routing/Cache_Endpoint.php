<?php
/**
 * Cache clear endpoint.
 *
 * Backs the General settings tab's "Clear cache" button. Clears two things:
 * this plugin's files in PHP's opcode cache, and this plugin's cache group.
 * The opcode cache is the server's, shared on a shared host by every site on
 * it, so only the plugin's own files are taken out of it: `opcache_reset()`
 * emptied it for all of them. Under a busy multi-worker setup other workers
 * still hold their own copy until they next revalidate, so this is a
 * best-effort nudge, not a guaranteed instant site-wide clear.
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
		return 'searcio/v1';
	}

	#[Route( '/cache/clear', methods: 'POST', permission_callback: 'can_manage_settings' )]
	public function clear(): WP_REST_Response {
		$opcache_cleared = $this->invalidate_own_files();

		$this->cache_manager->invalidate_group();

		return new WP_REST_Response(
			[
				'cleared'         => true,
				'opcache_cleared' => $opcache_cleared,
			]
		);
	}

	/**
	 * Takes the plugin's PHP files out of the opcode cache, and no one else's.
	 */
	private function invalidate_own_files(): bool {
		if ( ! function_exists( 'opcache_invalidate' ) || ! defined( 'Webhead\WP\SearchCloud\PLUGIN_FILE' ) ) {
			return false;
		}

		$files = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( dirname( (string) \Webhead\WP\SearchCloud\PLUGIN_FILE ), \FilesystemIterator::SKIP_DOTS )
		);
		$done  = false;

		foreach ( $files as $file ) {
			if ( $file instanceof \SplFileInfo && 'php' === $file->getExtension() && ! str_contains( $file->getPathname(), DIRECTORY_SEPARATOR . 'node_modules' . DIRECTORY_SEPARATOR ) ) {
				$done = opcache_invalidate( $file->getPathname(), true ) || $done;
			}
		}

		return $done;
	}

	public function can_manage_settings(): bool {
		return current_user_can( Plugin_Capabilities::MANAGE_SETTINGS );
	}
}
