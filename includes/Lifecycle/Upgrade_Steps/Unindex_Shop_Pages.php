<?php
/**
 * Take WooCommerce's own pages out of the index.
 *
 * Up to 1.4.0 the cart, the checkout, the account and the shop page were
 * indexed like any other page, and a search for "cart" or "checkout" put them
 * first: pages with a block and nothing to read. The index keeps them until a
 * sync takes them out, so the update queues each one at once.
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
final class Unindex_Shop_Pages implements Upgrade_Step {
	public function __construct( private Change_Listener $changes ) {}

	public function version(): string {
		return '1.4.1';
	}

	public function run(): void {
		$this->changes->queue_shop_pages();
	}
}
