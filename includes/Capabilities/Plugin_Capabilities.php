<?php
/**
 * Plugin capabilities.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Capabilities;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Capability;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Network_Capability;

defined( 'ABSPATH' ) || exit;

final class Plugin_Capabilities {
	/**
	 * Read-only access: connection status, sync status/history, indexing
	 * mapping. Grantable independently of {@see self::RUN_SYNC} and
	 * {@see self::MANAGE_SETTINGS}.
	 */
	#[Capability( roles: [ 'administrator' ] )]
	public const VIEW = 'webhead-search-cloud_view';

	/**
	 * Operate the sync engine: start/pause/resume/cancel, manage sync history.
	 * Does not allow changing credentials or the indexing mapping.
	 */
	#[Capability( roles: [ 'administrator' ] )]
	public const RUN_SYNC = 'webhead-search-cloud_run_sync';

	/** Full settings control: connection credentials, indexing mapping, and Popular searches list. */
	#[Capability( roles: [ 'administrator' ] )]
	public const MANAGE_SETTINGS = 'webhead-search-cloud_manage_settings';

	#[Network_Capability(
		network_capability: 'manage_network_options',
		single_site_capability: self::MANAGE_SETTINGS
	)]
	public const MANAGE_NETWORK_SETTINGS = 'webhead-search-cloud_manage_network_settings';
}
