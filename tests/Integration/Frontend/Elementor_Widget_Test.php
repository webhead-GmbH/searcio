<?php
/**
 * Elementor widget integration tests.
 *
 * Covers the plugin's Elementor integration point: the guarded
 * {@see \Webhead\WP\SearchCloud\Frontend\Elementor_Widget} registrar and the
 * {@see \Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget} contract
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

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use Webhead\WP\SearchCloud\Frontend\Elementor\Search_Widget;
use Webhead\WP\SearchCloud\Frontend\Elementor_Widget;
use Webhead\WP\SearchCloud\Frontend\Elementor\Products_Widget;
use Webhead\WP\SearchCloud\Frontend\Frontend_Assets;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Elementor_Widget_Test extends Integration_Test_Case {
	public function set_up(): void {
		parent::set_up();

		if ( ! did_action( 'elementor/loaded' ) || ! class_exists( '\Elementor\Widget_Base' ) ) {
			$this->markTestSkipped( 'Elementor is not loaded in this environment.' );
		}
	}

	public function test_registrar_registers_both_widgets(): void {
		$manager = $this->fake_widgets_manager();

		( new Elementor_Widget() )->register( $manager );

		$this->assertCount( 2, $manager->registered );
		$this->assertInstanceOf( Search_Widget::class, $manager->registered[0] );
		$this->assertInstanceOf( Products_Widget::class, $manager->registered[1] );
	}

	/**
	 * Both widgets declare the shared runtime bundle, which is what makes them
	 * hydrate inside the Elementor editor preview rather than only on the front
	 * end.
	 */
	public function test_both_widgets_declare_the_shared_runtime(): void {
		foreach ( [ new Search_Widget(), new Products_Widget() ] as $widget ) {
			$this->assertContains( Frontend_Assets::HANDLE, $widget->get_script_depends() );
			$this->assertContains( Frontend_Assets::HANDLE, $widget->get_style_depends() );
		}
	}

	public function test_products_widget_identity(): void {
		$widget = new Products_Widget();

		$this->assertSame( 'webhead-search-cloud-products', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
	}

	public function test_registrar_is_a_no_op_for_an_object_without_a_register_method(): void {
		$manager = new class() {
			/** @var array<int,mixed> */
			public array $registered = [];
		};

		// Must not fatal even though `$manager` has no register() method.
		( new Elementor_Widget() )->register( $manager );

		$this->assertSame( [], $manager->registered );
	}

	public function test_widget_identity(): void {
		$widget = new Search_Widget();

		$this->assertSame( 'webhead-search-cloud-search', $widget->get_name() );
		$this->assertNotSame( '', $widget->get_title() );
		$this->assertContains( 'general', $widget->get_categories() );
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
		foreach ( [ 'carousel_card_width', 'modal_content_width', 'trigger_box_width', 'trigger_align' ] as $id ) {
			$this->assertTrue( ! empty( $ids[ $id ]['is_responsive'] ) || isset( $ids[ $id . '_mobile' ] ), $id );
		}
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

	public function test_widget_declares_the_shared_runtime_bundle(): void {
		$widget = new Search_Widget();

		$this->assertContains( Frontend_Assets::HANDLE, $widget->get_script_depends() );
		$this->assertContains( Frontend_Assets::HANDLE, $widget->get_style_depends() );
	}

	/**
	 * A control writing a literal property (typography, border) rather than a
	 * `--whsc-*` custom property competes with `style.scss` on specificity,
	 * and loses to it unless boosted. Checked per comma-separated part, since
	 * the boost only counts on the part it is attached to.
	 */
	public function test_every_literal_style_selector_is_boosted(): void {
		$boost = str_repeat( ':not(.whsc-specificity-boost)', 4 );
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

	/**
	 * A stand-in for Elementor's widgets manager that records what gets
	 * registered. Matches the `register( $widget )` shape the registrar checks
	 * for with `method_exists()`.
	 */
	private function fake_widgets_manager(): object {
		return new class() {
			/** @var array<int,mixed> */
			public array $registered = [];

			public function register( $widget ): void {
				$this->registered[] = $widget;
			}
		};
	}
}
