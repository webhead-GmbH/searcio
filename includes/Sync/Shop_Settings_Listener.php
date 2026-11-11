<?php
/**
 * Starts a sync when a WooCommerce setting changes which products are indexed.
 *
 * "Hide out of stock items from the catalog" decides whether an out-of-stock
 * product is visible ({@see \Webhead\WP\SearchCloud\Indexing\Woo::is_visible_product()}),
 * but changing it saves no product, so the change listener never hears of it:
 * the products it hid stayed in search until someone started a sync. A full
 * sync pushes only the documents that changed and takes out those no longer
 * indexable.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use Webhead\WP\SearchCloud\Enums\Sync_Trigger;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.1
 */
final class Shop_Settings_Listener {
	public function __construct(
		private Index_Config $config,
		private Sync_Service $sync
	) {}

	/**
	 * Runs only when the value changed. A shop whose product mapping indexes
	 * hidden products too, or none at all, is not affected.
	 */
	#[Action( 'update_option_woocommerce_hide_out_of_stock_items', accepted_args: 0 )]
	public function on_hide_out_of_stock_change(): void {
		$block = $this->config->block_for( Woo::POST_TYPE );

		if ( null === $block || empty( $block['woo']['only_visible'] ) ) {
			return;
		}

		$user_id = get_current_user_id();

		// Not started without credentials, or while a sync runs; a running one
		// reads the setting for each product it has yet to reach.
		$this->sync->start( Sync_Trigger::Manual, $user_id > 0 ? $user_id : null, false );
	}
}
