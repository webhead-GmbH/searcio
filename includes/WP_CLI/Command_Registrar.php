<?php
/**
 * WP-CLI command registrar.
 *
 * The framework auto-registers its own runtime subcommands under the plugin root
 * but exposes no extension point, so the plugin registers its `sync` subcommand
 * directly on `cli_init`. Hookable so registration stays centralized through the
 * framework Hooks_Manager.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\WP_CLI;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Hooks\Actions;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Command_Registrar implements Actions {
	public function __construct(
		private Sync_Command $command
	) {}

	/**
	 * @return array<string,array{0:string,1:int,2:int}>
	 */
	public function get_actions(): array {
		return [ 'cli_init' => [ 'register', 10, 0 ] ];
	}

	public function register(): void {
		if ( ! defined( 'WP_CLI' ) || ! \WP_CLI ) {
			return;
		}

		\WP_CLI::add_command( 'webhead-search-cloud sync', $this->command );
	}
}
