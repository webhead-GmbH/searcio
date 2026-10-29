<?php
/**
 * Elementor "Searcio Search" widget.
 *
 * Mirrors the Gutenberg block's attributes/markup exactly (same trigger, same
 * runtime bundle) via {@see \Webhead\WP\SearchCloud\Frontend\Trigger_Markup}
 * and the entry {@see \Webhead\WP\SearchCloud\Frontend\Frontend_Config::ENTRY},
 * so the two embed points never drift apart.
 *
 * The search modal is portalled to `document.body` at runtime, so it is never
 * a DOM descendant of Elementor's `{{WRAPPER}}`. Modal appearance is therefore
 * driven by CSS custom properties set on `.whsc-instance-{{ID}}` (applied to
 * both the trigger and, by the front-end JS, the portalled modal root). The
 * trigger itself lives inside `{{WRAPPER}}` and its Style-tab controls mostly
 * write CSS custom properties too (`--whsc-trigger-*`), for the same reason:
 * `style.scss`'s own trigger rules carry the three ids of weight that put them
 * above the shared frontend reset, which is more than a plain
 * `{{WRAPPER}} .whsc-trigger-*` selector has - a direct property there would
 * lose to this file's own base rule.
 * Only `Group_Control_Border`/`Group_Control_Typography` output (which can't
 * be redirected to a custom property) still uses a direct selector, and every
 * one of those goes through {@see self::boosted_selector()} so it outranks
 * the same rules.
 * {@see self::asset_entries()} names the shared runtime bundle, and the
 * framework's widget base hands its handles to Elementor, which prints them on
 * the pages that use the widget and in the editor preview, giving a live,
 * interactive preview like any native widget.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Elementor\Widgets;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Typography;
use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Elementor\Widget;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Search_Widget extends Widget {
	/**
	 * A no-op `:not()` that adds four ids of weight to a selector. No element
	 * has the id, so matching is unchanged.
	 *
	 * The shared frontend reset weighs two ids, to outrank whatever a site's
	 * Elementor Kit (Site Settings) writes for bare `input` and `button`
	 * elements. Every rule in `style.scss` weighs three, to keep the plugin's
	 * own design above the reset. What a control on the Style tab sets has to
	 * win over both, against (0,2,0) for a plain
	 * `.whsc-instance-{{ID}} .whsc-card__title`: four ids put it there.
	 */
	private const SPECIFICITY_BOOST = ':not(#whsc#whsc#whsc#whsc)';

	public function get_name(): string {
		return 'webhead-search-cloud-search';
	}

	public function get_title(): string {
		return __( 'Searcio Search', 'searcio' );
	}

	public function get_icon(): string {
		return 'eicon-search';
	}

	public function get_keywords(): array {
		return [ 'search', 'searcio', 'webhead' ];
	}

	/**
	 * Naming the shared runtime bundle here, and enqueueing nothing in
	 * {@see self::render()}, is what makes the widget render and live-update
	 * inside the Elementor editor preview iframe: Elementor prints a widget's
	 * declared script and stylesheet in the editor exactly as on the front
	 * end, so the React runtime is present to hydrate the trigger placeholder.
	 *
	 * @return string[]
	 */
	protected function asset_entries(): array {
		return [ Frontend_Config::ENTRY ];
	}

	protected function register_controls(): void {
		$this->register_content_controls();

		// Roughly in the order a visitor meets each part: the trigger, the
		// modal around everything, then the search itself, its results, and the
		// other modes last.
		$this->register_trigger_style_controls();
		$this->register_modal_style_controls();
		$this->register_tabs_style_controls();
		$this->register_field_style_controls();
		$this->register_button_style_controls();
		$this->register_suggestion_style_controls();
		$this->register_browse_style_controls();
		$this->register_facet_style_controls();
		$this->register_card_style_controls();
		$this->register_carousel_style_controls();
		$this->register_banner_style_controls();
		$this->register_assistant_style_controls();
		$this->register_quiz_style_controls();
	}

	/* ---------------------------------------------------------------------
	 * Content
	 * ------------------------------------------------------------------ */
	private function register_content_controls(): void {
		// Control ids are unchanged from when all of these shared one section,
		// so saved widgets keep every value; only the grouping is new.
		$this->start_controls_section(
			'webhead_search_cloud_content',
			[ 'label' => __( 'Trigger', 'searcio' ) ]
		);

		$this->add_control(
			'mode',
			[
				'label'   => __( 'Trigger style', 'searcio' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'icon',
				'options' => [
					'box'  => __( 'Search box', 'searcio' ),
					'icon' => __( 'Icon button', 'searcio' ),
				],
			]
		);

		$this->add_control(
			'trigger_icon',
			[
				'label'       => __( 'Icon', 'searcio' ),
				'type'        => Controls_Manager::ICONS,
				'condition'   => [ 'mode' => 'icon' ],
				'description' => __( 'Leave empty to use the default search icon.', 'searcio' ),
			]
		);

		$this->add_control(
			'placeholder',
			[
				'label'       => __( 'Placeholder text', 'searcio' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => __( 'Search…', 'searcio' ),
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_behaviour',
			[ 'label' => __( 'Search', 'searcio' ) ]
		);

		$this->add_control(
			'scope_type',
			[
				'label'   => __( 'Restrict to type', 'searcio' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => $this->scope_type_options(),
			]
		);

		$this->add_control(
			'enable_voice',
			[
				'label'        => __( 'Enable voice search', 'searcio' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_on'     => __( 'On', 'searcio' ),
				'label_off'    => __( 'Off', 'searcio' ),
				'return_value' => 'yes',
			]
		);

		$this->add_control(
			'voice_icon',
			[
				'label'       => __( 'Voice icon', 'searcio' ),
				'type'        => Controls_Manager::ICONS,
				'condition'   => [ 'enable_voice' => 'yes' ],
				'description' => __( 'Leave empty to use the default microphone icon.', 'searcio' ),
			]
		);

		$this->add_control(
			'search_trigger',
			[
				'label'       => __( 'When to search', 'searcio' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'submit',
				'options'     => [
					'submit' => __( 'On submit (Enter / button)', 'searcio' ),
					'type'   => __( 'While typing', 'searcio' ),
				],
				'description' => __( "'While typing' searches automatically after 3 characters.", 'searcio' ),
			]
		);

		$this->add_control(
			'show_count',
			[
				'label'        => __( 'Show result count on filters', 'searcio' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => 'yes',
				'label_on'     => __( 'Show', 'searcio' ),
				'label_off'    => __( 'Hide', 'searcio' ),
				'return_value' => 'yes',
			]
		);

		$this->add_control(
			'facet_bar_limit',
			[
				'label'       => __( 'Filter buttons in the bar', 'searcio' ),
				'type'        => Controls_Manager::NUMBER,
				'default'     => Trigger_Markup::FACET_BAR_LIMIT,
				'min'         => 0,
				'max'         => Trigger_Markup::FACET_BAR_LIMIT_MAX,
				'step'        => 1,
				'description' => __( 'How many filters get a button of their own under the search field, as far as they fit. Every filter is under "All filters". 0 shows "All filters" alone.', 'searcio' ),
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_results',
			[ 'label' => __( 'Results', 'searcio' ) ]
		);

		$this->add_control(
			'card_source',
			[
				'label'       => __( 'Card source', 'searcio' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'plugin',
				'options'     => [
					'plugin' => __( 'Plugin templates', 'searcio' ),
					'server' => __( 'Searcio templates', 'searcio' ),
				],
				'description' => __( "Design templates per content type in the Searcio panel's card builder. Any type without a published template there falls back to this plugin's own card.", 'searcio' ),
			]
		);

		$this->add_control(
			'highlights_source',
			[
				'label'       => __( 'Highlights source', 'searcio' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'newest',
				'options'     => [
					'newest'   => __( 'Newest', 'searcio' ),
					'featured' => __( 'Featured', 'searcio' ),
				],
				'description' => __( 'What the empty-query "highlights" carousel shows. "Featured" only works once a boolean "featured" custom field is pushed for this type (Indexing tab).', 'searcio' ),
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_modal',
			[ 'label' => __( 'Modal', 'searcio' ) ]
		);

		$this->add_control(
			'modal_animation',
			[
				'label'   => __( 'Open animation', 'searcio' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'fade',
				'options' => [
					'none'       => __( 'None', 'searcio' ),
					'fade'       => __( 'Fade', 'searcio' ),
					'slide-down' => __( 'Slide down', 'searcio' ),
					'slide-up'   => __( 'Slide up', 'searcio' ),
					'zoom'       => __( 'Zoom', 'searcio' ),
				],
			]
		);

		$this->add_control(
			'modal_animation_duration',
			[
				'label'      => __( 'Animation duration (ms)', 'searcio' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => [ 'ms' ],
				'range'      => [ 'ms' => [ 'min' => 0, 'max' => 1500, 'step' => 50 ] ],
				'condition'  => [ 'modal_animation!' => 'none' ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => '--whsc-anim-duration: {{SIZE}}ms;' ],
			]
		);

		// The modal is closed until a visitor opens it, so without this every
		// Style setting below the Trigger was invisible while being changed.
		$this->add_control(
			'editor_preview',
			[
				'label'        => __( 'Keep open while editing', 'searcio' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_on'     => __( 'On', 'searcio' ),
				'label_off'    => __( 'Off', 'searcio' ),
				'return_value' => 'yes',
				'separator'    => 'before',
				'description'  => __( 'Shows the modal in the editor so you can see the Style settings as you change them. Visitors never see it open by itself.', 'searcio' ),
			]
		);

		$this->add_control(
			'editor_preview_query',
			[
				'label'       => __( 'Preview search', 'searcio' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => __( 'e.g. shirt', 'searcio' ),
				'condition'   => [ 'editor_preview' => 'yes' ],
				'description' => __( 'Runs this search in the preview, so result cards, filters and prices are there to style. Leave empty to style the empty state: recent and popular searches, and the highlights.', 'searcio' ),
			]
		);

		$this->end_controls_section();
	}

	/**
	 * Restrict-to-type options - only the post types actually enabled for
	 * indexing (read from the same `index_config` option the settings screen
	 * and the block's config endpoint use), plus an "All types" default. Falls
	 * back to nothing extra when the option is unset.
	 *
	 * @return array<string,string>
	 */
	private function scope_type_options(): array {
		$options = [ '' => __( 'All types', 'searcio' ) ];
		$config  = get_option( 'webhead_search_cloud_index_config' );

		if ( ! is_array( $config ) ) {
			return $options;
		}

		foreach ( $config as $slug => $block ) {
			if ( ! is_array( $block ) || empty( $block['enabled'] ) ) {
				continue;
			}

			$object = get_post_type_object( (string) $slug );
			$label  = ( null !== $object && isset( $object->labels->name ) && '' !== $object->labels->name )
				? (string) $object->labels->name
				: (string) $slug;

			$options[ (string) $slug ] = $label;
		}

		return $options;
	}

	/* ---------------------------------------------------------------------
	 * Style - Trigger (lives inside {{WRAPPER}}, styled directly)
	 * ------------------------------------------------------------------ */
	private function register_trigger_style_controls(): void {
		$this->start_controls_section(
			'style_trigger',
			[
				'label' => __( 'Trigger', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		// The trigger is an inline box, so the widget's own text alignment
		// places it in the column, in either mode.
		$this->add_responsive_control(
			'trigger_align',
			[
				'label'     => __( 'Alignment', 'searcio' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => [
					'left'   => [ 'title' => __( 'Left', 'searcio' ), 'icon' => 'eicon-text-align-left' ],
					'center' => [ 'title' => __( 'Center', 'searcio' ), 'icon' => 'eicon-text-align-center' ],
					'right'  => [ 'title' => __( 'Right', 'searcio' ), 'icon' => 'eicon-text-align-right' ],
				],
				'selectors' => [ $this->boosted_selector( '{{WRAPPER}}' ) => 'text-align: {{VALUE}};' ],
			]
		);

		// --- Icon mode ---
		//
		// These write CSS custom properties (`--whsc-trigger-icon-size`,
		// `--whsc-trigger-size`, `--whsc-trigger-radius`) that `style.scss`
		// reads with a hardcoded fallback, rather than setting `width`/
		// `height`/`border-radius` directly: this file's own base rule for
		// `.whsc-trigger-icon-button` carries the three ids of weight that
		// put it above the shared frontend reset, which is more than a
		// plain `{{WRAPPER}} .whsc-trigger-icon-button` selector has - a direct
		// property here would silently lose to that base rule. Custom
		// properties sidestep the specificity fight entirely: a rule that
		// matches the element directly always wins over an inherited value
		// regardless of specificity.
		$this->add_responsive_control(
			'trigger_icon_size',
			[
				'label'      => __( 'Icon size', 'searcio' ),
				'type'       => Controls_Manager::SLIDER,
				'condition'  => [ 'mode' => 'icon' ],
				'range'      => [ 'px' => [ 'min' => 12, 'max' => 60 ] ],
				'selectors'  => [
					'{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-icon-size: {{SIZE}}{{UNIT}};',
				],
			]
		);

		$this->add_responsive_control(
			'trigger_box_size',
			[
				'label'     => __( 'Button size', 'searcio' ),
				'type'      => Controls_Manager::SLIDER,
				'condition' => [ 'mode' => 'icon' ],
				'range'     => [ 'px' => [ 'min' => 28, 'max' => 96 ] ],
				'selectors' => [
					'{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-size: {{SIZE}}{{UNIT}};',
				],
			]
		);

		$this->add_responsive_control(
			'trigger_radius',
			[
				'label'      => __( 'Border radius', 'searcio' ),
				'type'       => Controls_Manager::SLIDER,
				'condition'  => [ 'mode' => 'icon' ],
				'range'      => [ 'px' => [ 'min' => 0, 'max' => 100 ], '%' => [ 'min' => 0, 'max' => 50 ] ],
				'size_units' => [ 'px', '%' ],
				'selectors'  => [
					'{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-radius: {{SIZE}}{{UNIT}};',
				],
			]
		);

		$this->start_controls_tabs( 'trigger_icon_color_tabs', [ 'condition' => [ 'mode' => 'icon' ] ] );

		$this->start_controls_tab( 'trigger_icon_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->add_control(
			'trigger_icon_color',
			[
				'label'     => __( 'Icon color', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-icon: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_icon_bg',
			[
				'label'     => __( 'Background', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-bg: {{VALUE}};' ],
			]
		);
		$this->end_controls_tab();

		$this->start_controls_tab( 'trigger_icon_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->add_control(
			'trigger_icon_color_hover',
			[
				'label'     => __( 'Icon color', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-icon-hover: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_icon_bg_hover',
			[
				'label'     => __( 'Background', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-bg-hover: {{VALUE}};' ],
			]
		);
		$this->end_controls_tab();

		$this->end_controls_tabs();

		// --- Box mode ---
		//
		// Text/background/radius write dedicated `--whsc-trigger-box-*`
		// custom properties (see `style.scss`) for the same specificity
		// reason as the icon-mode controls above. Kept separate from the
		// `--whsc-input-*` vars the modal's own "Search field" style section
		// writes - both fall back to that shared baseline by default, but
		// setting one must not silently overwrite the other.
		$this->add_responsive_control(
			'trigger_box_width',
			[
				'label'      => __( 'Width', 'searcio' ),
				'type'       => Controls_Manager::SLIDER,
				'condition'  => [ 'mode' => 'box' ],
				'size_units' => [ '%', 'px' ],
				'range'      => [ '%' => [ 'min' => 10, 'max' => 100 ], 'px' => [ 'min' => 120, 'max' => 1200 ] ],
				'selectors'  => [ '{{WRAPPER}} .webhead-search-cloud-trigger' => '--whsc-trigger-box-width: {{SIZE}}{{UNIT}};' ],
			]
		);

		$this->add_control(
			'trigger_box_text',
			[
				'label'     => __( 'Text color', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'condition' => [ 'mode' => 'box' ],
				'separator' => 'before',
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-text: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_box_icon_color',
			[
				'label'     => __( 'Icon color', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'condition' => [ 'mode' => 'box' ],
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-icon: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_box_bg',
			[
				'label'     => __( 'Background color', 'searcio' ),
				'type'      => Controls_Manager::COLOR,
				'condition' => [ 'mode' => 'box' ],
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-bg: {{VALUE}};' ],
			]
		);
		$this->add_group_control(
			Group_Control_Border::get_type(),
			[
				'name'      => 'trigger_box_border',
				'condition' => [ 'mode' => 'box' ],
				// `Group_Control_Border` always emits literal `border-*`
				// properties (it has no custom-property output mode), so it
				// can't sidestep the specificity fight the same way the
				// controls above do, and is boosted instead. Targets the
				// container, not the `<input>` itself -
				// `@wordpress/components`' `SearchControl` draws the visible
				// border/box around that shared container, not the input.
				'selector'  => $this->boosted_selector( '{{WRAPPER}} .whsc-trigger-box .components-input-control__container' ),
			]
		);
		$this->add_responsive_control(
			'trigger_box_radius',
			[
				'label'      => __( 'Border radius', 'searcio' ),
				'type'       => Controls_Manager::SLIDER,
				'condition'  => [ 'mode' => 'box' ],
				'range'      => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
				'selectors'  => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-radius: {{SIZE}}{{UNIT}};' ],
			]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'      => 'trigger_box_typography',
				'condition' => [ 'mode' => 'box' ],
				'selector'  => $this->boosted_selector( '{{WRAPPER}} .whsc-trigger-box input' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Modal (general shell)
	 * ------------------------------------------------------------------ */
	private function register_modal_style_controls(): void {
		$this->start_controls_section(
			'style_modal',
			[
				'label' => __( 'Modal', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'modal_bg', __( 'Background', 'searcio' ), '--whsc-bg' );
		$this->var_color( 'modal_text', __( 'Text color', 'searcio' ), '--whsc-text' );
		$this->var_color(
			'modal_accent',
			__( 'Accent color', 'searcio' ),
			'--whsc-accent',
			[ 'description' => __( 'Selected states, focus rings, links and the default button colour. Anything set more specifically in another section wins.', 'searcio' ) ]
		);
		$this->var_color(
			'modal_overlay',
			__( 'Overlay', 'searcio' ),
			'--whsc-overlay-bg',
			[ 'description' => __( 'Covers the page behind the open modal. A colour with transparency keeps the page visible.', 'searcio' ) ]
		);

		// A font family only: sizes and weights belong to each part, and a size
		// set here would be overridden by every one of them anyway.
		$this->add_control(
			'modal_font_family',
			[
				'label'       => __( 'Font family', 'searcio' ),
				'type'        => Controls_Manager::FONT,
				'default'     => '',
				'separator'   => 'before',
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-font-family: "{{VALUE}}";' ],
				'description' => __( 'Used by all text in the modal and in the search box trigger. Leave empty to use the page font.', 'searcio' ),
			]
		);

		$this->var_slider( 'modal_radius', __( 'Corner radius', 'searcio' ), '--whsc-radius-panel', 0, 40, false, [ 'separator' => 'before' ] );
		// Docked to the top edge, rounded top corners would only show a gap, so
		// by default the radius rounds the bottom two.
		$this->add_control(
			'modal_round_top',
			[
				'label'        => __( 'Round the top corners too', 'searcio' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'return_value' => 'yes',
				'selectors'    => [ '.whsc-instance-{{ID}}' => '--whsc-radius-panel-top: var(--whsc-radius-panel);' ],
				'description'  => __( 'For a modal set down from the top of the screen.', 'searcio' ),
			]
		);
		$this->var_slider( 'modal_padding', __( 'Padding', 'searcio' ), '--whsc-padding', 0, 80, true );
		$this->var_slider( 'modal_gap', __( 'Section spacing', 'searcio' ), '--whsc-gap', 0, 80, true );

		$this->add_responsive_control(
			'modal_width',
			[
				'label'       => __( 'Modal width', 'searcio' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => [ 'px', '%', 'vw' ],
				'range'       => [ 'px' => [ 'min' => 320, 'max' => 1920 ], '%' => [ 'min' => 30, 'max' => 100 ], 'vw' => [ 'min' => 30, 'max' => 100 ] ],
				'separator'   => 'before',
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-modal-width: {{SIZE}}{{UNIT}};' ],
				'description' => __( 'Leave empty for a full-width modal docked to the top of the screen. A narrower one is centred.', 'searcio' ),
			]
		);
		$this->var_slider( 'modal_offset', __( 'Distance from top', 'searcio' ), '--whsc-modal-offset', 0, 200, true );

		// The modal spans the viewport; this caps the content inside it, so on a
		// wide screen it can line up with the site's own container.
		$this->add_responsive_control(
			'modal_content_width',
			[
				'label'       => __( 'Content width', 'searcio' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => [ 'px', '%' ],
				'range'       => [ 'px' => [ 'min' => 480, 'max' => 1920 ], '%' => [ 'min' => 40, 'max' => 100 ] ],
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-content-width: {{SIZE}}{{UNIT}};' ],
				'description' => __( "The widest the content grows inside the full-width modal. Use your theme's container width to line it up with the page.", 'searcio' ),
			]
		);

		$this->add_control(
			'section_title_heading',
			[ 'label' => __( 'Section titles', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'section_title_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'Headings such as "Recent searches", "Popular searches" and the results count. Filter group names have their own, under Filters.', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);
		$this->var_color( 'title_color', __( 'Color', 'searcio' ), '--whsc-title-color' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'title_typography',
				'label'    => __( 'Typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-section-title' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Mode tabs (Search / AI Assistant / Product finder). Only drawn
	 * when a second mode is on for the site, and they sit above every mode,
	 * so they are not the assistant's own.
	 * ------------------------------------------------------------------ */
	private function register_tabs_style_controls(): void {
		$this->start_controls_section(
			'style_mode_tabs',
			[
				'label' => __( 'Mode tabs', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'mode_tabs_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The row of tabs above the search box. It only appears when the AI assistant or a guided quiz is on for your site.', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->start_controls_tabs( 'tab_state_tabs' );
		$this->start_controls_tab( 'tab_state_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'tab_text', __( 'Tab text', 'searcio' ), '--whsc-tab-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'tab_state_active', [ 'label' => __( 'Active', 'searcio' ) ] );
		$this->var_color( 'tab_text_active', __( 'Tab text', 'searcio' ), '--whsc-tab-text-active' );
		$this->var_color( 'tab_indicator', __( 'Underline', 'searcio' ), '--whsc-tab-indicator' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_color( 'tab_border', __( 'Divider', 'searcio' ), '--whsc-tab-border', [ 'separator' => 'before' ] );

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'tab_typography',
				'label'    => __( 'Typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-modal-tab' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Search field
	 * ------------------------------------------------------------------ */
	private function register_field_style_controls(): void {
		$this->start_controls_section(
			'style_field',
			[
				'label' => __( 'Search field', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'field_bg', __( 'Background', 'searcio' ), '--whsc-input-bg' );
		$this->var_color( 'field_text', __( 'Text color', 'searcio' ), '--whsc-input-text' );
		$this->var_color( 'field_placeholder', __( 'Placeholder color', 'searcio' ), '--whsc-input-placeholder' );
		$this->var_color( 'field_icon', __( 'Icon color', 'searcio' ), '--whsc-input-icon' );

		$this->start_controls_tabs( 'field_border_tabs' );
		$this->start_controls_tab( 'field_border_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'field_border', __( 'Border color', 'searcio' ), '--whsc-input-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'field_border_focus_tab', [ 'label' => __( 'Focus', 'searcio' ) ] );
		$this->var_color( 'field_border_focus', __( 'Border color', 'searcio' ), '--whsc-input-border-focus' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'field_radius', __( 'Border radius', 'searcio' ), '--whsc-input-radius', 0, 999, false, [ 'separator' => 'before' ] );

		// The modal root carries both `.whsc-modal` and the instance class.
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'field_typography',
				'selector' => $this->boosted_selector( '.whsc-modal.whsc-instance-{{ID}} .whsc-search-input__field' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Buttons (submit + icon buttons)
	 * ------------------------------------------------------------------ */
	private function register_button_style_controls(): void {
		$this->start_controls_section(
			'style_buttons',
			[
				'label' => __( 'Buttons', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'submit_heading',
			[ 'label' => __( 'Primary buttons', 'searcio' ), 'type' => Controls_Manager::HEADING ]
		);
		$this->add_control(
			'submit_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The Search button, "Load more" under the results and the price filter\'s Apply.', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->start_controls_tabs( 'submit_color_tabs' );
		$this->start_controls_tab( 'submit_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'submit_bg', __( 'Background', 'searcio' ), '--whsc-btn-bg' );
		$this->var_color( 'submit_text', __( 'Text', 'searcio' ), '--whsc-btn-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'submit_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'submit_bg_hover', __( 'Background', 'searcio' ), '--whsc-btn-bg-hover' );
		$this->var_color( 'submit_text_hover', __( 'Text', 'searcio' ), '--whsc-btn-text-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'submit_radius', __( 'Border radius', 'searcio' ), '--whsc-btn-radius', 0, 999, false, [ 'separator' => 'before' ] );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'submit_typography',
				'label'    => __( 'Typography', 'searcio' ),
				'selector' => $this->boosted_selector(
					'.whsc-instance-{{ID}} .whsc-submit-btn',
					'.whsc-instance-{{ID}} .whsc-load-more__button',
					'.whsc-instance-{{ID}} .whsc-range__apply'
				),
			]
		);

		$this->icon_button_controls( 'voice', __( 'Voice button', 'searcio' ), 'voice' );
		$this->icon_button_controls( 'visual', __( 'Photo search button', 'searcio' ), 'visual' );
		$this->icon_button_controls( 'close', __( 'Close button', 'searcio' ), 'close' );
		$this->icon_button_controls( 'clearbtn', __( 'Clear button', 'searcio' ), 'clearbtn' );

		$this->end_controls_section();
	}

	/**
	 * A reusable block of controls for one icon button (voice / close / clear):
	 * Normal + Hover tabs for icon color and background, plus radius and
	 * padding. Each drives its own `--whsc-{var}-*` custom properties.
	 */
	private function icon_button_controls( string $prefix, string $label, string $var ): void {
		$this->add_control(
			$prefix . '_heading',
			[ 'label' => $label, 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);

		$this->start_controls_tabs( $prefix . '_tabs' );
		$this->start_controls_tab( $prefix . '_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( $prefix . '_color', __( 'Icon color', 'searcio' ), '--whsc-' . $var . '-color' );
		$this->var_color( $prefix . '_bg', __( 'Background', 'searcio' ), '--whsc-' . $var . '-bg' );
		$this->end_controls_tab();
		$this->start_controls_tab( $prefix . '_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( $prefix . '_color_hover', __( 'Icon color', 'searcio' ), '--whsc-' . $var . '-color-hover' );
		$this->var_color( $prefix . '_bg_hover', __( 'Background', 'searcio' ), '--whsc-' . $var . '-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( $prefix . '_radius', __( 'Border radius', 'searcio' ), '--whsc-' . $var . '-radius', 0, 999 );

		$this->add_responsive_control(
			$prefix . '_padding',
			[
				'label'      => __( 'Padding', 'searcio' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [
					'.whsc-instance-{{ID}}' => '--whsc-' . $var . '-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				],
			]
		);
	}

	/* ---------------------------------------------------------------------
	 * Style - Suggestions dropdown
	 * ------------------------------------------------------------------ */
	private function register_suggestion_style_controls(): void {
		$this->start_controls_section(
			'style_suggestions',
			[
				'label' => __( 'Suggestions', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'suggest_panel_bg', __( 'Panel background', 'searcio' ), '--whsc-panel-bg' );
		$this->var_color( 'suggest_panel_border', __( 'Panel border', 'searcio' ), '--whsc-panel-border' );
		$this->var_slider( 'suggest_panel_radius', __( 'Panel radius', 'searcio' ), '--whsc-panel-radius', 0, 40 );

		$this->start_controls_tabs( 'suggest_item_tabs' );
		$this->start_controls_tab( 'suggest_item_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'suggest_text', __( 'Item text', 'searcio' ), '--whsc-suggestion-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'suggest_item_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'suggest_text_hover', __( 'Item text', 'searcio' ), '--whsc-suggestion-text-hover' );
		$this->var_color( 'suggest_bg_hover', __( 'Item background', 'searcio' ), '--whsc-suggestion-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'suggest_typography',
				'label'    => __( 'Item typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-suggestion' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Recent & popular
	 * ------------------------------------------------------------------ */
	private function register_browse_style_controls(): void {
		$this->start_controls_section(
			'style_browse',
			[
				'label' => __( 'Recent & popular', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'chip_heading',
			[ 'label' => __( 'Recent chips', 'searcio' ), 'type' => Controls_Manager::HEADING ]
		);
		$this->start_controls_tabs( 'chip_tabs' );
		$this->start_controls_tab( 'chip_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'chip_bg', __( 'Background', 'searcio' ), '--whsc-chip-bg' );
		$this->var_color( 'chip_text', __( 'Text', 'searcio' ), '--whsc-chip-text' );
		$this->var_color( 'chip_border', __( 'Border', 'searcio' ), '--whsc-chip-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'chip_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'chip_bg_hover', __( 'Background', 'searcio' ), '--whsc-chip-bg-hover' );
		$this->var_color( 'chip_text_hover', __( 'Text', 'searcio' ), '--whsc-chip-text-hover' );
		$this->var_color( 'chip_border_hover', __( 'Border', 'searcio' ), '--whsc-chip-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'chip_radius', __( 'Radius', 'searcio' ), '--whsc-chip-radius', 0, 999 );

		$this->add_control(
			'clear_heading',
			[ 'label' => __( '"Clear all" link', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'clear_tabs' );
		$this->start_controls_tab( 'clear_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'clear_text', __( 'Text', 'searcio' ), '--whsc-clear-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'clear_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'clear_text_hover', __( 'Text', 'searcio' ), '--whsc-clear-text-hover' );
		$this->var_color( 'clear_bg_hover', __( 'Background', 'searcio' ), '--whsc-clear-bg-hover' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'clear_active', [ 'label' => __( 'Active', 'searcio' ) ] );
		$this->var_color( 'clear_text_active', __( 'Text', 'searcio' ), '--whsc-clear-text-active' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->add_responsive_control(
			'clear_padding',
			[
				'label'      => __( 'Padding', 'searcio' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => '--whsc-clear-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};' ],
			]
		);

		$this->add_control(
			'popular_heading',
			[ 'label' => __( 'Popular items', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'popular_tabs' );
		$this->start_controls_tab( 'popular_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'popular_text', __( 'Text', 'searcio' ), '--whsc-popular-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'popular_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'popular_text_hover', __( 'Text', 'searcio' ), '--whsc-popular-text-hover' );
		$this->var_color( 'popular_bg_hover', __( 'Background', 'searcio' ), '--whsc-popular-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'popular_gap', __( 'Spacing between items', 'searcio' ), '--whsc-popular-gap', 0, 24, true );
		$this->var_slider( 'popular_radius', __( 'Item radius', 'searcio' ), '--whsc-popular-radius', 0, 40 );
		$this->add_responsive_control(
			'popular_padding',
			[
				'label'      => __( 'Item padding', 'searcio' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => '--whsc-popular-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};' ],
			]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'popular_typography',
				'label'    => __( 'Popular typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-popular-item' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Filters: the bar's buttons, the type switch, size tiles, colour
	 * pills and the chips of the filters applied share one look; the popover,
	 * the drawer and the phone's sheet they open have their own shape.
	 * ------------------------------------------------------------------ */
	private function register_facet_style_controls(): void {
		$this->start_controls_section(
			'style_facets',
			[
				'label' => __( 'Filters', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'facet_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'Style the filter buttons under the search field, the type switch, size tiles, colour pills and the filters shown beside the result count.', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->start_controls_tabs( 'facet_tabs' );
		$this->start_controls_tab( 'facet_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'facet_bg', __( 'Background', 'searcio' ), '--whsc-facet-bg' );
		$this->var_color( 'facet_text', __( 'Text', 'searcio' ), '--whsc-facet-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'facet_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'facet_bg_hover', __( 'Background', 'searcio' ), '--whsc-facet-bg-hover' );
		$this->var_color( 'facet_text_hover', __( 'Text', 'searcio' ), '--whsc-facet-text-hover' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'facet_active', [ 'label' => __( 'Active', 'searcio' ) ] );
		$this->var_color( 'facet_bg_active', __( 'Background', 'searcio' ), '--whsc-facet-bg-active' );
		$this->var_color( 'facet_text_active', __( 'Text', 'searcio' ), '--whsc-facet-text-active' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'facet_radius', __( 'Border radius', 'searcio' ), '--whsc-facet-radius', 0, 999, false, [ 'separator' => 'before' ] );
		$this->var_slider( 'filter_height', __( 'Button height', 'searcio' ), '--whsc-filter-height', 32, 64, true, [ 'description' => __( 'The height of the filter buttons under the search field.', 'searcio' ) ] );
		$this->var_slider( 'facets_max_height', __( 'Max height', 'searcio' ), '--whsc-facets-max-height', 60, 600, false, [ 'description' => __( 'Max height of a value list in a filter panel; a longer list scrolls.', 'searcio' ) ] );

		$this->add_control(
			'filter_badge_heading',
			[ 'label' => __( 'Count on "All filters"', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'filter_badge_bg', __( 'Background', 'searcio' ), '--whsc-filter-badge-bg' );
		$this->var_color( 'filter_badge_text', __( 'Text', 'searcio' ), '--whsc-filter-badge-text' );

		$this->add_control(
			'filter_panel_heading',
			[ 'label' => __( 'Filter panels', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_slider( 'popover_width', __( 'Popover width', 'searcio' ), '--whsc-popover-width', 260, 560 );
		$this->var_slider( 'popover_radius', __( 'Popover radius', 'searcio' ), '--whsc-popover-radius', 0, 40 );
		$this->var_slider( 'drawer_width', __( '"All filters" width', 'searcio' ), '--whsc-drawer-width', 300, 640, false, [ 'description' => __( 'The side panel "All filters" opens on a tablet or a desktop.', 'searcio' ) ] );
		$this->var_slider( 'sheet_radius', __( 'Phone sheet radius', 'searcio' ), '--whsc-sheet-radius', 0, 40, false, [ 'description' => __( 'The top corners of the panel filters open from the bottom on a phone.', 'searcio' ) ] );

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_typography',
				'label'    => __( 'Label typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet__label' ),
			]
		);

		$this->add_control(
			'facet_count_heading',
			[ 'label' => __( 'Result count', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'facet_count_color', __( 'Count color', 'searcio' ), '--whsc-facet-count' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_count_typography',
				'label'    => __( 'Count typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet__count' ),
			]
		);

		$this->add_control(
			'facet_group_heading',
			[ 'label' => __( 'Group names', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'facet_group_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The title of a filter\'s panel and of each section of "All filters", such as "Categories" or "Price".', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);
		// By default the label is the section title colour; a colour picked for
		// it is used as picked, at full opacity.
		$this->var_color(
			'facet_group_color',
			__( 'Color', 'searcio' ),
			'--whsc-facet-group-label',
			[ 'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-facet-group-label: {{VALUE}}; --whsc-facet-group-label-opacity: 1;' ] ]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_group_typography',
				'label'    => __( 'Typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet-group__label' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - the assistant pane. Shown only when the plan includes the
	 * assistant, but the controls are always available so a site can theme it
	 * ahead of enabling it.
	 * ------------------------------------------------------------------ */
	private function register_assistant_style_controls(): void {
		$this->start_controls_section(
			'style_assistant',
			[
				'label' => __( 'AI Assistant', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'assistant_accent', __( 'Accent (avatar, dots)', 'searcio' ), '--whsc-assistant-accent' );
		$this->var_color( 'assistant_text', __( 'Reply text', 'searcio' ), '--whsc-assistant-text' );
		$this->var_color( 'assistant_user_bg', __( 'Your message background', 'searcio' ), '--whsc-assistant-user-bg' );
		$this->var_color( 'assistant_user_text', __( 'Your message text', 'searcio' ), '--whsc-assistant-user-text' );
		$this->var_color( 'assistant_row_bg', __( 'Compare row shading', 'searcio' ), '--whsc-assistant-row-bg' );
		$this->var_slider( 'assistant_input_radius', __( 'Message field radius', 'searcio' ), '--whsc-assistant-input-radius', 0, 999, false, [ 'separator' => 'before' ] );

		$this->end_controls_section();
	}

	/**
	 * The guided quiz tab. Its answers are the only thing on screen while a
	 * question is showing, so they get their own colours rather than borrowing
	 * the filter chips' - a merchant will usually want them to read as the
	 * primary action.
	 */
	private function register_banner_style_controls(): void {
		$this->start_controls_section(
			'style_banner',
			[
				'label' => __( 'Promotional banner', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'banner_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'Shown above the results when a merchandising rule attaches a banner to the search.', 'searcio' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->var_color( 'banner_bg', __( 'Background', 'searcio' ), '--whsc-banner-bg' );
		$this->var_color( 'banner_text', __( 'Text', 'searcio' ), '--whsc-banner-text' );

		$this->end_controls_section();
	}

	private function register_quiz_style_controls(): void {
		$this->start_controls_section(
			'style_quiz',
			[
				'label' => __( 'Guided quiz', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'quiz_question', __( 'Question text', 'searcio' ), '--whsc-quiz-question' );

		$this->add_control(
			'quiz_option_heading',
			[ 'label' => __( 'Answers', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);

		$this->start_controls_tabs( 'quiz_option_tabs' );
		$this->start_controls_tab( 'quiz_option_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'quiz_option_bg', __( 'Background', 'searcio' ), '--whsc-quiz-option-bg' );
		$this->var_color( 'quiz_option_text', __( 'Text', 'searcio' ), '--whsc-quiz-option-text' );
		$this->var_color( 'quiz_option_border', __( 'Border', 'searcio' ), '--whsc-quiz-option-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'quiz_option_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'quiz_option_bg_hover', __( 'Background', 'searcio' ), '--whsc-quiz-option-bg-hover' );
		$this->var_color( 'quiz_option_text_hover', __( 'Text', 'searcio' ), '--whsc-quiz-option-text-hover' );
		$this->var_color( 'quiz_option_border_hover', __( 'Border', 'searcio' ), '--whsc-quiz-option-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'quiz_option_radius', __( 'Answer radius', 'searcio' ), '--whsc-quiz-option-radius', 0, 999, false, [ 'separator' => 'before' ] );

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Result cards
	 * ------------------------------------------------------------------ */
	private function register_card_style_controls(): void {
		$this->start_controls_section(
			'style_cards',
			[
				'label' => __( 'Result cards', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'card_bg', __( 'Background', 'searcio' ), '--whsc-card-bg' );

		$this->start_controls_tabs( 'card_border_tabs' );
		$this->start_controls_tab( 'card_border_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'card_border', __( 'Border', 'searcio' ), '--whsc-card-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'card_border_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'card_border_hover', __( 'Border', 'searcio' ), '--whsc-card-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'card_radius', __( 'Border radius', 'searcio' ), '--whsc-card-radius', 0, 40, false, [ 'separator' => 'before' ] );
		$this->var_slider( 'card_padding', __( 'Padding', 'searcio' ), '--whsc-card-padding', 0, 40, true );

		$this->add_control(
			'card_image_heading',
			[ 'label' => __( 'Image', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'card_image_ratio',
			[
				'label'     => __( 'Aspect ratio', 'searcio' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => [
					''       => __( 'Square (default)', 'searcio' ),
					'4 / 5'  => __( 'Portrait 4:5', 'searcio' ),
					'3 / 4'  => __( 'Portrait 3:4', 'searcio' ),
					'2 / 3'  => __( 'Tall 2:3', 'searcio' ),
					'4 / 3'  => __( 'Landscape 4:3', 'searcio' ),
					'16 / 9' => __( 'Wide 16:9', 'searcio' ),
				],
				'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-card-image-ratio: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'card_image_fit',
			[
				'label'       => __( 'Fit', 'searcio' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => [
					''        => __( 'Fill and crop (default)', 'searcio' ),
					'contain' => __( 'Show the whole image', 'searcio' ),
				],
				'description' => __( '"Show the whole image" keeps packshots on a plain background uncropped; the background below fills the space around them.', 'searcio' ),
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-card-image-fit: {{VALUE}};' ],
			]
		);
		$this->var_color( 'card_image_bg', __( 'Background', 'searcio' ), '--whsc-card-image-bg' );
		$this->var_slider( 'card_image_radius', __( 'Border radius', 'searcio' ), '--whsc-card-image-radius', 0, 40 );

		$this->add_control(
			'card_badge_heading',
			[ 'label' => __( 'Sale badge', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'card_badge_bg', __( 'Background', 'searcio' ), '--whsc-badge-bg' );
		$this->var_color( 'card_badge_text', __( 'Text', 'searcio' ), '--whsc-badge-text' );
		$this->var_slider( 'card_badge_radius', __( 'Border radius', 'searcio' ), '--whsc-badge-radius', 0, 999 );

		$this->add_control(
			'card_text_heading',
			[ 'label' => __( 'Title and price', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'card_title_color', __( 'Title color', 'searcio' ), '--whsc-card-title' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_title_typography',
				'label'    => __( 'Title typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__title' ),
			]
		);
		$this->add_control(
			'card_title_lines',
			[
				'label'       => __( 'Title lines', 'searcio' ),
				'type'        => Controls_Manager::NUMBER,
				'min'         => 1,
				'max'         => 5,
				'step'        => 1,
				'placeholder' => '2',
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-card-title-lines: {{VALUE}};' ],
				'description' => __( 'A longer title is cut off with an ellipsis after this many lines, so cards line up.', 'searcio' ),
			]
		);
		$this->var_color( 'card_price_color', __( 'Price / meta color', 'searcio' ), '--whsc-price-color' );
		// The amount itself is `.whsc-card__price-current`, which sets its own
		// weight, so a weight set on the price line alone never reached it.
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_price_typography',
				'label'    => __( 'Price typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__price', '.whsc-instance-{{ID}} .whsc-card__price-current' ),
			]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_price_suffix_typography',
				'label'    => __( 'Price suffix / "from" typography', 'searcio' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__price-suffix', '.whsc-instance-{{ID}} .whsc-card__price-from' ),
			]
		);

		$this->add_control(
			'card_stock_heading',
			[ 'label' => __( 'Stock status', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'card_stock_display',
			[
				'label'     => __( 'Show', 'searcio' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => [
					''     => __( 'Show (default)', 'searcio' ),
					'none' => __( 'Hide', 'searcio' ),
				],
				'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-card-stock-display: {{VALUE}};' ],
			]
		);
		$this->var_color( 'card_stock_in_color', __( 'In stock', 'searcio' ), '--whsc-stock-in-color', [ 'condition' => [ 'card_stock_display!' => 'none' ] ] );
		$this->var_color( 'card_stock_out_color', __( 'Out of stock', 'searcio' ), '--whsc-stock-out-color', [ 'condition' => [ 'card_stock_display!' => 'none' ] ] );

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style - Carousel
	 * ------------------------------------------------------------------ */
	private function register_carousel_style_controls(): void {
		$this->start_controls_section(
			'style_carousel',
			[
				'label' => __( 'Carousel', 'searcio' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_slider(
			'carousel_card_width',
			__( 'Card width', 'searcio' ),
			'--whsc-card-width',
			100,
			480,
			true,
			[ 'description' => __( 'How wide each result card is, and so how many fit side by side. Set it per device with the responsive switch.', 'searcio' ) ]
		);
		$this->var_slider( 'carousel_gap', __( 'Spacing between items', 'searcio' ), '--whsc-carousel-gap', 0, 48, true );
		$this->add_control(
			'arrow_heading',
			[ 'label' => __( 'Arrows', 'searcio' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'arrow_tabs' );
		$this->start_controls_tab( 'arrow_normal', [ 'label' => __( 'Normal', 'searcio' ) ] );
		$this->var_color( 'arrow_color', __( 'Arrow color', 'searcio' ), '--whsc-arrow-color' );
		$this->var_color( 'arrow_bg', __( 'Arrow background', 'searcio' ), '--whsc-arrow-bg' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'arrow_hover', [ 'label' => __( 'Hover', 'searcio' ) ] );
		$this->var_color( 'arrow_color_hover', __( 'Arrow color', 'searcio' ), '--whsc-arrow-color-hover' );
		$this->var_color( 'arrow_bg_hover', __( 'Arrow background', 'searcio' ), '--whsc-arrow-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'arrow_size', __( 'Arrow size', 'searcio' ), '--whsc-arrow-size', 24, 64, true, [ 'separator' => 'before' ] );
		$this->var_slider( 'arrow_radius', __( 'Arrow radius', 'searcio' ), '--whsc-arrow-radius', 0, 999 );
		$this->add_control(
			'arrow_shadow',
			[
				'label'     => __( 'Arrow shadow', 'searcio' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => [
					''     => __( 'Soft (default)', 'searcio' ),
					'none' => __( 'None', 'searcio' ),
				],
				'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-arrow-shadow: {{VALUE}};' ],
			]
		);
		$this->var_color( 'dot_color', __( 'Dot color', 'searcio' ), '--whsc-dot-color', [ 'separator' => 'before' ] );
		$this->var_color( 'dot_color_active', __( 'Dot color (active)', 'searcio' ), '--whsc-dot-color-active' );

		$this->end_controls_section();
	}

	/**
	 * Selector for a group control that writes literal properties rather than
	 * a custom property: each comma-separated part gets
	 * {@see self::SPECIFICITY_BOOST}, since the boost only counts on the part
	 * it is attached to.
	 */
	private function boosted_selector( string ...$selectors ): string {
		return implode(
			', ',
			array_map( static fn ( string $selector ): string => $selector . self::SPECIFICITY_BOOST, $selectors )
		);
	}

	/* ---------------------------------------------------------------------
	 * Control helpers - set a CSS custom property on the per-instance class,
	 * which reaches both the trigger and the portalled modal.
	 * ------------------------------------------------------------------ */
	private function var_color( string $name, string $label, string $var, array $extra = [] ): void {
		$this->add_control(
			$name,
			array_merge(
				[
					'label'     => $label,
					'type'      => Controls_Manager::COLOR,
					'selectors' => [ '.whsc-instance-{{ID}}' => $var . ': {{VALUE}};' ],
				],
				$extra
			)
		);
	}

	private function var_slider( string $name, string $label, string $var, int $min, int $max, bool $responsive = false, array $extra = [] ): void {
		$args = array_merge(
			[
				'label'      => $label,
				'type'       => Controls_Manager::SLIDER,
				'size_units' => [ 'px' ],
				'range'      => [ 'px' => [ 'min' => $min, 'max' => $max ] ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => $var . ': {{SIZE}}{{UNIT}};' ],
			],
			$extra
		);

		if ( $responsive ) {
			$this->add_responsive_control( $name, $args );
		} else {
			$this->add_control( $name, $args );
		}
	}

	/**
	 * `get_id()` returns this element's saved ID inside the editor, but on a
	 * plain front-end request in this Elementor version it can come back empty
	 * even though the stored element data still has a real `id`. `get_data(
	 * 'id' )` reads that raw data independently, so it survives whatever drops
	 * `$this->id` - keeping the `.whsc-instance-{id}` class matched to the ID
	 * Elementor's own compiled CSS uses for `.whsc-instance-{{ID}}` selectors.
	 */
	private function resolve_instance_id(): string {
		$id = $this->get_id();

		if ( '' !== $id ) {
			return $id;
		}

		return (string) $this->get_data( 'id' );
	}

	/**
	 * Render a chosen icon (Font Awesome or uploaded SVG) to an HTML string via
	 * Elementor's own sanitized icon renderer, so it can be threaded to the
	 * React trigger/modal. Returns '' when no icon is set for that field (the
	 * default glyph is used) - shared between `trigger_icon` and `voice_icon`.
	 */
	private function render_icon_html( array $settings, string $field ): string {
		$icon = $settings[ $field ] ?? [];

		if ( empty( $icon['value'] ) || ! class_exists( '\Elementor\Icons_Manager' ) ) {
			return '';
		}

		ob_start();
		\Elementor\Icons_Manager::render_icon( $icon, [ 'aria-hidden' => 'true' ] );

		return trim( (string) ob_get_clean() );
	}

	/**
	 * Whether this render is for the Elementor editor with "Keep open while
	 * editing" on. Checked on the server, so a saved setting can never open the
	 * modal for a visitor.
	 *
	 * @param  array<string,mixed>  $settings
	 */
	private function is_editor_preview( array $settings ): bool {
		return 'yes' === ( $settings['editor_preview'] ?? '' ) && $this->is_editing();
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();

		// Every value is escaped inside Trigger_Markup::render(), which returns a
		// finished attribute-escaped element. The disable/enable pair spans the
		// whole call: a single-line phpcs:ignore only covers the `echo` itself, so
		// each array element was still reported.
		// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
		echo Trigger_Markup::render(
			[
				'mode'          => (string) ( $settings['mode'] ?? 'icon' ),
				'scopeType'     => (string) ( $settings['scope_type'] ?? '' ),
				'cardSource'    => (string) ( $settings['card_source'] ?? 'plugin' ),
				'highlightsSource' => (string) ( $settings['highlights_source'] ?? 'newest' ),
				'placeholder'   => (string) ( $settings['placeholder'] ?? '' ),
				'enableVoice'   => 'yes' === ( $settings['enable_voice'] ?? '' ),
				'searchTrigger' => (string) ( $settings['search_trigger'] ?? 'submit' ),
				'instanceClass' => 'whsc-instance-' . $this->resolve_instance_id(),
				'iconHtml'      => $this->render_icon_html( $settings, 'trigger_icon' ),
				'voiceIconHtml' => $this->render_icon_html( $settings, 'voice_icon' ),
				'animation'     => (string) ( $settings['modal_animation'] ?? 'fade' ),
				'showCount'     => 'yes' === ( $settings['show_count'] ?? 'yes' ),
				'facetBarLimit' => $settings['facet_bar_limit'] ?? null,
				'editorPreview' => $this->is_editor_preview( $settings ),
				'editorQuery'   => (string) ( $settings['editor_preview_query'] ?? '' ),
			]
		);
		// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
