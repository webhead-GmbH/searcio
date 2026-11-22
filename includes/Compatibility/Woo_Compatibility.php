<?php
/**
 * WooCommerce compatibility wiring.
 *
 * WooCommerce is a soft dependency. This hookable surfaces an admin notice
 * when WooCommerce is active but below the supported minimum, in which case
 * the product indexing section is disabled while WP-content indexing keeps
 * working. The features the plugin works with are declared by the framework
 * from {@see \Webhead\WP\SearchCloud\Plugin::get_woocommerce_feature_compatibility()}.
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
					__( 'Searcio: WooCommerce %1$s is below the supported minimum %2$s. Product indexing is disabled until WooCommerce is updated; other content indexing still works.', 'searcio' ),
					'' !== $this->woo->version() ? $this->woo->version() : __( '(unknown)', 'searcio' ),
					Woo::MIN_VERSION
				)
			)
		);
	}
}
