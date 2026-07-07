<?php
/**
 * Resync capabilities upgrade step.
 *
 * Grants the newly-introduced {@see \Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities::VIEW}
 * and {@see \Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities::RUN_SYNC} capabilities to their
 * default roles on sites that already activated the plugin before the
 * capability split existed. {@see Capability_Manager::sync()} only adds
 * capabilities, never removes them, so this is safe to replay.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Capabilities\Capability_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Lifecycle\Upgrade_Step;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Resync_Capabilities implements Upgrade_Step {
	public function __construct( private Capability_Manager $capability_manager ) {}

	public function version(): string {
		return '1.0.0';
	}

	public function run(): void {
		$this->capability_manager->sync();
	}
}
