<?php
/**
 * Registers the classic widgets. A site with block widget areas lists them
 * too, under the Legacy Widget block, beside the Searcio blocks it should use
 * there instead. Elementor lists every classic widget in its panel as well,
 * where they stood beside the two Searcio widgets of the same name, so they
 * are kept out of it.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Widgets;

use WP_Widget;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Widget_Registrar {
	/** @var array<int,class-string<Classic_Search_Widget|Classic_Products_Widget>> */
	private const WIDGETS = [ Classic_Search_Widget::class, Classic_Products_Widget::class ];

	#[Action( 'widgets_init' )]
	public function register(): void {
		foreach ( self::WIDGETS as $widget ) {
			register_widget( $widget );
		}
	}

	/**
	 * Elementor's own Searcio widgets do everything the classic ones do, and
	 * with its controls; two "Searcio Search" in its panel left the choice to
	 * a guess.
	 *
	 * @param  mixed  $black_list  The classic widgets Elementor leaves out.
	 * @return array<int,mixed>
	 */
	#[Filter( 'elementor/widgets/black_list' )]
	public function keep_out_of_elementor( mixed $black_list ): array {
		return array_values( array_unique( [ ...( is_array( $black_list ) ? $black_list : [] ), ...self::WIDGETS ] ) );
	}

	/**
	 * Names the widgets in the language of the screen that lists them:
	 * Appearance > Widgets and the Customizer run `admin_init`, and the block
	 * widget editor reads the widget types over REST. Both come after
	 * `widgets_init`, where the widgets were built with their English names.
	 */
	#[Action( 'admin_init' )]
	#[Action( 'rest_api_init' )]
	public function translate(): void {
		global $wp_widget_factory;

		foreach ( self::WIDGETS as $class ) {
			$widget = $wp_widget_factory->widgets[ $class ] ?? null;

			if ( ! $widget instanceof WP_Widget ) {
				continue;
			}

			$labels = $class::labels();

			$widget->name                          = $labels['name'];
			$widget->widget_options['description'] = $labels['description'];
		}
	}
}
