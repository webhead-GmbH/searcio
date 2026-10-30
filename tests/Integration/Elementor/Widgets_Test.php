<?php
/**
 * Elementor widget integration tests.
 *
 * Covers the plugin's Elementor integration point: the two widgets it names
 * to the framework's Elementor manager in `Plugin::register_elementor()`, and
 * the {@see \Webhead\WP\SearchCloud\Elementor\Widgets\Search_Widget} contract
 * (name, category, keywords, and the shared runtime bundle it depends on). The
 * widget's rendered markup is the same `Trigger_Markup` output already covered
 * by the unit suite and the block render test, so it is not re-asserted here.
 *
 * The class skips when Elementor is not loaded into the test environment (see
 * `tests/Integration/bootstrap.php`).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Elementor;

use Webhead\WP\SearchCloud\Elementor\Widgets\Products_Widget;
use Webhead\WP\SearchCloud\Elementor\Widgets\Search_Widget;
use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Widgets_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		if ( ! did_action( 'elementor/loaded' ) || ! class_exists( '\Elementor\Widget_Base' ) ) {
			$this->markTestSkipped( 'Elementor is not loaded in this environment.' );
		}
	}

	public function test_both_widgets_are_named_to_the_framework_manager(): void {
		$this->assertSame(
			[ Search_Widget::class, Products_Widget::class ],
			array_values( $this->plugin()->get_elementor_manager()->widgets() )
		);
	}

	/**
	 * Named is not registered: Elementor has to end up holding both, under the
	 * names saved pages refer to them by.
	 */
	public function test_elementor_holds_both_widgets_under_their_saved_names(): void {
		$widgets = \Elementor\Plugin::$instance->widgets_manager;

		$this->assertInstanceOf( Search_Widget::class, $widgets->get_widget_types( 'webhead-search-cloud-search' ) );
		$this->assertInstanceOf( Products_Widget::class, $widgets->get_widget_types( 'webhead-search-cloud-products' ) );
	}

	/**
	 * Both widgets name the shared runtime bundle, which is what makes them
	 * hydrate inside the Elementor editor preview rather than only on the front
	 * end. The handles come from the plugin's asset registry, and exist once
	 * the bundle has been built.
	 */
	public function test_both_widgets_declare_the_shared_runtime(): void {
		$assets = $this->plugin()->get_assets();

		if ( ! $assets->exists( Frontend_Config::ENTRY ) ) {
			$this->markTestSkipped( 'The storefront bundle is not built; run `npm run build`.' );
		}

		$handle = $assets->handle( Frontend_Config::ENTRY );

		foreach ( [ new Search_Widget(), new Products_Widget() ] as $widget ) {
			$this->assertSame( [ $handle ], $widget->get_script_depends() );
			$this->assertNotSame( [], $widget->get_style_depends() );

			foreach ( $widget->get_style_depends() as $style ) {
				$this->assertTrue( wp_style_is( $style, 'registered' ), $style );
			}
		}
	}

	public function test_products_widget_identity(): void {
		$widget = new Products_Widget();

		$this->assertSame( 'webhead-search-cloud-products', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
	}

	/**
	 * The row is printed as `Product_List_Markup::render()` builds it: kses
	 * would strip the `data-*` attributes the front end hydrates from, so the
	 * values arrive escaped by the markup class and nothing else.
	 */
	public function test_products_widget_prints_the_row_with_its_settings(): void {
		$widget = new Products_Widget(
			[
				'id'         => 'e4f5a6b',
				'elType'     => 'widget',
				'widgetType' => 'webhead-search-cloud-products',
				'settings'   => [
					'source'       => 'category',
					'filter_field' => 'categories',
					'filter_value' => 'Shoes & Boots',
					'heading'      => '<b>More</b>',
				],
			],
			[]
		);

		ob_start();
		$widget->render_content();
		$html = (string) ob_get_clean();

		$row = new \WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $row->next_tag( [ 'class_name' => 'whsc-instance-e4f5a6b' ] ) );
		$this->assertNotNull( $row->get_attribute( 'data-whsc-list' ) );
		$this->assertSame( 'category', $row->get_attribute( 'data-source' ) );
		$this->assertSame( 'categories', $row->get_attribute( 'data-filter-field' ) );
		$this->assertSame( 'Shoes & Boots', $row->get_attribute( 'data-filter-value' ) );
		$this->assertSame( '<b>More</b>', $row->get_attribute( 'data-heading' ) );
		$this->assertStringNotContainsString( '<b>', $html );
	}

	public function test_widget_identity(): void {
		$widget = new Search_Widget();

		$this->assertSame( 'webhead-search-cloud-search', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
		// Listed under the plugin's own category in the panel.
		$this->assertSame( [ $this->plugin()->get_elementor_manager()->category_slug() ], $widget->get_categories() );
		$this->assertContains( 'search', $widget->get_keywords() );
	}

	/**
	 * The stock colours are custom properties on the placement's instance
	 * class: the modal is portalled out of `{{WRAPPER}}`, and the card rule
	 * outranks any selector that sets `color` directly.
	 */
	public function test_card_section_exposes_the_stock_colours_on_the_instance_class(): void {
		$widget = new Search_Widget();

		foreach ( [ 'card_stock_in_color' => '--whsc-stock-in-color', 'card_stock_out_color' => '--whsc-stock-out-color' ] as $id => $var ) {
			$control = $widget->get_controls( $id );

			$this->assertIsArray( $control, $id );
			$this->assertSame( 'color', $control['type'] );
			$this->assertSame( 'style_cards', $control['section'] );
			$this->assertSame( [ '.whsc-instance-{{ID}}' => $var . ': {{VALUE}};' ], $control['selectors'] );
		}
	}

	/**
	 * Elementor stores a widget's values under its control ids, so regrouping
	 * the controls into new sections must not rename or drop any of them: a
	 * saved widget would silently lose that setting. These are every id the
	 * widget had before the regrouping.
	 */
	public function test_every_control_id_from_before_the_regrouping_survives(): void {
		$ids = $this->control_ids();

		foreach ( [
			'arrow_bg', 'arrow_color', 'assistant_accent', 'assistant_input_radius', 'assistant_row_bg', 'assistant_text',
			'assistant_user_bg', 'assistant_user_text', 'banner_bg', 'banner_note', 'banner_text', 'card_bg', 'card_border',
			'card_border_hover', 'card_padding', 'card_price_color', 'card_price_suffix_typography_typography',
			'card_price_typography_typography', 'card_radius', 'card_source', 'card_stock_in_color', 'card_stock_out_color',
			'card_title_color', 'card_title_typography_typography', 'carousel_gap', 'chip_bg', 'chip_bg_hover', 'chip_border',
			'chip_border_hover', 'chip_radius', 'chip_text', 'chip_text_hover', 'clear_bg_hover', 'clear_padding', 'clear_text',
			'clear_text_active', 'clear_text_hover', 'clearbtn_bg', 'clearbtn_bg_hover', 'clearbtn_color', 'clearbtn_color_hover',
			'clearbtn_padding', 'clearbtn_radius', 'close_bg', 'close_bg_hover', 'close_color', 'close_color_hover', 'close_padding',
			'close_radius', 'dot_color', 'dot_color_active', 'enable_voice', 'facet_bg', 'facet_bg_active', 'facet_bg_hover',
			'facet_count_color', 'facet_count_typography_typography', 'facet_radius', 'facet_text', 'facet_text_active',
			'facet_text_hover', 'facet_typography_typography', 'facets_max_height', 'field_bg', 'field_border', 'field_border_focus',
			'field_icon', 'field_placeholder', 'field_radius', 'field_text', 'field_typography_typography', 'highlights_source',
			'modal_accent', 'modal_animation', 'modal_animation_duration', 'modal_bg', 'modal_gap', 'modal_padding', 'modal_radius',
			'modal_text', 'mode', 'placeholder', 'popular_bg_hover', 'popular_gap', 'popular_padding', 'popular_radius',
			'popular_text', 'popular_text_hover', 'popular_typography_typography', 'quiz_option_bg', 'quiz_option_bg_hover',
			'quiz_option_border', 'quiz_option_border_hover', 'quiz_option_radius', 'quiz_option_text', 'quiz_option_text_hover',
			'quiz_question', 'scope_type', 'search_trigger', 'show_count', 'submit_bg', 'submit_bg_hover', 'submit_radius',
			'submit_text', 'submit_text_hover', 'suggest_bg_hover', 'suggest_panel_bg', 'suggest_panel_border',
			'suggest_panel_radius', 'suggest_text', 'suggest_text_hover', 'tab_border', 'tab_indicator', 'tab_text',
			'tab_text_active', 'title_color', 'title_typography_typography', 'trigger_box_bg', 'trigger_box_border_border',
			'trigger_box_icon_color', 'trigger_box_radius', 'trigger_box_size', 'trigger_box_text',
			'trigger_box_typography_typography', 'trigger_icon', 'trigger_icon_bg', 'trigger_icon_bg_hover', 'trigger_icon_color',
			'trigger_icon_color_hover', 'trigger_icon_size', 'trigger_radius', 'visual_bg', 'visual_bg_hover', 'visual_color',
			'visual_color_hover', 'visual_padding', 'visual_radius', 'voice_bg', 'voice_bg_hover', 'voice_color',
			'voice_color_hover', 'voice_icon', 'voice_padding', 'voice_radius',
		] as $id ) {
			$this->assertArrayHasKey( $id, $ids, $id );
		}
	}

	/**
	 * A control belongs with the part it styles: the mode tabs sit above
	 * every mode, and the section title style is used by every heading in the
	 * modal, not only by recent and popular searches.
	 */
	public function test_controls_sit_in_the_section_of_the_part_they_style(): void {
		$ids = $this->control_ids();

		foreach ( [ 'tab_text', 'tab_text_active', 'tab_indicator', 'tab_border', 'tab_typography_typography' ] as $id ) {
			$this->assertSame( 'style_mode_tabs', $ids[ $id ]['section'], $id );
		}

		foreach ( [ 'title_color', 'title_typography_typography', 'modal_overlay', 'modal_font_family', 'modal_content_width' ] as $id ) {
			$this->assertSame( 'style_modal', $ids[ $id ]['section'], $id );
		}

		foreach ( [ 'editor_preview', 'editor_preview_query', 'modal_animation' ] as $id ) {
			$this->assertSame( 'webhead_search_cloud_modal', $ids[ $id ]['section'], $id );
		}
	}

	/**
	 * Each new style setting writes a custom property the stylesheet reads with
	 * today's value as its fallback, on the instance class - which reaches both
	 * the trigger and the portalled modal and its overlay.
	 */
	public function test_new_style_controls_write_their_custom_properties(): void {
		$ids = $this->control_ids();

		foreach ( [
			'modal_overlay'        => '--whsc-overlay-bg: {{VALUE}};',
			'modal_font_family'    => '--whsc-font-family: "{{VALUE}}";',
			'modal_content_width'  => '--whsc-content-width: {{SIZE}}{{UNIT}};',
			'card_image_ratio'     => '--whsc-card-image-ratio: {{VALUE}};',
			'card_image_fit'       => '--whsc-card-image-fit: {{VALUE}};',
			'card_image_bg'        => '--whsc-card-image-bg: {{VALUE}};',
			'card_badge_bg'        => '--whsc-badge-bg: {{VALUE}};',
			'carousel_card_width'  => '--whsc-card-width: {{SIZE}}{{UNIT}};',
			'arrow_radius'         => '--whsc-arrow-radius: {{SIZE}}{{UNIT}};',
			'arrow_shadow'         => '--whsc-arrow-shadow: {{VALUE}};',
			'modal_width'          => '--whsc-modal-width: {{SIZE}}{{UNIT}};',
			'modal_offset'         => '--whsc-modal-offset: {{SIZE}}{{UNIT}};',
			'modal_round_top'      => '--whsc-radius-panel-top: var(--whsc-radius-panel);',
			'card_title_lines'     => '--whsc-card-title-lines: {{VALUE}};',
			'card_stock_display'   => '--whsc-card-stock-display: {{VALUE}};',
		] as $id => $declaration ) {
			$this->assertSame( [ '.whsc-instance-{{ID}}' => $declaration ], $ids[ $id ]['selectors'], $id );
		}

		// A colour chosen for the filter group names is used as chosen, not at
		// the 70% opacity the borrowed title colour gets.
		$this->assertSame(
			[ '.whsc-instance-{{ID}}' => '--whsc-facet-group-label: {{VALUE}}; --whsc-facet-group-label-opacity: 1;' ],
			$ids['facet_group_color']['selectors']
		);

		// Set per device. Depending on its breakpoint settings Elementor either
		// duplicates a responsive control per device or flags the one control.
		foreach ( [ 'carousel_card_width', 'modal_content_width', 'modal_width', 'modal_offset', 'trigger_box_width', 'trigger_align', 'filter_height' ] as $id ) {
			$this->assertTrue( ! empty( $ids[ $id ]['is_responsive'] ) || isset( $ids[ $id . '_mobile' ] ), $id );
		}
	}

	/**
	 * The filter bar's own properties: the height of its buttons, the count on
	 * "All filters", the popover, the drawer and the phone's sheet. They sit
	 * with the other filter controls, and every one falls back in the
	 * stylesheet to the look a site already set for the old filter chips.
	 */
	public function test_the_filter_bar_controls_write_their_custom_properties(): void {
		$ids = $this->control_ids();

		foreach ( [
			'filter_height'     => '--whsc-filter-height: {{SIZE}}{{UNIT}};',
			'filter_badge_bg'   => '--whsc-filter-badge-bg: {{VALUE}};',
			'filter_badge_text' => '--whsc-filter-badge-text: {{VALUE}};',
			'popover_width'     => '--whsc-popover-width: {{SIZE}}{{UNIT}};',
			'popover_radius'    => '--whsc-popover-radius: {{SIZE}}{{UNIT}};',
			'drawer_width'      => '--whsc-drawer-width: {{SIZE}}{{UNIT}};',
			'sheet_radius'      => '--whsc-sheet-radius: {{SIZE}}{{UNIT}};',
		] as $id => $declaration ) {
			$this->assertSame( [ '.whsc-instance-{{ID}}' => $declaration ], $ids[ $id ]['selectors'], $id );
			$this->assertSame( 'style_facets', $ids[ $id ]['section'], $id );
		}
	}

	public function test_the_number_of_filter_buttons_reaches_the_trigger(): void {
		$ids = $this->control_ids();

		$this->assertSame( 5, $ids['facet_bar_limit']['default'] );
		$this->assertSame( 0, $ids['facet_bar_limit']['min'] );
		$this->assertSame( 8, $ids['facet_bar_limit']['max'] );

		$widget = new Search_Widget(
			[
				'id'         => 'f1l7e2s',
				'elType'     => 'widget',
				'widgetType' => 'webhead-search-cloud-search',
				'settings'   => [ 'facet_bar_limit' => 3 ],
			],
			[]
		);

		$this->assertStringContainsString( 'data-facet-bar-limit="3"', $this->render_widget( $widget ) );
	}

	/**
	 * "Keep open while editing" is saved with the widget, so the server - not
	 * the saved value - decides it only ever reaches the editor. A visitor's
	 * page never opens the modal by itself.
	 */
	public function test_the_modal_only_opens_by_itself_in_the_editor(): void {
		$widget = new Search_Widget(
			[
				'id'         => 'a1b2c3d',
				'elType'     => 'widget',
				'widgetType' => 'webhead-search-cloud-search',
				'settings'   => [ 'editor_preview' => 'yes', 'editor_preview_query' => 'shirt' ],
			],
			[]
		);

		$this->assertStringNotContainsString( 'data-editor-preview', $this->render_widget( $widget ) );

		$editor = \Elementor\Plugin::$instance->editor;
		$editor->set_edit_mode( true );

		try {
			$html = $this->render_widget( $widget );
		} finally {
			$editor->set_edit_mode( null );
		}

		$this->assertStringContainsString( 'data-editor-preview="1" data-editor-query="shirt"', $html );
	}

	/**
	 * A control writing a literal property (typography, border) rather than a
	 * `--whsc-*` custom property competes with `style.scss` on specificity,
	 * and loses to it unless boosted. Checked per comma-separated part, since
	 * the boost only counts on the part it is attached to.
	 */
	public function test_every_literal_style_selector_is_boosted(): void {
		$boost = ':not(#whsc#whsc#whsc#whsc)';
		// Without Elementor's own Advanced-tab controls, which are not ours.
		$stack = ( new Search_Widget() )->get_stack( false );
		// Outside the editor Elementor files style controls separately, and
		// `get_controls()` leaves them out.
		$controls = array_merge( $stack['controls'], $stack['style_controls'] ?? [] );
		$literal  = [];

		foreach ( $controls as $control ) {
			foreach ( $control['selectors'] ?? [] as $selector => $declaration ) {
				if ( ! str_starts_with( trim( (string) $declaration ), '--' ) ) {
					$literal[ $selector ] = true;
				}
			}
		}

		$this->assertContains( '.whsc-instance-{{ID}} .whsc-card__title' . $boost, array_keys( $literal ) );

		foreach ( array_keys( $literal ) as $selector ) {
			foreach ( explode( ',', $selector ) as $part ) {
				$this->assertStringEndsWith( $boost, trim( $part ), $selector );
			}
		}
	}

	public function test_the_border_of_the_box_field_is_written_on_the_line_that_is_drawn(): void {
		$stack    = ( new Search_Widget() )->get_stack( false );
		$controls = array_merge( $stack['controls'] ?? [], $stack['style_controls'] ?? [] );

		$this->assertArrayHasKey( 'trigger_box_border_border', $controls );
		$this->assertStringContainsString(
			'.components-input-control__backdrop',
			(string) wp_json_encode( $controls['trigger_box_border_border']['selectors'] ?? [] )
		);
	}

	/**
	 * Every control, style ones included: outside the editor Elementor files
	 * style controls separately and `get_controls()` leaves them out.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	private function control_ids(): array {
		$stack = ( new Search_Widget() )->get_stack( false );

		return array_merge( $stack['controls'], $stack['style_controls'] ?? [] );
	}

	private function render_widget( Search_Widget $widget ): string {
		ob_start();
		$widget->render_content();

		return (string) ob_get_clean();
	}
}
