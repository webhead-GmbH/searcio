<?php
/**
 * Remove the leftover site-id option.
 *
 * The connection used to ask for (and store) a Search Cloud site id. Since the
 * switch to key-relative endpoints the credential identifies the tenant on its
 * own, and nothing reads this option any more - the connection screen shows the
 * id straight from the API's response instead. What was left behind is a value
 * that silently goes stale: on a site reconnected to a different tenant it
 * still held `5` while the API reported site `4`, which is misleading to anyone
 * reading the options table or writing an integration against it.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Lifecycle\Upgrade_Step;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.3
 */
final class Delete_Legacy_Site_Id_Option implements Upgrade_Step {
	private const OPTIONS = [
		'webhead_search_cloud_site_id',
		'webhead_search_cloud_site_id_metadata',
	];

	public function version(): string {
		return '1.0.3';
	}

	public function run(): void {
		foreach ( self::OPTIONS as $option ) {
			delete_option( $option );
		}
	}
}
