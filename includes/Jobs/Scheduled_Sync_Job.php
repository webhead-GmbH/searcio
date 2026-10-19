<?php
/**
 * Recurring scheduled full sync.
 *
 * Daily, per-site, lock-aware. It also asks Search Cloud for the plan tier
 * once a day. It does not do the work itself - it asks the sync
 * service to start a run when the site is connected and idle (and applies the
 * history retention policy). The heavy lifting happens in the resumable tick
 * worker so a single cron invocation never blocks.
 *
 * Real-system-cron users should wire `wp cron event run` (WP-Cron depends on
 * traffic); the bundled WP-CLI command can also drive syncs directly.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Jobs;

use Webhead\WP\SearchCloud\Connection\Connection_State;
use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Sync\Sync_Service;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Cron_Event;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Jobs\Job;

defined( 'ABSPATH' ) || exit;

#[Cron_Event(
	hook: Sync_Keys::HOOK_SCHEDULED,
	recurrence: 'daily',
	use_lock: true
)]
final class Scheduled_Sync_Job implements Job {
	public function __construct(
		private Sync_Service $service,
		private Search_Cloud_Client $client,
		private Connection_State $connection_state
	) {}

	public function __invoke( mixed ...$args ): void {
		// The plan tier decides whether the storefront shows the searcio
		// logo, and an admin screen is not opened every day: a plan that
		// changed is noticed here within a day.
		if ( $this->client->is_configured() ) {
			$this->connection_state->remember_plan( $this->client->health() );
		}

		$this->service->run_scheduled();
	}
}
