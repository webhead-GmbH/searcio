<?php
/**
 * Incremental change drain worker.
 *
 * A one-off, self-rescheduling job (like the full-sync tick): the change
 * listener schedules it debounced after editorial events, and the incremental
 * service reschedules it while the queue is non-empty. Registered as a one-off
 * Job_Definition so the framework owns the hook wiring and the per-hook lock.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Jobs;

use Webhead\WP\SearchCloud\Sync\Incremental_Service;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Change_Drain_Job {
	public function __construct(
		private Incremental_Service $service
	) {}

	public function __invoke( mixed ...$args ): void {
		$this->service->drain();
	}
}
