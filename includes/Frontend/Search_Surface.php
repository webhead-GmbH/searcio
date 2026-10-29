<?php
/**
 * Draws a search or a product row that is placed without a block or an
 * Elementor widget: by a shortcode, a classic widget, a search form Searcio
 * takes over, or at the end of a page for the site-wide ways to open it.
 *
 * Each method enqueues the storefront entry as it draws, which also works
 * after `wp_head`: the script is printed in the footer, and a stylesheet asked
 * for in the body is printed there too.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\DTO\Floating_Button;
use Webhead\WP\SearchCloud\DTO\Products_Placement;
use Webhead\WP\SearchCloud\DTO\Search_Placement;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Assets\Asset_Registry;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Search_Surface {
	/**
	 * The instance classes whose `<style>` this request has printed. Two
	 * placements that look the same share a class, and its rule is printed
	 * once.
	 *
	 * @var array<string,true>
	 */
	private array $styled = [];

	public function __construct( private Asset_Registry $assets ) {}

	/**
	 * A search trigger in a wrapper that aligns it, with its style.
	 *
	 * @param  array<string,mixed>  $extra     More of what {@see Trigger_Markup::render()} reads,
	 *                                         `className` added to the trigger's own classes.
	 * @param  string               $fallback  Markup shown until the search is ready, and for good
	 *                                         without JavaScript: the form Searcio takes the place of.
	 *                                         The storefront removes it once the trigger is drawn.
	 */
	public function search( Search_Placement $placement, array $extra = [], string $fallback = '' ): string {
		$this->assets->enqueue( Frontend_Config::ENTRY );

		$attributes = $placement->to_block_attributes();

		if ( 'box' === $placement->mode && $placement->width > 0 ) {
			$attributes['triggerBoxWidth'] = $placement->width;
		}

		[ $instance_class, $style ] = $this->instance( $attributes );

		// A box fills its wrapper, or the width it was given.
		$class_name = trim(
			( 'box' === $placement->mode ? 'whsc-trigger--box ' : '' )
			. ( is_string( $extra['className'] ?? null ) ? $extra['className'] : '' )
		);

		return sprintf(
			'<div class="%1$s">%2$s%3$s%4$s</div>',
			esc_attr( 'webhead-search-cloud-placement webhead-search-cloud-placement--' . $placement->align ),
			$style,
			Trigger_Markup::render(
				array_merge(
					$attributes,
					$extra,
					[
						'instanceClass' => $instance_class,
						'className'     => $class_name,
					]
				)
			),
			'' !== $fallback ? '<div class="webhead-search-cloud-fallback">' . $fallback . '</div>' : ''
		);
	}

	/**
	 * The trigger the site-wide ways open: the floating button when it is on,
	 * otherwise one that draws nothing. Printed once, at the end of a page that
	 * loads the search.
	 */
	public function site( Search_Placement $placement, Floating_Button $floating ): string {
		$this->assets->enqueue( Frontend_Config::ENTRY );

		$attributes = $placement->to_block_attributes();
		$class_name = '';

		if ( $floating->enabled ) {
			$attributes['floatingOffset'] = $floating->offset;
			$class_name                   = implode(
				' ',
				[
					'whsc-trigger--floating',
					'whsc-floating--' . $floating->position->value,
					'whsc-floating--' . $floating->devices->value,
				]
			);
		}

		[ $instance_class, $style ] = $this->instance( $attributes );

		return $style . Trigger_Markup::render(
			array_merge(
				$attributes,
				[
					'site'          => $floating->enabled ? 'floating' : 'hidden',
					'floatingStyle' => $floating->style->value,
					'instanceClass' => $instance_class,
					'className'     => $class_name,
				]
			)
		);
	}

	/**
	 * A product row, or nothing on a page that has no product or category for
	 * it; the entry is only enqueued when there is a row.
	 *
	 * @param  array{documentId?:string,filterField?:string,filterValue?:string,className?:string}  $subject
	 */
	public function products( Products_Placement $placement, array $subject = [] ): string {
		$markup = Product_List_Markup::render( array_merge( $placement->to_markup_attributes(), $subject ) );

		if ( '' === $markup ) {
			return '';
		}

		$this->assets->enqueue( Frontend_Config::ENTRY );

		return '<div class="webhead-search-cloud-products-placement">' . $markup . '</div>';
	}

	/**
	 * The class a placement's style is set on, named after the style itself,
	 * and its `<style>` the first time this request draws it.
	 *
	 * @param  array<string,mixed>  $attributes
	 * @return array{0:string,1:string}
	 */
	private function instance( array $attributes ): array {
		$declarations = Style_Tokens::declarations( $attributes );

		if ( '' === $declarations ) {
			return [ '', '' ];
		}

		$instance_class = 'whsc-instance-p' . substr( md5( $declarations ), 0, 8 );

		if ( isset( $this->styled[ $instance_class ] ) ) {
			return [ $instance_class, '' ];
		}

		$this->styled[ $instance_class ] = true;

		return [ $instance_class, Style_Tokens::style_element( $instance_class, $attributes ) ];
	}
}
