<?php
/**
 * Take the password-protected posts out of the index.
 *
 * Up to 1.4.0 a password-protected post was indexed as a published one, with
 * its text, whatever "Also index private & password-protected items" said:
 * every visitor could read it in the search window, and the shopping assistant
 * answered from it. The index keeps such a post until a sync takes it out, so
 * the update queues each one at once instead of leaving it there until the
 * next full sync.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Contracts\Lifecycle\Upgrade_Step;
use Webhead\WP\SearchCloud\Sync\Change_Listener;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.1
 */
final class Unindex_Password_Protected_Posts implements Upgrade_Step {
	public function __construct( private Change_Listener $changes ) {}

	public function version(): string {
		return '1.4.1';
	}

	public function run(): void {
		$this->changes->queue_password_protected_posts();
	}
}
