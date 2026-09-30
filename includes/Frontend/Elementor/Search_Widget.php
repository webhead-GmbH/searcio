<?php
/**
 * Elementor "Search Cloud" widget.
 *
 * Mirrors the Gutenberg block's attributes/markup exactly (same trigger, same
 * runtime bundle) via {@see \Webhead\WP\SearchCloud\Frontend\Trigger_Markup}
 * and {@see \Webhead\WP\SearchCloud\Frontend\Frontend_Assets}, so the two
 * embed points never drift apart.
 *
 * The search modal is portalled to `document.body` at runtime, so it is never
 * a DOM descendant of Elementor's `{{WRAPPER}}`. Modal appearance is therefore
 * driven by CSS custom properties set on `.whsc-instance-{{ID}}` (applied to
 * both the trigger and, by the front-end JS, the portalled modal root). The
 * trigger itself lives inside `{{WRAPPER}}` and its Style-tab controls mostly
 * write CSS custom properties too (`--whsc-trigger-*`), for the same reason:
 * `style.scss`'s own trigger rules sit inside the `[data-webhead-frontend-root]`
 * -tripled block used to outrank the shared frontend reset, which gives them
 * higher specificity than a plain `{{WRAPPER}} .whsc-trigger-*` selector would
 * have — a direct property there would lose to this file's own base rule.
 * Only `Group_Control_Border`/`Group_Control_Typography` output (which can't
 * be redirected to a custom property) still uses a direct selector, and every
 * one of those goes through {@see self::boosted_selector()} so it outranks
 * the same rules.
 * `get_script_depends()`/`get_style_depends()` declare the shared runtime
 * bundle so Elementor enqueues it in the editor preview too, giving a live,
 * interactive preview like any native widget.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend\Elementor;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Typography;
use Elementor\Widget_Base;
use Webhead\WP\SearchCloud\Frontend\Frontend_Assets;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Search_Widget extends Widget_Base {
	/**
	 * Four no-op `:not()`s, adding (0,4,0) to a selector. The class never
	 * exists in the markup, so matching is unchanged.
	 *
	 * Every rule in `style.scss` carries the tripled
	 * `[data-webhead-frontend-root]` prefix, and the ones that set type on a
	 * control's target reach (0,5,0) — `.whsc-modal .whsc-section-title`,
	 * `.whsc-modal .whsc-popular-item`, `.whsc-modal .whsc-search-input__field`
	 * — against (0,2,0) for a plain `.whsc-instance-{{ID}} .whsc-card__title`.
	 * A site's Elementor Kit (Site Settings) styles bare `input` and `button`
	 * elements too, at up to (0,3,1). Four points lift the lightest selector here to (0,6,0),
	 * above all of them.
	 */
	private const SPECIFICITY_BOOST = ':not(.whsc-specificity-boost):not(.whsc-specificity-boost):not(.whsc-specificity-boost):not(.whsc-specificity-boost)';

	public function get_name(): string {
		return 'webhead-search-cloud-search';
	}

	public function get_title(): string {
		return __( 'Search Cloud', 'webhead-search-cloud' );
	}

	public function get_icon(): string {
		return 'eicon-search';
	}

	public function get_categories(): array {
		return [ 'general' ];
	}

	public function get_keywords(): array {
		return [ 'search', 'search cloud', 'webhead' ];
	}

	/**
	 * Declaring the shared runtime bundle here (rather than only enqueueing it
	 * in {@see self::render()}) is what makes the widget render and live-update
	 * inside the Elementor editor preview iframe: Elementor enqueues a widget's
	 * declared script/style dependencies in the editor exactly as on the front
	 * end, so the React runtime is present to hydrate the trigger placeholder.
	 *
	 * @return string[]
	 */
	public function get_script_depends(): array {
		return [ Frontend_Assets::HANDLE ];
	}

	/**
	 * @return string[]
	 */
	public function get_style_depends(): array {
		return [ Frontend_Assets::HANDLE ];
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
			[ 'label' => __( 'Trigger', 'webhead-search-cloud' ) ]
		);

		$this->add_control(
			'mode',
			[
				'label'   => __( 'Trigger style', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'icon',
				'options' => [
					'box'  => __( 'Search box', 'webhead-search-cloud' ),
					'icon' => __( 'Icon button', 'webhead-search-cloud' ),
				],
			]
		);

		$this->add_control(
			'trigger_icon',
			[
				'label'       => __( 'Icon', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::ICONS,
				'condition'   => [ 'mode' => 'icon' ],
				'description' => __( 'Leave empty to use the default search icon.', 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'placeholder',
			[
				'label'       => __( 'Placeholder text', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => __( 'Search…', 'webhead-search-cloud' ),
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_behaviour',
			[ 'label' => __( 'Search', 'webhead-search-cloud' ) ]
		);

		$this->add_control(
			'scope_type',
			[
				'label'   => __( 'Restrict to type', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => $this->scope_type_options(),
			]
		);

		$this->add_control(
			'enable_voice',
			[
				'label'        => __( 'Enable voice search', 'webhead-search-cloud' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_on'     => __( 'On', 'webhead-search-cloud' ),
				'label_off'    => __( 'Off', 'webhead-search-cloud' ),
				'return_value' => 'yes',
			]
		);

		$this->add_control(
			'voice_icon',
			[
				'label'       => __( 'Voice icon', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::ICONS,
				'condition'   => [ 'enable_voice' => 'yes' ],
				'description' => __( 'Leave empty to use the default microphone icon.', 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'search_trigger',
			[
				'label'       => __( 'When to search', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'submit',
				'options'     => [
					'submit' => __( 'On submit (Enter / button)', 'webhead-search-cloud' ),
					'type'   => __( 'While typing', 'webhead-search-cloud' ),
				],
				'description' => __( "'While typing' searches automatically after 3 characters.", 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'show_count',
			[
				'label'        => __( 'Show result count on filters', 'webhead-search-cloud' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => 'yes',
				'label_on'     => __( 'Show', 'webhead-search-cloud' ),
				'label_off'    => __( 'Hide', 'webhead-search-cloud' ),
				'return_value' => 'yes',
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_results',
			[ 'label' => __( 'Results', 'webhead-search-cloud' ) ]
		);

		$this->add_control(
			'card_source',
			[
				'label'       => __( 'Card source', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'plugin',
				'options'     => [
					'plugin' => __( 'Plugin templates', 'webhead-search-cloud' ),
					'server' => __( 'Search Cloud templates', 'webhead-search-cloud' ),
				],
				'description' => __( "Design templates per content type in the Search Cloud panel's card builder. Any type without a published template there falls back to this plugin's own card.", 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'highlights_source',
			[
				'label'       => __( 'Highlights source', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'newest',
				'options'     => [
					'newest'   => __( 'Newest', 'webhead-search-cloud' ),
					'featured' => __( 'Featured', 'webhead-search-cloud' ),
				],
				'description' => __( 'What the empty-query "highlights" carousel shows. "Featured" only works once a boolean "featured" custom field is pushed for this type (Indexing tab).', 'webhead-search-cloud' ),
			]
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'webhead_search_cloud_modal',
			[ 'label' => __( 'Modal', 'webhead-search-cloud' ) ]
		);

		$this->add_control(
			'modal_animation',
			[
				'label'   => __( 'Open animation', 'webhead-search-cloud' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'fade',
				'options' => [
					'none'       => __( 'None', 'webhead-search-cloud' ),
					'fade'       => __( 'Fade', 'webhead-search-cloud' ),
					'slide-down' => __( 'Slide down', 'webhead-search-cloud' ),
					'slide-up'   => __( 'Slide up', 'webhead-search-cloud' ),
					'zoom'       => __( 'Zoom', 'webhead-search-cloud' ),
				],
			]
		);

		$this->add_control(
			'modal_animation_duration',
			[
				'label'      => __( 'Animation duration (ms)', 'webhead-search-cloud' ),
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
				'label'        => __( 'Keep open while editing', 'webhead-search-cloud' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_on'     => __( 'On', 'webhead-search-cloud' ),
				'label_off'    => __( 'Off', 'webhead-search-cloud' ),
				'return_value' => 'yes',
				'separator'    => 'before',
				'description'  => __( 'Shows the modal in the editor so you can see the Style settings as you change them. Visitors never see it open by itself.', 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'editor_preview_query',
			[
				'label'       => __( 'Preview search', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => __( 'e.g. shirt', 'webhead-search-cloud' ),
				'condition'   => [ 'editor_preview' => 'yes' ],
				'description' => __( 'Runs this search in the preview, so result cards, filters and prices are there to style. Leave empty to style the empty state: recent and popular searches, and the highlights.', 'webhead-search-cloud' ),
			]
		);

		$this->end_controls_section();
	}

	/**
	 * Restrict-to-type options — only the post types actually enabled for
	 * indexing (read from the same `index_config` option the settings screen
	 * and the block's config endpoint use), plus an "All types" default. Falls
	 * back to nothing extra when the option is unset.
	 *
	 * @return array<string,string>
	 */
	private function scope_type_options(): array {
		$options = [ '' => __( 'All types', 'webhead-search-cloud' ) ];
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
	 * Style — Trigger (lives inside {{WRAPPER}}, styled directly)
	 * ------------------------------------------------------------------ */
	private function register_trigger_style_controls(): void {
		$this->start_controls_section(
			'style_trigger',
			[
				'label' => __( 'Trigger', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		// The trigger is an inline box, so the widget's own text alignment
		// places it in the column, in either mode.
		$this->add_responsive_control(
			'trigger_align',
			[
				'label'     => __( 'Alignment', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => [
					'left'   => [ 'title' => __( 'Left', 'webhead-search-cloud' ), 'icon' => 'eicon-text-align-left' ],
					'center' => [ 'title' => __( 'Center', 'webhead-search-cloud' ), 'icon' => 'eicon-text-align-center' ],
					'right'  => [ 'title' => __( 'Right', 'webhead-search-cloud' ), 'icon' => 'eicon-text-align-right' ],
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
		// `.whsc-trigger-icon-button` lives inside the same
		// `[data-webhead-frontend-root]`-tripled block used to outrank the
		// shared frontend reset, which gives it higher specificity than a
		// plain `{{WRAPPER}} .whsc-trigger-icon-button` selector — a direct
		// property here would silently lose to that base rule. Custom
		// properties sidestep the specificity fight entirely: a rule that
		// matches the element directly always wins over an inherited value
		// regardless of specificity.
		$this->add_responsive_control(
			'trigger_icon_size',
			[
				'label'      => __( 'Icon size', 'webhead-search-cloud' ),
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
				'label'     => __( 'Button size', 'webhead-search-cloud' ),
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
				'label'      => __( 'Border radius', 'webhead-search-cloud' ),
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

		$this->start_controls_tab( 'trigger_icon_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->add_control(
			'trigger_icon_color',
			[
				'label'     => __( 'Icon color', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-icon: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_icon_bg',
			[
				'label'     => __( 'Background', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-bg: {{VALUE}};' ],
			]
		);
		$this->end_controls_tab();

		$this->start_controls_tab( 'trigger_icon_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->add_control(
			'trigger_icon_color_hover',
			[
				'label'     => __( 'Icon color', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-icon-button' => '--whsc-trigger-icon-hover: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_icon_bg_hover',
			[
				'label'     => __( 'Background', 'webhead-search-cloud' ),
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
		// writes — both fall back to that shared baseline by default, but
		// setting one must not silently overwrite the other.
		$this->add_responsive_control(
			'trigger_box_width',
			[
				'label'      => __( 'Width', 'webhead-search-cloud' ),
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
				'label'     => __( 'Text color', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::COLOR,
				'condition' => [ 'mode' => 'box' ],
				'separator' => 'before',
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-text: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_box_icon_color',
			[
				'label'     => __( 'Icon color', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::COLOR,
				'condition' => [ 'mode' => 'box' ],
				'selectors' => [ '{{WRAPPER}} .whsc-trigger-box' => '--whsc-trigger-box-icon: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'trigger_box_bg',
			[
				'label'     => __( 'Background color', 'webhead-search-cloud' ),
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
				// container, not the `<input>` itself —
				// `@wordpress/components`' `SearchControl` draws the visible
				// border/box around that shared container, not the input.
				'selector'  => $this->boosted_selector( '{{WRAPPER}} .whsc-trigger-box .components-input-control__container' ),
			]
		);
		$this->add_responsive_control(
			'trigger_box_radius',
			[
				'label'      => __( 'Border radius', 'webhead-search-cloud' ),
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
	 * Style — Modal (general shell)
	 * ------------------------------------------------------------------ */
	private function register_modal_style_controls(): void {
		$this->start_controls_section(
			'style_modal',
			[
				'label' => __( 'Modal', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'modal_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-bg' );
		$this->var_color( 'modal_text', __( 'Text color', 'webhead-search-cloud' ), '--whsc-text' );
		$this->var_color(
			'modal_accent',
			__( 'Accent color', 'webhead-search-cloud' ),
			'--whsc-accent',
			[ 'description' => __( 'Selected states, focus rings, links and the default button colour. Anything set more specifically in another section wins.', 'webhead-search-cloud' ) ]
		);
		$this->var_color(
			'modal_overlay',
			__( 'Overlay', 'webhead-search-cloud' ),
			'--whsc-overlay-bg',
			[ 'description' => __( 'Covers the page behind the open modal. A colour with transparency keeps the page visible.', 'webhead-search-cloud' ) ]
		);

		// A font family only: sizes and weights belong to each part, and a size
		// set here would be overridden by every one of them anyway.
		$this->add_control(
			'modal_font_family',
			[
				'label'       => __( 'Font family', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::FONT,
				'default'     => '',
				'separator'   => 'before',
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-font-family: "{{VALUE}}";' ],
				'description' => __( 'Used by all text in the modal and in the search box trigger. Leave empty to use the page font.', 'webhead-search-cloud' ),
			]
		);

		$this->var_slider( 'modal_radius', __( 'Corner radius', 'webhead-search-cloud' ), '--whsc-radius-panel', 0, 40, false, [ 'separator' => 'before' ] );
		$this->var_slider( 'modal_padding', __( 'Padding', 'webhead-search-cloud' ), '--whsc-padding', 0, 80, true );
		$this->var_slider( 'modal_gap', __( 'Section spacing', 'webhead-search-cloud' ), '--whsc-gap', 0, 80, true );

		// The modal spans the viewport; this caps the content inside it, so on a
		// wide screen it can line up with the site's own container.
		$this->add_responsive_control(
			'modal_content_width',
			[
				'label'       => __( 'Content width', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => [ 'px', '%' ],
				'range'       => [ 'px' => [ 'min' => 480, 'max' => 1920 ], '%' => [ 'min' => 40, 'max' => 100 ] ],
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-content-width: {{SIZE}}{{UNIT}};' ],
				'description' => __( "The widest the content grows inside the full-width modal. Use your theme's container width to line it up with the page.", 'webhead-search-cloud' ),
			]
		);

		$this->add_control(
			'section_title_heading',
			[ 'label' => __( 'Section titles', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'section_title_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'Headings such as "Recent searches", "Popular searches" and the results count. Filter group names have their own, under Filters.', 'webhead-search-cloud' ),
				'content_classes' => 'elementor-descriptor',
			]
		);
		$this->var_color( 'title_color', __( 'Color', 'webhead-search-cloud' ), '--whsc-title-color' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'title_typography',
				'label'    => __( 'Typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-section-title' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Mode tabs (Search / AI Assistant / Product finder). Only drawn
	 * when a second mode is on for the site, and they sit above every mode,
	 * so they are not the assistant's own.
	 * ------------------------------------------------------------------ */
	private function register_tabs_style_controls(): void {
		$this->start_controls_section(
			'style_mode_tabs',
			[
				'label' => __( 'Mode tabs', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'mode_tabs_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The row of tabs above the search box. It only appears when the AI assistant or a guided quiz is on for your site.', 'webhead-search-cloud' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->start_controls_tabs( 'tab_state_tabs' );
		$this->start_controls_tab( 'tab_state_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'tab_text', __( 'Tab text', 'webhead-search-cloud' ), '--whsc-tab-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'tab_state_active', [ 'label' => __( 'Active', 'webhead-search-cloud' ) ] );
		$this->var_color( 'tab_text_active', __( 'Tab text', 'webhead-search-cloud' ), '--whsc-tab-text-active' );
		$this->var_color( 'tab_indicator', __( 'Underline', 'webhead-search-cloud' ), '--whsc-tab-indicator' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_color( 'tab_border', __( 'Divider', 'webhead-search-cloud' ), '--whsc-tab-border', [ 'separator' => 'before' ] );

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'tab_typography',
				'label'    => __( 'Typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-modal-tab' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Search field
	 * ------------------------------------------------------------------ */
	private function register_field_style_controls(): void {
		$this->start_controls_section(
			'style_field',
			[
				'label' => __( 'Search field', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'field_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-input-bg' );
		$this->var_color( 'field_text', __( 'Text color', 'webhead-search-cloud' ), '--whsc-input-text' );
		$this->var_color( 'field_placeholder', __( 'Placeholder color', 'webhead-search-cloud' ), '--whsc-input-placeholder' );
		$this->var_color( 'field_icon', __( 'Icon color', 'webhead-search-cloud' ), '--whsc-input-icon' );

		$this->start_controls_tabs( 'field_border_tabs' );
		$this->start_controls_tab( 'field_border_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'field_border', __( 'Border color', 'webhead-search-cloud' ), '--whsc-input-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'field_border_focus_tab', [ 'label' => __( 'Focus', 'webhead-search-cloud' ) ] );
		$this->var_color( 'field_border_focus', __( 'Border color', 'webhead-search-cloud' ), '--whsc-input-border-focus' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'field_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-input-radius', 0, 999, false, [ 'separator' => 'before' ] );

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
	 * Style — Buttons (submit + icon buttons)
	 * ------------------------------------------------------------------ */
	private function register_button_style_controls(): void {
		$this->start_controls_section(
			'style_buttons',
			[
				'label' => __( 'Buttons', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'submit_heading',
			[ 'label' => __( 'Primary buttons', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING ]
		);
		$this->add_control(
			'submit_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The Search button, "Load more" under the results and the price filter\'s Apply.', 'webhead-search-cloud' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->start_controls_tabs( 'submit_color_tabs' );
		$this->start_controls_tab( 'submit_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'submit_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-btn-bg' );
		$this->var_color( 'submit_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-btn-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'submit_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'submit_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-btn-bg-hover' );
		$this->var_color( 'submit_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-btn-text-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'submit_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-btn-radius', 0, 999, false, [ 'separator' => 'before' ] );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'submit_typography',
				'label'    => __( 'Typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector(
					'.whsc-instance-{{ID}} .whsc-submit-btn',
					'.whsc-instance-{{ID}} .whsc-load-more__button',
					'.whsc-instance-{{ID}} .whsc-range__apply'
				),
			]
		);

		$this->icon_button_controls( 'voice', __( 'Voice button', 'webhead-search-cloud' ), 'voice' );
		$this->icon_button_controls( 'visual', __( 'Photo search button', 'webhead-search-cloud' ), 'visual' );
		$this->icon_button_controls( 'close', __( 'Close button', 'webhead-search-cloud' ), 'close' );
		$this->icon_button_controls( 'clearbtn', __( 'Clear button', 'webhead-search-cloud' ), 'clearbtn' );

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
		$this->start_controls_tab( $prefix . '_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( $prefix . '_color', __( 'Icon color', 'webhead-search-cloud' ), '--whsc-' . $var . '-color' );
		$this->var_color( $prefix . '_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-' . $var . '-bg' );
		$this->end_controls_tab();
		$this->start_controls_tab( $prefix . '_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( $prefix . '_color_hover', __( 'Icon color', 'webhead-search-cloud' ), '--whsc-' . $var . '-color-hover' );
		$this->var_color( $prefix . '_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-' . $var . '-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( $prefix . '_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-' . $var . '-radius', 0, 999 );

		$this->add_responsive_control(
			$prefix . '_padding',
			[
				'label'      => __( 'Padding', 'webhead-search-cloud' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [
					'.whsc-instance-{{ID}}' => '--whsc-' . $var . '-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				],
			]
		);
	}

	/* ---------------------------------------------------------------------
	 * Style — Suggestions dropdown
	 * ------------------------------------------------------------------ */
	private function register_suggestion_style_controls(): void {
		$this->start_controls_section(
			'style_suggestions',
			[
				'label' => __( 'Suggestions', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'suggest_panel_bg', __( 'Panel background', 'webhead-search-cloud' ), '--whsc-panel-bg' );
		$this->var_color( 'suggest_panel_border', __( 'Panel border', 'webhead-search-cloud' ), '--whsc-panel-border' );
		$this->var_slider( 'suggest_panel_radius', __( 'Panel radius', 'webhead-search-cloud' ), '--whsc-panel-radius', 0, 40 );

		$this->start_controls_tabs( 'suggest_item_tabs' );
		$this->start_controls_tab( 'suggest_item_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'suggest_text', __( 'Item text', 'webhead-search-cloud' ), '--whsc-suggestion-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'suggest_item_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'suggest_text_hover', __( 'Item text', 'webhead-search-cloud' ), '--whsc-suggestion-text-hover' );
		$this->var_color( 'suggest_bg_hover', __( 'Item background', 'webhead-search-cloud' ), '--whsc-suggestion-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'suggest_typography',
				'label'    => __( 'Item typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-suggestion' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Recent & popular
	 * ------------------------------------------------------------------ */
	private function register_browse_style_controls(): void {
		$this->start_controls_section(
			'style_browse',
			[
				'label' => __( 'Recent & popular', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'chip_heading',
			[ 'label' => __( 'Recent chips', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING ]
		);
		$this->start_controls_tabs( 'chip_tabs' );
		$this->start_controls_tab( 'chip_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'chip_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-chip-bg' );
		$this->var_color( 'chip_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-chip-text' );
		$this->var_color( 'chip_border', __( 'Border', 'webhead-search-cloud' ), '--whsc-chip-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'chip_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'chip_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-chip-bg-hover' );
		$this->var_color( 'chip_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-chip-text-hover' );
		$this->var_color( 'chip_border_hover', __( 'Border', 'webhead-search-cloud' ), '--whsc-chip-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'chip_radius', __( 'Radius', 'webhead-search-cloud' ), '--whsc-chip-radius', 0, 999 );

		$this->add_control(
			'clear_heading',
			[ 'label' => __( '"Clear all" link', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'clear_tabs' );
		$this->start_controls_tab( 'clear_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'clear_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-clear-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'clear_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'clear_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-clear-text-hover' );
		$this->var_color( 'clear_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-clear-bg-hover' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'clear_active', [ 'label' => __( 'Active', 'webhead-search-cloud' ) ] );
		$this->var_color( 'clear_text_active', __( 'Text', 'webhead-search-cloud' ), '--whsc-clear-text-active' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->add_responsive_control(
			'clear_padding',
			[
				'label'      => __( 'Padding', 'webhead-search-cloud' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => '--whsc-clear-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};' ],
			]
		);

		$this->add_control(
			'popular_heading',
			[ 'label' => __( 'Popular items', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'popular_tabs' );
		$this->start_controls_tab( 'popular_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'popular_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-popular-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'popular_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'popular_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-popular-text-hover' );
		$this->var_color( 'popular_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-popular-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'popular_gap', __( 'Spacing between items', 'webhead-search-cloud' ), '--whsc-popular-gap', 0, 24, true );
		$this->var_slider( 'popular_radius', __( 'Item radius', 'webhead-search-cloud' ), '--whsc-popular-radius', 0, 40 );
		$this->add_responsive_control(
			'popular_padding',
			[
				'label'      => __( 'Item padding', 'webhead-search-cloud' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => [ 'px' ],
				'selectors'  => [ '.whsc-instance-{{ID}}' => '--whsc-popular-padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};' ],
			]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'popular_typography',
				'label'    => __( 'Popular typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-popular-item' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Filters: the content-type chips and every facet group
	 * (categories, brands, ...) share one look.
	 * ------------------------------------------------------------------ */
	private function register_facet_style_controls(): void {
		$this->start_controls_section(
			'style_facets',
			[
				'label' => __( 'Filters', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->start_controls_tabs( 'facet_tabs' );
		$this->start_controls_tab( 'facet_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'facet_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-facet-bg' );
		$this->var_color( 'facet_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-facet-text' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'facet_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'facet_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-facet-bg-hover' );
		$this->var_color( 'facet_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-facet-text-hover' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'facet_active', [ 'label' => __( 'Active', 'webhead-search-cloud' ) ] );
		$this->var_color( 'facet_bg_active', __( 'Background', 'webhead-search-cloud' ), '--whsc-facet-bg-active' );
		$this->var_color( 'facet_text_active', __( 'Text', 'webhead-search-cloud' ), '--whsc-facet-text-active' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'facet_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-facet-radius', 0, 999, false, [ 'separator' => 'before' ] );
		$this->var_slider( 'facets_max_height', __( 'Max height', 'webhead-search-cloud' ), '--whsc-facets-max-height', 60, 400, false, [ 'description' => __( 'Caps a long filter list and lets it scroll instead of stretching the modal.', 'webhead-search-cloud' ) ] );

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_typography',
				'label'    => __( 'Label typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet__label' ),
			]
		);

		$this->add_control(
			'facet_count_heading',
			[ 'label' => __( 'Result count', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'facet_count_color', __( 'Count color', 'webhead-search-cloud' ), '--whsc-facet-count' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_count_typography',
				'label'    => __( 'Count typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet__count' ),
			]
		);

		$this->add_control(
			'facet_group_heading',
			[ 'label' => __( 'Group names', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'facet_group_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'The small title above each group of filters, such as "Categories" or "Price".', 'webhead-search-cloud' ),
				'content_classes' => 'elementor-descriptor',
			]
		);
		// By default the label is the section title colour at 70% opacity; a
		// colour picked for it is used as picked, so the opacity goes with it.
		$this->var_color(
			'facet_group_color',
			__( 'Color', 'webhead-search-cloud' ),
			'--whsc-facet-group-label',
			[ 'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-facet-group-label: {{VALUE}}; --whsc-facet-group-label-opacity: 1;' ] ]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'facet_group_typography',
				'label'    => __( 'Typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-facet-group__label' ),
			]
		);

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — the assistant pane. Shown only when the plan includes the
	 * assistant, but the controls are always available so a site can theme it
	 * ahead of enabling it.
	 * ------------------------------------------------------------------ */
	private function register_assistant_style_controls(): void {
		$this->start_controls_section(
			'style_assistant',
			[
				'label' => __( 'AI Assistant', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'assistant_accent', __( 'Accent (avatar, dots)', 'webhead-search-cloud' ), '--whsc-assistant-accent' );
		$this->var_color( 'assistant_text', __( 'Reply text', 'webhead-search-cloud' ), '--whsc-assistant-text' );
		$this->var_color( 'assistant_user_bg', __( 'Your message background', 'webhead-search-cloud' ), '--whsc-assistant-user-bg' );
		$this->var_color( 'assistant_user_text', __( 'Your message text', 'webhead-search-cloud' ), '--whsc-assistant-user-text' );
		$this->var_color( 'assistant_row_bg', __( 'Compare row shading', 'webhead-search-cloud' ), '--whsc-assistant-row-bg' );
		$this->var_slider( 'assistant_input_radius', __( 'Message field radius', 'webhead-search-cloud' ), '--whsc-assistant-input-radius', 0, 999, false, [ 'separator' => 'before' ] );

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
				'label' => __( 'Promotional banner', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'banner_note',
			[
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => __( 'Shown above the results when a merchandising rule attaches a banner to the search.', 'webhead-search-cloud' ),
				'content_classes' => 'elementor-descriptor',
			]
		);

		$this->var_color( 'banner_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-banner-bg' );
		$this->var_color( 'banner_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-banner-text' );

		$this->end_controls_section();
	}

	private function register_quiz_style_controls(): void {
		$this->start_controls_section(
			'style_quiz',
			[
				'label' => __( 'Guided quiz', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'quiz_question', __( 'Question text', 'webhead-search-cloud' ), '--whsc-quiz-question' );

		$this->add_control(
			'quiz_option_heading',
			[ 'label' => __( 'Answers', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);

		$this->start_controls_tabs( 'quiz_option_tabs' );
		$this->start_controls_tab( 'quiz_option_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'quiz_option_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-quiz-option-bg' );
		$this->var_color( 'quiz_option_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-quiz-option-text' );
		$this->var_color( 'quiz_option_border', __( 'Border', 'webhead-search-cloud' ), '--whsc-quiz-option-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'quiz_option_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'quiz_option_bg_hover', __( 'Background', 'webhead-search-cloud' ), '--whsc-quiz-option-bg-hover' );
		$this->var_color( 'quiz_option_text_hover', __( 'Text', 'webhead-search-cloud' ), '--whsc-quiz-option-text-hover' );
		$this->var_color( 'quiz_option_border_hover', __( 'Border', 'webhead-search-cloud' ), '--whsc-quiz-option-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'quiz_option_radius', __( 'Answer radius', 'webhead-search-cloud' ), '--whsc-quiz-option-radius', 0, 999, false, [ 'separator' => 'before' ] );

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Result cards
	 * ------------------------------------------------------------------ */
	private function register_card_style_controls(): void {
		$this->start_controls_section(
			'style_cards',
			[
				'label' => __( 'Result cards', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_color( 'card_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-card-bg' );

		$this->start_controls_tabs( 'card_border_tabs' );
		$this->start_controls_tab( 'card_border_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'card_border', __( 'Border', 'webhead-search-cloud' ), '--whsc-card-border' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'card_border_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'card_border_hover', __( 'Border', 'webhead-search-cloud' ), '--whsc-card-border-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->var_slider( 'card_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-card-radius', 0, 40, false, [ 'separator' => 'before' ] );
		$this->var_slider( 'card_padding', __( 'Padding', 'webhead-search-cloud' ), '--whsc-card-padding', 0, 40, true );

		$this->add_control(
			'card_image_heading',
			[ 'label' => __( 'Image', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->add_control(
			'card_image_ratio',
			[
				'label'     => __( 'Aspect ratio', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => [
					''       => __( 'Square (default)', 'webhead-search-cloud' ),
					'4 / 5'  => __( 'Portrait 4:5', 'webhead-search-cloud' ),
					'3 / 4'  => __( 'Portrait 3:4', 'webhead-search-cloud' ),
					'2 / 3'  => __( 'Tall 2:3', 'webhead-search-cloud' ),
					'4 / 3'  => __( 'Landscape 4:3', 'webhead-search-cloud' ),
					'16 / 9' => __( 'Wide 16:9', 'webhead-search-cloud' ),
				],
				'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-card-image-ratio: {{VALUE}};' ],
			]
		);
		$this->add_control(
			'card_image_fit',
			[
				'label'       => __( 'Fit', 'webhead-search-cloud' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => [
					''        => __( 'Fill and crop (default)', 'webhead-search-cloud' ),
					'contain' => __( 'Show the whole image', 'webhead-search-cloud' ),
				],
				'description' => __( '"Show the whole image" keeps packshots on a plain background uncropped; the background below fills the space around them.', 'webhead-search-cloud' ),
				'selectors'   => [ '.whsc-instance-{{ID}}' => '--whsc-card-image-fit: {{VALUE}};' ],
			]
		);
		$this->var_color( 'card_image_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-card-image-bg' );
		$this->var_slider( 'card_image_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-card-image-radius', 0, 40 );

		$this->add_control(
			'card_badge_heading',
			[ 'label' => __( 'Sale badge', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'card_badge_bg', __( 'Background', 'webhead-search-cloud' ), '--whsc-badge-bg' );
		$this->var_color( 'card_badge_text', __( 'Text', 'webhead-search-cloud' ), '--whsc-badge-text' );
		$this->var_slider( 'card_badge_radius', __( 'Border radius', 'webhead-search-cloud' ), '--whsc-badge-radius', 0, 999 );

		$this->add_control(
			'card_text_heading',
			[ 'label' => __( 'Title and price', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'card_title_color', __( 'Title color', 'webhead-search-cloud' ), '--whsc-card-title' );
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_title_typography',
				'label'    => __( 'Title typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__title' ),
			]
		);
		$this->var_color( 'card_price_color', __( 'Price / meta color', 'webhead-search-cloud' ), '--whsc-price-color' );
		// The amount itself is `.whsc-card__price-current`, which sets its own
		// weight, so a weight set on the price line alone never reached it.
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_price_typography',
				'label'    => __( 'Price typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__price', '.whsc-instance-{{ID}} .whsc-card__price-current' ),
			]
		);
		$this->add_group_control(
			Group_Control_Typography::get_type(),
			[
				'name'     => 'card_price_suffix_typography',
				'label'    => __( 'Price suffix / "from" typography', 'webhead-search-cloud' ),
				'selector' => $this->boosted_selector( '.whsc-instance-{{ID}} .whsc-card__price-suffix', '.whsc-instance-{{ID}} .whsc-card__price-from' ),
			]
		);

		$this->add_control(
			'card_stock_heading',
			[ 'label' => __( 'Stock status', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->var_color( 'card_stock_in_color', __( 'In stock', 'webhead-search-cloud' ), '--whsc-stock-in-color' );
		$this->var_color( 'card_stock_out_color', __( 'Out of stock', 'webhead-search-cloud' ), '--whsc-stock-out-color' );

		$this->end_controls_section();
	}

	/* ---------------------------------------------------------------------
	 * Style — Carousel
	 * ------------------------------------------------------------------ */
	private function register_carousel_style_controls(): void {
		$this->start_controls_section(
			'style_carousel',
			[
				'label' => __( 'Carousel', 'webhead-search-cloud' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			]
		);

		$this->var_slider(
			'carousel_card_width',
			__( 'Card width', 'webhead-search-cloud' ),
			'--whsc-card-width',
			100,
			480,
			true,
			[ 'description' => __( 'How wide each result card is, and so how many fit side by side. Set it per device with the responsive switch.', 'webhead-search-cloud' ) ]
		);
		$this->var_slider( 'carousel_gap', __( 'Spacing between items', 'webhead-search-cloud' ), '--whsc-carousel-gap', 0, 48, true );
		$this->add_control(
			'arrow_heading',
			[ 'label' => __( 'Arrows', 'webhead-search-cloud' ), 'type' => Controls_Manager::HEADING, 'separator' => 'before' ]
		);
		$this->start_controls_tabs( 'arrow_tabs' );
		$this->start_controls_tab( 'arrow_normal', [ 'label' => __( 'Normal', 'webhead-search-cloud' ) ] );
		$this->var_color( 'arrow_color', __( 'Arrow color', 'webhead-search-cloud' ), '--whsc-arrow-color' );
		$this->var_color( 'arrow_bg', __( 'Arrow background', 'webhead-search-cloud' ), '--whsc-arrow-bg' );
		$this->end_controls_tab();
		$this->start_controls_tab( 'arrow_hover', [ 'label' => __( 'Hover', 'webhead-search-cloud' ) ] );
		$this->var_color( 'arrow_color_hover', __( 'Arrow color', 'webhead-search-cloud' ), '--whsc-arrow-color-hover' );
		$this->var_color( 'arrow_bg_hover', __( 'Arrow background', 'webhead-search-cloud' ), '--whsc-arrow-bg-hover' );
		$this->end_controls_tab();
		$this->end_controls_tabs();
		$this->var_slider( 'arrow_size', __( 'Arrow size', 'webhead-search-cloud' ), '--whsc-arrow-size', 24, 64, true, [ 'separator' => 'before' ] );
		$this->var_slider( 'arrow_radius', __( 'Arrow radius', 'webhead-search-cloud' ), '--whsc-arrow-radius', 0, 999 );
		$this->add_control(
			'arrow_shadow',
			[
				'label'     => __( 'Arrow shadow', 'webhead-search-cloud' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => [
					''     => __( 'Soft (default)', 'webhead-search-cloud' ),
					'none' => __( 'None', 'webhead-search-cloud' ),
				],
				'selectors' => [ '.whsc-instance-{{ID}}' => '--whsc-arrow-shadow: {{VALUE}};' ],
			]
		);
		$this->var_color( 'dot_color', __( 'Dot color', 'webhead-search-cloud' ), '--whsc-dot-color', [ 'separator' => 'before' ] );
		$this->var_color( 'dot_color_active', __( 'Dot color (active)', 'webhead-search-cloud' ), '--whsc-dot-color-active' );

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
	 * Control helpers — set a CSS custom property on the per-instance class,
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
	 * `$this->id` — keeping the `.whsc-instance-{id}` class matched to the ID
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
	 * default glyph is used) — shared between `trigger_icon` and `voice_icon`.
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
		if ( 'yes' !== ( $settings['editor_preview'] ?? '' ) || ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}

		$elementor = \Elementor\Plugin::$instance;

		return ( isset( $elementor->editor ) && $elementor->editor->is_edit_mode() )
			|| ( isset( $elementor->preview ) && $elementor->preview->is_preview_mode() );
	}

	protected function render(): void {
		$settings = $this->get_settings_for_display();

		Frontend_Assets::enqueue();

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
				'editorPreview' => $this->is_editor_preview( $settings ),
				'editorQuery'   => (string) ( $settings['editor_preview_query'] ?? '' ),
			]
		);
		// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
