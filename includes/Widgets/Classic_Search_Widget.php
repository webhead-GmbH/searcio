<?php
/**
 * The classic widget "Searcio Search", for a theme that still has classic
 * widget areas, or a site that runs the Classic Widgets plugin. A block widget
 * area takes the Searcio Search block instead.
 *
 * It draws what `[searcio]` draws, with the attributes its form sets; a field
 * left empty takes the default set on the Placement tab.
 *
 * WordPress builds a widget itself, so it reaches the plugin's shortcodes
 * through the running instance.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Widgets;

use WP_Widget;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Shortcodes\Search_Shortcode;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Classic_Search_Widget extends WP_Widget {
	public const ID_BASE = 'webhead_search_cloud_search';

	private const MODES = [ 'icon', 'box' ];

	/**
	 * WordPress builds every widget on every page, where its name is never
	 * shown. It is named in English here and in the page's language by
	 * {@see Widget_Registrar::translate()} on the screens that list it, so a
	 * page without a search loads no translation.
	 */
	public function __construct() {
		parent::__construct(
			self::ID_BASE,
			'Searcio Search',
			[
				'classname'                   => 'widget_searcio_search',
				'description'                 => '',
				'customize_selective_refresh' => true,
				'show_instance_in_rest'       => true,
			]
		);
	}

	/**
	 * @return array{name:string,description:string}
	 */
	public static function labels(): array {
		return [
			'name'        => __( 'Searcio Search', 'searcio' ),
			'description' => __( 'The Searcio search: a magnifier or a search field.', 'searcio' ),
		];
	}

	/**
	 * @param  array<string,mixed>  $args
	 * @param  array<string,mixed>  $instance
	 */
	public function widget( $args, $instance ): void {
		$markup = Plugin::instance()?->get_container()->get( 'shortcode_manager' )->render(
			Search_Shortcode::TAG,
			array_filter(
				[
					'mode'        => (string) ( $instance['mode'] ?? '' ),
					'placeholder' => (string) ( $instance['placeholder'] ?? '' ),
				],
				static fn ( string $value ): bool => '' !== $value
			)
		);

		if ( ! is_string( $markup ) || '' === $markup ) {
			return;
		}

		$title = (string) apply_filters( 'widget_title', (string) ( $instance['title'] ?? '' ), $instance, $this->id_base );

		echo $args['before_widget'] ?? ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own markup.

		if ( '' !== $title ) {
			echo ( $args['before_title'] ?? '' ) . esc_html( $title ) . ( $args['after_title'] ?? '' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own markup around an escaped title.
		}

		echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by Trigger_Markup and Style_Tokens.
		echo $args['after_widget'] ?? ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own markup.
	}

	/**
	 * @param  array<string,mixed>  $instance
	 */
	public function form( $instance ): string {
		$title       = (string) ( $instance['title'] ?? '' );
		$mode        = (string) ( $instance['mode'] ?? '' );
		$placeholder = (string) ( $instance['placeholder'] ?? '' );
		?>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>"><?php esc_html_e( 'Title', 'searcio' ); ?></label>
			<input class="widefat" type="text" id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>" value="<?php echo esc_attr( $title ); ?>">
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'mode' ) ); ?>"><?php esc_html_e( 'Shown as', 'searcio' ); ?></label>
			<select class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'mode' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'mode' ) ); ?>">
				<option value="" <?php selected( $mode, '' ); ?>><?php esc_html_e( 'As set on the Placement tab', 'searcio' ); ?></option>
				<option value="box" <?php selected( $mode, 'box' ); ?>><?php esc_html_e( 'Search field', 'searcio' ); ?></option>
				<option value="icon" <?php selected( $mode, 'icon' ); ?>><?php esc_html_e( 'Magnifier', 'searcio' ); ?></option>
			</select>
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'placeholder' ) ); ?>"><?php esc_html_e( 'Placeholder', 'searcio' ); ?></label>
			<input class="widefat" type="text" id="<?php echo esc_attr( $this->get_field_id( 'placeholder' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'placeholder' ) ); ?>" value="<?php echo esc_attr( $placeholder ); ?>">
			<span class="description"><?php esc_html_e( 'Empty takes the placeholder set on the Placement tab, translated where the site translates it.', 'searcio' ); ?></span>
		</p>
		<?php

		return 'form';
	}

	/**
	 * @param  array<string,mixed>  $new_instance
	 * @param  array<string,mixed>  $old_instance
	 * @return array<string,string>
	 */
	public function update( $new_instance, $old_instance ): array {
		$mode = sanitize_key( (string) ( $new_instance['mode'] ?? '' ) );

		return [
			'title'       => sanitize_text_field( (string) ( $new_instance['title'] ?? '' ) ),
			'mode'        => in_array( $mode, self::MODES, true ) ? $mode : '',
			'placeholder' => sanitize_text_field( (string) ( $new_instance['placeholder'] ?? '' ) ),
		];
	}
}
