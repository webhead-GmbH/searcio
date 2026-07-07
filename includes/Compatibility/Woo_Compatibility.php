<?php
/**
 * WooCommerce compatibility wiring.
 *
 * WooCommerce is a soft dependency. This hookable declares HPOS (custom order
 * tables) compatibility — best practice even though the plugin only indexes
 * products, never orders — and surfaces an admin notice when WooCommerce is
 * active but below the supported minimum, in which case the product indexing
 * section is disabled while WP-content indexing keeps working.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Compatibility;

use Webhead\WP\SearchCloud\Indexing\Woo;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Woo_Compatibility {
	public function __construct( private Woo $woo ) {}

	#[Action( 'before_woocommerce_init' )]
	public function declare_compatibility(): void {
		if ( ! class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			return;
		}

		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
			'custom_order_tables',
			\Webhead\WP\SearchCloud\PLUGIN_FILE,
			true
		);
	}

	#[Action( 'admin_notices' )]
	public function maybe_render_minimum_notice(): void {
		if ( ! $this->woo->is_active() || $this->woo->meets_minimum() ) {
			return;
		}

		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: 1: detected WooCommerce version, 2: required minimum version. */
					__( 'webhead Search Cloud: WooCommerce %1$s is below the supported minimum %2$s. Product indexing is disabled until WooCommerce is updated; other content indexing still works.', 'webhead-search-cloud' ),
					'' !== $this->woo->version() ? $this->woo->version() : __( '(unknown)', 'webhead-search-cloud' ),
					Woo::MIN_VERSION
				)
			)
		);
	}
}
