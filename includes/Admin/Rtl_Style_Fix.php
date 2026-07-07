<?php
/**
 * RTL stylesheet fix for the React admin bundle.
 *
 * The framework's `Page` asset loader (`includes/Dependencies/.../Admin/Page.php`)
 * always enqueues the plain `{entry}.css` build output with no `is_rtl()`
 * awareness, so it never picks up the `-rtl.css` files webpack's RTL plugin
 * builds alongside them. Rather than hand-patch the vendored framework file
 * (overwritten on the next `scaffold:update`), this hooks in after the page
 * enqueues its styles and asks WordPress core's `rtl: replace` mechanism to
 * swap in the sibling `-rtl.css` file when the locale is right-to-left.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Admin;

use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Rtl_Style_Fix {
	/** Substring shared by every style handle the settings page enqueues. */
	private const ASSET_KEY = 'bundle.settings';

	/** Priority 20 so this runs after `Page_Registry::enqueue_scripts()` (priority 10) registers the stylesheet handles. */
	#[Action( 'admin_enqueue_scripts', priority: 20 )]
	public function mark_settings_stylesheets_rtl_aware(): void {
		if ( ! is_rtl() || ! function_exists( 'wp_styles' ) ) {
			return;
		}

		foreach ( wp_styles()->registered as $handle => $style ) {
			if ( is_string( $style->src ) && str_contains( $style->src, self::ASSET_KEY ) ) {
				wp_style_add_data( $handle, 'rtl', 'replace' );
			}
		}
	}
}
