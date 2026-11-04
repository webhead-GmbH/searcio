<?php
/**
 * The products widget under its name before 1.4.0.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Elementor\Widgets;

use Webhead\WP\SearchCloud\Lifecycle\Legacy_Slug;

defined( 'ABSPATH' ) || exit;

/**
 * Elementor finds a widget on a page by the name it was saved with. A page
 * whose data {@see Legacy_Slug} did not reach (an import, a template kept
 * elsewhere) still names `products` by its old name, and draws it with this:
 * the same widget, left out of the panel.
 *
 * @since 1.4.0
 */
final class Legacy_Products_Widget extends Products_Widget {
	public function get_name(): string {
		return Legacy_Slug::OLD_SLUG . '-products';
	}

	public function show_in_panel(): bool {
		return false;
	}
}
