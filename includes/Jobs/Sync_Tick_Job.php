<?php
/**
 * Resumable sync tick worker.
 *
 * A one-off, self-rescheduling job (not a recurring schedule): the sync service
 * enqueues the next tick after each one through Jobs_Manager::schedule_single().
 * It is registered as a one-off Job_Definition so the framework owns the hook
 * wiring and the per-hook execution lock (no two ticks run at once), while the
 * cadence stays under the service's control.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Jobs;

use Webhead\WP\SearchCloud\Sync\Sync_Service;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Sync_Tick_Job {
	public function __construct(
		private Sync_Service $service
	) {}

	public function __invoke( mixed ...$args ): void {
		$this->service->tick();
	}
}
