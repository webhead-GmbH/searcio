<?php
/**
 * Elementor widget registrar.
 *
 * Registers the search widget only when Elementor is actually loaded. The
 * widget class itself ({@see \Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget})
 * extends `\Elementor\Widget_Base`, so it must never be referenced outside this
 * guarded callback — PSR-4 autoloading only resolves the file (and therefore
 * the `\Elementor\Widget_Base` parent class) the first time it is used, which
 * only happens here.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Elementor_Widget {
	#[Action( 'elementor/widgets/register' )]
	public function register( $widgets_manager ): void {
		if ( ! did_action( 'elementor/loaded' ) || ! is_object( $widgets_manager ) || ! method_exists( $widgets_manager, 'register' ) ) {
			return;
		}

		$widgets_manager->register( new Search_Widget() );
	}
}
