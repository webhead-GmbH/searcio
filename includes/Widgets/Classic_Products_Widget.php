<?php
/**
 * The classic widget "Searcio Products": a row of products from Searcio in a
 * classic widget area, as `[searcio_products]` draws it. A field left empty
 * takes the default set on the Placement tab. On a page without a product or
 * a category to work from, it prints nothing, its title included.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Widgets;

use WP_Widget;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Shortcodes\Products_Shortcode;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Classic_Products_Widget extends WP_Widget {
	public const ID_BASE = 'webhead_search_cloud_products';

	private const SOURCES = [ 'similar', 'category' ];

	private const LAYOUTS = [ 'carousel', 'grid' ];

	/**
	 * WordPress builds every widget on every page, where its name is never
	 * shown. It is named in English here and in the page's language by
	 * {@see Widget_Registrar::translate()} on the screens that list it, so a
	 * page without a search loads no translation.
	 */
	public function __construct() {
		parent::__construct(
			self::ID_BASE,
			'Searcio Products',
			[
				'classname'                   => 'widget_searcio_products',
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
			'name'        => __( 'Searcio Products', 'searcio' ),
			'description' => __( 'A row of products from Searcio: similar products, or a category listing.', 'searcio' ),
		];
	}

	/**
	 * @param  array<string,mixed>  $args
	 * @param  array<string,mixed>  $instance
	 */
	public function widget( $args, $instance ): void {
		$markup = Plugin::instance()?->get_container()->get( 'shortcode_manager' )->render(
			Products_Shortcode::TAG,
			array_filter(
				[
					'source'  => (string) ( $instance['source'] ?? '' ),
					'layout'  => (string) ( $instance['layout'] ?? '' ),
					'limit'   => (string) ( $instance['limit'] ?? '' ),
					'heading' => (string) ( $instance['heading'] ?? '' ),
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

		echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by Product_List_Markup.
		echo $args['after_widget'] ?? ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own markup.
	}

	/**
	 * @param  array<string,mixed>  $instance
	 */
	public function form( $instance ): string {
		$title   = (string) ( $instance['title'] ?? '' );
		$source  = (string) ( $instance['source'] ?? '' );
		$layout  = (string) ( $instance['layout'] ?? '' );
		$limit   = (string) ( $instance['limit'] ?? '' );
		$heading = (string) ( $instance['heading'] ?? '' );
		?>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>"><?php esc_html_e( 'Title', 'searcio' ); ?></label>
			<input class="widefat" type="text" id="<?php echo esc_attr( $this->get_field_id( 'title' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'title' ) ); ?>" value="<?php echo esc_attr( $title ); ?>">
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'source' ) ); ?>"><?php esc_html_e( 'Products', 'searcio' ); ?></label>
			<select class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'source' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'source' ) ); ?>">
				<option value="" <?php selected( $source, '' ); ?>><?php esc_html_e( 'As set on the Placement tab', 'searcio' ); ?></option>
				<option value="similar" <?php selected( $source, 'similar' ); ?>><?php esc_html_e( 'Similar to the product on the page', 'searcio' ); ?></option>
				<option value="category" <?php selected( $source, 'category' ); ?>><?php esc_html_e( 'The category on the page', 'searcio' ); ?></option>
			</select>
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'layout' ) ); ?>"><?php esc_html_e( 'Layout', 'searcio' ); ?></label>
			<select class="widefat" id="<?php echo esc_attr( $this->get_field_id( 'layout' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'layout' ) ); ?>">
				<option value="" <?php selected( $layout, '' ); ?>><?php esc_html_e( 'As set on the Placement tab', 'searcio' ); ?></option>
				<option value="carousel" <?php selected( $layout, 'carousel' ); ?>><?php esc_html_e( 'Carousel', 'searcio' ); ?></option>
				<option value="grid" <?php selected( $layout, 'grid' ); ?>><?php esc_html_e( 'Grid', 'searcio' ); ?></option>
			</select>
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'limit' ) ); ?>"><?php esc_html_e( 'Number of products', 'searcio' ); ?></label>
			<input class="tiny-text" type="number" min="1" max="24" step="1" id="<?php echo esc_attr( $this->get_field_id( 'limit' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'limit' ) ); ?>" value="<?php echo esc_attr( $limit ); ?>">
		</p>
		<p>
			<label for="<?php echo esc_attr( $this->get_field_id( 'heading' ) ); ?>"><?php esc_html_e( 'Heading', 'searcio' ); ?></label>
			<input class="widefat" type="text" id="<?php echo esc_attr( $this->get_field_id( 'heading' ) ); ?>" name="<?php echo esc_attr( $this->get_field_name( 'heading' ) ); ?>" value="<?php echo esc_attr( $heading ); ?>">
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
		$source = sanitize_key( (string) ( $new_instance['source'] ?? '' ) );
		$layout = sanitize_key( (string) ( $new_instance['layout'] ?? '' ) );
		$limit  = absint( $new_instance['limit'] ?? 0 );

		return [
			'title'   => sanitize_text_field( (string) ( $new_instance['title'] ?? '' ) ),
			'source'  => in_array( $source, self::SOURCES, true ) ? $source : '',
			'layout'  => in_array( $layout, self::LAYOUTS, true ) ? $layout : '',
			'limit'   => $limit > 0 ? (string) min( 24, $limit ) : '',
			'heading' => sanitize_text_field( (string) ( $new_instance['heading'] ?? '' ) ),
		];
	}
}
