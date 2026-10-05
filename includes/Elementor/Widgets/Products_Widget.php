<?php
/**
 * Elementor widget: a row of products from Search Cloud.
 *
 * The Elementor twin of the `webhead-search-cloud/products` block. Both render
 * through {@see \Webhead\WP\SearchCloud\Frontend\Product_List_Markup}, so the
 * two embed points cannot drift apart.
 *
 * Placed on a product template it becomes a "you may also like" row; placed on
 * a category/archive template it becomes a curated listing that a merchandising
 * rule for that category can actually act on.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Elementor\Widgets;

use Elementor\Controls_Manager;
use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Product_List_Markup;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Elementor\Widget;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.1.0
 */
final class Products_Widget extends Widget {
	public function get_name(): string {
		return 'webhead-search-cloud-products';
	}

	public function get_title(): string {
		return __( 'Search Cloud Products', 'webhead-search-cloud' );
	}

	public function get_icon(): string {
		return 'eicon-products';
	}

	/**
	 * Naming the shared runtime is what makes the row hydrate inside the
	 * Elementor editor preview too, exactly as {@see Search_Widget} does.
	 *
	 * @return string[]
	 */
	protected function asset_entries(): array {
		return [ Frontend_Config::ENTRY ];
	}

	protected function register_controls(): void {
		$this->start_controls_section(
			'content',
			[ 'label' => __( 'Products', 'webhead-search-cloud' ) ]
		);

		$this->add_control(
			'source',
			[
				'label'   => __( 'Show', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'similar',
				'options' => [
					'similar'  => __( 'Similar products', 'webhead-search-cloud' ),
					'category' => __( 'Category listing', 'webhead-search-cloud' ),
				],
			]
		);

		$this->add_control(
			'heading',
			[
				'label'       => __( 'Heading', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'description' => __( 'Optional. Left empty, the row has no title.', 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'document_id',
			[
				'label'       => __( 'Product', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'description' => __( 'Leave empty to use whichever product the visitor is viewing.', 'webhead-search-cloud' ),
				'condition'   => [ 'source' => 'similar' ],
			]
		);

		$this->add_control(
			'filter_field',
			[
				'label'       => __( 'Filter field', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'placeholder' => 'categories',
				'description' => __( 'A facet field. Defaults to "categories", which is how product categories are indexed.', 'webhead-search-cloud' ),
				'condition'   => [ 'source' => 'category' ],
			]
		);

		$this->add_control(
			'filter_value',
			[
				'label'       => __( 'Filter value', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'description' => __( 'Leave empty to use whichever category the visitor is browsing.', 'webhead-search-cloud' ),
				'condition'   => [ 'source' => 'category' ],
			]
		);

		$this->add_control(
			'show_banner',
			[
				'label'     => __( 'Show the merchandising banner', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'condition' => [ 'source' => 'category' ],
			]
		);

		$this->add_control(
			'layout',
			[
				'label'   => __( 'Layout', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'carousel',
				'options' => [
					'carousel' => __( 'Carousel', 'webhead-search-cloud' ),
					'grid'     => __( 'Grid', 'webhead-search-cloud' ),
				],
			]
		);

		$this->add_control(
			'limit',
			[
				'label'   => __( 'How many products', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::NUMBER,
				'min'     => 1,
				// `/search/similar` validates limit at 1-20; a category row is a
				// `/search`, which allows far more.
				'max'     => 24,
				'default' => 6,
			]
		);

		$this->add_control(
			'card_source',
			[
				'label'   => __( 'Card source', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'plugin',
				'options' => [
					'plugin' => __( 'Plugin templates', 'webhead-search-cloud' ),
					'server' => __( 'Search Cloud templates', 'webhead-search-cloud' ),
				],
			]
		);

		$this->end_controls_section();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();

		$markup = Product_List_Markup::render(
			[
				'source'        => (string) ( $settings['source'] ?? 'similar' ),
				'documentId'    => (string) ( $settings['document_id'] ?? '' ),
				'filterField'   => (string) ( $settings['filter_field'] ?? '' ),
				'filterValue'   => (string) ( $settings['filter_value'] ?? '' ),
				'heading'       => (string) ( $settings['heading'] ?? '' ),
				'limit'         => $settings['limit'] ?? null,
				'layout'        => (string) ( $settings['layout'] ?? 'carousel' ),
				'showBanner'    => 'yes' === ( $settings['show_banner'] ?? 'yes' ),
				'cardSource'    => (string) ( $settings['card_source'] ?? 'plugin' ),
				'instanceClass' => 'whsc-instance-' . $this->get_id(),
			]
		);

		// Echoed as built, not through kses: kses strips the `data-*` attributes
		// the front-end hydrates from. Every part is escaped inside
		// Product_List_Markup::render().
		echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- markup is escaped inside Product_List_Markup::render().
	}
}
