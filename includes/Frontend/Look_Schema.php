<?php
/**
 * Every style setting of the search the Placement tab offers, in groups.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * The style settings of the Elementor Search widget, for what the Placement
 * tab places: the shortcode, the classic widget, a search form taken over and
 * the floating button. Each writes the custom property or the rule the widget
 * writes, under the same words, so a shop styles both the same way and the
 * translations of the widget serve here too.
 *
 * A control is one of:
 *
 * - `color`: a colour on `property`, in the `state` it belongs to.
 * - `size`: a number of `unit` on `property`, between `min` and `max`, per
 *   device when `responsive`.
 * - `spacing`: four numbers of px (top, right, bottom, left) on `property`, per device.
 * - `choice`: one of `options`, written as is on `property`; '' writes nothing.
 * - `toggle`: on writes `value` on `property`.
 * - `font`: a font family on `property`.
 * - `border`: a style, a width and a colour on `selectors`.
 * - `typography`: family, size, weight, slant, case, line, line height and
 *   spacing of letters on `selectors`, sizes per device.
 *
 * `{instance}` in a selector is the surface's instance class, which the
 * trigger and the window it opens both carry. `heading` is the widget's
 * heading over a run of controls, where it has one.
 *
 * @since 1.3.2
 */
final class Look_Schema {
	/** Elementor's tablet breakpoint: the widest a tablet's value applies at. */
	public const TABLET = 1024;

	/** Elementor's phone breakpoint. */
	public const PHONE = 767;

	public const DEVICES = [ 'desktop', 'tablet', 'mobile' ];

	public const STATES = [ 'normal', 'hover', 'active', 'focus' ];

	/** What the widget adds to a selector so a theme's rule does not outweigh it. */
	public const BOOST = ':not(#whsc#whsc#whsc#whsc)';

	/** @var array<int, array<string, mixed>>|null */
	private static ?array $groups = null;

	/** @var array<string, array<string, mixed>>|null */
	private static ?array $controls = null;

	/**
	 * The groups, in the editor's order, each `{ id, label, controls }`.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function groups(): array {
		return self::$groups ??= self::build();
	}

	/**
	 * Every control by id.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function controls(): array {
		if ( null === self::$controls ) {
			self::$controls = [];

			foreach ( self::groups() as $group ) {
				foreach ( $group['controls'] as $control ) {
					self::$controls[ $control['id'] ] = $control;
				}
			}
		}

		return self::$controls;
	}

	/**
	 * Forgets the groups, so labels are built again in the language of the
	 * next request. Tests switch languages between calls.
	 */
	public static function reset(): void {
		self::$groups   = null;
		self::$controls = null;
	}

	/** @return array<int, array<string, mixed>> */
	private static function build(): array {
		return [
			[
				'id'       => 'trigger',
				'label'    => __( 'Trigger', 'searcio' ),
				'controls' => [
					self::size( 'trigger_icon_size', __( 'Icon size', 'searcio' ), '--whsc-trigger-icon-size', 12, 60, true, 'px', [ 'mode' => 'icon' ] ),
					self::size( 'trigger_box_size', __( 'Button size', 'searcio' ), '--whsc-trigger-size', 28, 96, true, 'px', [ 'mode' => 'icon' ] ),
					self::size( 'trigger_radius', __( 'Border radius', 'searcio' ), '--whsc-trigger-radius', 0, 100, true, 'px', [ 'mode' => 'icon' ] ),
					self::color( 'trigger_icon_color', __( 'Icon color', 'searcio' ), '--whsc-trigger-icon', 'normal', [ 'mode' => 'icon' ] ),
					self::color( 'trigger_icon_bg', __( 'Background', 'searcio' ), '--whsc-trigger-bg', 'normal', [ 'mode' => 'icon' ] ),
					self::color( 'trigger_icon_color_hover', __( 'Icon color', 'searcio' ), '--whsc-trigger-icon-hover', 'hover', [ 'mode' => 'icon' ] ),
					self::color( 'trigger_icon_bg_hover', __( 'Background', 'searcio' ), '--whsc-trigger-bg-hover', 'hover', [ 'mode' => 'icon' ] ),
					self::color( 'trigger_box_text', __( 'Text color', 'searcio' ), '--whsc-trigger-box-text', 'normal', [ 'mode' => 'box' ] ),
					self::color( 'trigger_box_icon_color', __( 'Icon color', 'searcio' ), '--whsc-trigger-box-icon', 'normal', [ 'mode' => 'box' ] ),
					self::color( 'trigger_box_bg', __( 'Background color', 'searcio' ), '--whsc-trigger-box-bg', 'normal', [ 'mode' => 'box' ] ),
					self::border( 'trigger_box_border', __( 'Border', 'searcio' ), [ '{instance} .whsc-trigger-box .components-input-control__backdrop' ], [ 'mode' => 'box' ] ),
					self::size( 'trigger_box_radius', __( 'Border radius', 'searcio' ), '--whsc-trigger-box-radius', 0, 100, true, 'px', [ 'mode' => 'box' ] ),
					self::typography( 'trigger_box_typography', __( 'Typography', 'searcio' ), [ '{instance} .whsc-trigger-box input' ], [ 'mode' => 'box' ] ),
				],
			],
			[
				'id'       => 'modal',
				'label'    => __( 'Modal', 'searcio' ),
				'controls' => [
					self::color( 'modal_bg', __( 'Background', 'searcio' ), '--whsc-bg' ),
					self::color( 'modal_text', __( 'Text color', 'searcio' ), '--whsc-text' ),
					self::color( 'modal_accent', __( 'Accent color', 'searcio' ), '--whsc-accent' ),
					self::color( 'modal_overlay', __( 'Overlay', 'searcio' ), '--whsc-overlay-bg' ),
					self::font( 'modal_font_family', __( 'Font family', 'searcio' ), '--whsc-font-family' ),
					self::size( 'modal_radius', __( 'Corner radius', 'searcio' ), '--whsc-radius-panel', 0, 40 ),
					self::toggle( 'modal_round_top', __( 'Round the top corners too', 'searcio' ), '--whsc-radius-panel-top', 'var(--whsc-radius-panel)' ),
					self::size( 'modal_padding', __( 'Padding', 'searcio' ), '--whsc-padding', 0, 80, true ),
					self::size( 'modal_gap', __( 'Section spacing', 'searcio' ), '--whsc-gap', 0, 80, true ),
					self::size( 'modal_width', __( 'Modal width', 'searcio' ), '--whsc-modal-width', 320, 1920, true ),
					self::size( 'modal_offset', __( 'Distance from top', 'searcio' ), '--whsc-modal-offset', 0, 200, true ),
					self::size( 'modal_content_width', __( 'Content width', 'searcio' ), '--whsc-content-width', 480, 1920, true ),
					...self::under(
						__( 'Section titles', 'searcio' ),
						[
							self::color( 'title_color', __( 'Color', 'searcio' ), '--whsc-title-color' ),
							self::typography( 'title_typography', __( 'Typography', 'searcio' ), [ '{instance} .whsc-section-title' ] ),
						]
					),
				],
			],
			[
				'id'       => 'tabs',
				'label'    => __( 'Mode tabs', 'searcio' ),
				'controls' => [
					self::color( 'tab_text', __( 'Tab text', 'searcio' ), '--whsc-tab-text' ),
					self::color( 'tab_text_active', __( 'Tab text', 'searcio' ), '--whsc-tab-text-active', 'active' ),
					self::color( 'tab_indicator', __( 'Underline', 'searcio' ), '--whsc-tab-indicator', 'active' ),
					self::color( 'tab_border', __( 'Divider', 'searcio' ), '--whsc-tab-border' ),
					self::typography( 'tab_typography', __( 'Typography', 'searcio' ), [ '{instance} .whsc-modal-tab' ] ),
				],
			],
			[
				'id'       => 'field',
				'label'    => __( 'Search field', 'searcio' ),
				'controls' => [
					self::color( 'field_bg', __( 'Background', 'searcio' ), '--whsc-input-bg' ),
					self::color( 'field_text', __( 'Text color', 'searcio' ), '--whsc-input-text' ),
					self::color( 'field_placeholder', __( 'Placeholder color', 'searcio' ), '--whsc-input-placeholder' ),
					self::color( 'field_icon', __( 'Icon color', 'searcio' ), '--whsc-input-icon' ),
					self::color( 'field_border', __( 'Border color', 'searcio' ), '--whsc-input-border' ),
					self::color( 'field_border_focus', __( 'Border color', 'searcio' ), '--whsc-input-border-focus', 'focus' ),
					self::size( 'field_radius', __( 'Border radius', 'searcio' ), '--whsc-input-radius', 0, 999 ),
					self::typography( 'field_typography', __( 'Typography', 'searcio' ), [ '.whsc-modal{instance} .whsc-search-input__field' ] ),
				],
			],
			[
				'id'       => 'buttons',
				'label'    => __( 'Buttons', 'searcio' ),
				'controls' => array_merge(
					self::under(
						__( 'Primary buttons', 'searcio' ),
						[
							self::color( 'submit_bg', __( 'Background', 'searcio' ), '--whsc-btn-bg' ),
							self::color( 'submit_text', __( 'Text', 'searcio' ), '--whsc-btn-text' ),
							self::color( 'submit_bg_hover', __( 'Background', 'searcio' ), '--whsc-btn-bg-hover', 'hover' ),
							self::color( 'submit_text_hover', __( 'Text', 'searcio' ), '--whsc-btn-text-hover', 'hover' ),
							self::size( 'submit_radius', __( 'Border radius', 'searcio' ), '--whsc-btn-radius', 0, 999 ),
							self::typography( 'submit_typography', __( 'Typography', 'searcio' ), [ '{instance} .whsc-load-more__button', '{instance} .whsc-range__apply' ] ),
						]
					),
					self::icon_button( 'voice', __( 'Voice button', 'searcio' ) ),
					self::icon_button( 'visual', __( 'Photo search button', 'searcio' ) ),
					self::icon_button( 'close', __( 'Close button', 'searcio' ) ),
					self::icon_button( 'clearbtn', __( 'Clear button', 'searcio' ) )
				),
			],
			[
				'id'       => 'suggestions',
				'label'    => __( 'Suggestions', 'searcio' ),
				'controls' => [
					self::color( 'suggest_panel_bg', __( 'Panel background', 'searcio' ), '--whsc-panel-bg' ),
					self::color( 'suggest_panel_border', __( 'Panel border', 'searcio' ), '--whsc-panel-border' ),
					self::size( 'suggest_panel_radius', __( 'Panel radius', 'searcio' ), '--whsc-panel-radius', 0, 40 ),
					self::color( 'suggest_text', __( 'Item text', 'searcio' ), '--whsc-suggestion-text' ),
					self::color( 'suggest_text_hover', __( 'Item text', 'searcio' ), '--whsc-suggestion-text-hover', 'hover' ),
					self::color( 'suggest_bg_hover', __( 'Item background', 'searcio' ), '--whsc-suggestion-bg-hover', 'hover' ),
					self::typography( 'suggest_typography', __( 'Item typography', 'searcio' ), [ '{instance} .whsc-suggestion' ] ),
				],
			],
			[
				'id'       => 'browse',
				'label'    => __( 'Recent & popular', 'searcio' ),
				'controls' => [
					...self::under(
						__( 'Recent chips', 'searcio' ),
						[
							self::color( 'chip_bg', __( 'Background', 'searcio' ), '--whsc-chip-bg' ),
							self::color( 'chip_text', __( 'Text', 'searcio' ), '--whsc-chip-text' ),
							self::color( 'chip_border', __( 'Border', 'searcio' ), '--whsc-chip-border' ),
							self::color( 'chip_bg_hover', __( 'Background', 'searcio' ), '--whsc-chip-bg-hover', 'hover' ),
							self::color( 'chip_text_hover', __( 'Text', 'searcio' ), '--whsc-chip-text-hover', 'hover' ),
							self::color( 'chip_border_hover', __( 'Border', 'searcio' ), '--whsc-chip-border-hover', 'hover' ),
							self::size( 'chip_radius', __( 'Radius', 'searcio' ), '--whsc-chip-radius', 0, 999 ),
						]
					),
					...self::under(
						__( '"Clear all" link', 'searcio' ),
						[
							self::color( 'clear_text', __( 'Text', 'searcio' ), '--whsc-clear-text' ),
							self::color( 'clear_text_hover', __( 'Text', 'searcio' ), '--whsc-clear-text-hover', 'hover' ),
							self::color( 'clear_bg_hover', __( 'Background', 'searcio' ), '--whsc-clear-bg-hover', 'hover' ),
							self::color( 'clear_text_active', __( 'Text', 'searcio' ), '--whsc-clear-text-active', 'active' ),
							self::spacing( 'clear_padding', __( 'Padding', 'searcio' ), '--whsc-clear-padding' ),
						]
					),
					...self::under(
						__( 'Popular items', 'searcio' ),
						[
							self::color( 'popular_text', __( 'Text', 'searcio' ), '--whsc-popular-text' ),
							self::color( 'popular_text_hover', __( 'Text', 'searcio' ), '--whsc-popular-text-hover', 'hover' ),
							self::color( 'popular_bg_hover', __( 'Background', 'searcio' ), '--whsc-popular-bg-hover', 'hover' ),
							self::size( 'popular_gap', __( 'Spacing between items', 'searcio' ), '--whsc-popular-gap', 0, 24, true ),
							self::size( 'popular_radius', __( 'Item radius', 'searcio' ), '--whsc-popular-radius', 0, 40 ),
							self::spacing( 'popular_padding', __( 'Item padding', 'searcio' ), '--whsc-popular-padding' ),
							self::typography( 'popular_typography', __( 'Popular typography', 'searcio' ), [ '{instance} .whsc-popular-item' ] ),
						]
					),
				],
			],
			[
				'id'       => 'facets',
				'label'    => __( 'Filters', 'searcio' ),
				'controls' => [
					self::color( 'facet_bg', __( 'Background', 'searcio' ), '--whsc-facet-bg' ),
					self::color( 'facet_text', __( 'Text', 'searcio' ), '--whsc-facet-text' ),
					self::color( 'facet_bg_hover', __( 'Background', 'searcio' ), '--whsc-facet-bg-hover', 'hover' ),
					self::color( 'facet_text_hover', __( 'Text', 'searcio' ), '--whsc-facet-text-hover', 'hover' ),
					self::color( 'facet_bg_active', __( 'Background', 'searcio' ), '--whsc-facet-bg-active', 'active' ),
					self::color( 'facet_text_active', __( 'Text', 'searcio' ), '--whsc-facet-text-active', 'active' ),
					self::size( 'facet_radius', __( 'Border radius', 'searcio' ), '--whsc-facet-radius', 0, 999 ),
					self::size( 'filter_height', __( 'Button height', 'searcio' ), '--whsc-filter-height', 32, 64, true ),
					self::size( 'facets_max_height', __( 'Max height', 'searcio' ), '--whsc-facets-max-height', 60, 600 ),
					self::typography( 'facet_typography', __( 'Label typography', 'searcio' ), [ '{instance} .whsc-facet__label' ] ),
					...self::under(
						__( 'Count on "All filters"', 'searcio' ),
						[
							self::color( 'filter_badge_bg', __( 'Background', 'searcio' ), '--whsc-filter-badge-bg' ),
							self::color( 'filter_badge_text', __( 'Text', 'searcio' ), '--whsc-filter-badge-text' ),
						]
					),
					...self::under(
						__( 'Filter panels', 'searcio' ),
						[
							self::size( 'popover_width', __( 'Popover width', 'searcio' ), '--whsc-popover-width', 260, 560 ),
							self::size( 'popover_radius', __( 'Popover radius', 'searcio' ), '--whsc-popover-radius', 0, 40 ),
							self::size( 'drawer_width', __( '"All filters" width', 'searcio' ), '--whsc-drawer-width', 300, 640 ),
							self::size( 'sheet_radius', __( 'Phone sheet radius', 'searcio' ), '--whsc-sheet-radius', 0, 40 ),
						]
					),
					...self::under(
						__( 'Result count', 'searcio' ),
						[
							self::color( 'facet_count_color', __( 'Count color', 'searcio' ), '--whsc-facet-count' ),
							self::typography( 'facet_count_typography', __( 'Count typography', 'searcio' ), [ '{instance} .whsc-facet__count' ] ),
						]
					),
					...self::under(
						__( 'Group names', 'searcio' ),
						[
							self::color( 'facet_group_color', __( 'Color', 'searcio' ), '--whsc-facet-group-label', 'normal', [], [ '--whsc-facet-group-label-opacity' => '1' ] ),
							self::typography( 'facet_group_typography', __( 'Typography', 'searcio' ), [ '{instance} .whsc-facet-group__label' ] ),
						]
					),
				],
			],
			[
				'id'       => 'cards',
				'label'    => __( 'Result cards', 'searcio' ),
				'controls' => [
					self::color( 'card_bg', __( 'Background', 'searcio' ), '--whsc-card-bg' ),
					self::color( 'card_border', __( 'Border', 'searcio' ), '--whsc-card-border' ),
					self::color( 'card_border_hover', __( 'Border', 'searcio' ), '--whsc-card-border-hover', 'hover' ),
					self::size( 'card_radius', __( 'Border radius', 'searcio' ), '--whsc-card-radius', 0, 40 ),
					self::size( 'card_padding', __( 'Padding', 'searcio' ), '--whsc-card-padding', 0, 40, true ),
					...self::under(
						__( 'Image', 'searcio' ),
						[
							self::choice(
								'card_image_ratio',
								__( 'Aspect ratio', 'searcio' ),
								'--whsc-card-image-ratio',
								[
									''       => __( 'Square (default)', 'searcio' ),
									'4 / 5'  => __( 'Portrait 4:5', 'searcio' ),
									'3 / 4'  => __( 'Portrait 3:4', 'searcio' ),
									'2 / 3'  => __( 'Tall 2:3', 'searcio' ),
									'4 / 3'  => __( 'Landscape 4:3', 'searcio' ),
									'16 / 9' => __( 'Wide 16:9', 'searcio' ),
								]
							),
							self::choice(
								'card_image_fit',
								__( 'Fit', 'searcio' ),
								'--whsc-card-image-fit',
								[
									''        => __( 'Fill and crop (default)', 'searcio' ),
									'contain' => __( 'Show the whole image', 'searcio' ),
								]
							),
							self::color( 'card_image_bg', __( 'Background', 'searcio' ), '--whsc-card-image-bg' ),
							self::size( 'card_image_radius', __( 'Border radius', 'searcio' ), '--whsc-card-image-radius', 0, 40 ),
						]
					),
					...self::under(
						__( 'Sale badge', 'searcio' ),
						[
							self::color( 'card_badge_bg', __( 'Background', 'searcio' ), '--whsc-badge-bg' ),
							self::color( 'card_badge_text', __( 'Text', 'searcio' ), '--whsc-badge-text' ),
							self::size( 'card_badge_radius', __( 'Border radius', 'searcio' ), '--whsc-badge-radius', 0, 999 ),
						]
					),
					...self::under(
						__( 'Title and price', 'searcio' ),
						[
							self::color( 'card_title_color', __( 'Title color', 'searcio' ), '--whsc-card-title' ),
							self::typography( 'card_title_typography', __( 'Title typography', 'searcio' ), [ '{instance} .whsc-card__title' ] ),
							self::size( 'card_title_lines', __( 'Title lines', 'searcio' ), '--whsc-card-title-lines', 1, 5, false, '' ),
							self::color( 'card_price_color', __( 'Price / meta color', 'searcio' ), '--whsc-price-color' ),
							self::typography( 'card_price_typography', __( 'Price typography', 'searcio' ), [ '{instance} .whsc-card__price', '{instance} .whsc-card__price-current' ] ),
							self::typography( 'card_price_suffix_typography', __( 'Price suffix / "from" typography', 'searcio' ), [ '{instance} .whsc-card__price-suffix', '{instance} .whsc-card__price-from' ] ),
						]
					),
					...self::under(
						__( 'Stock status', 'searcio' ),
						[
							self::choice(
								'card_stock_display',
								__( 'Show', 'searcio' ),
								'--whsc-card-stock-display',
								[
									''     => __( 'Show (default)', 'searcio' ),
									'none' => __( 'Hide', 'searcio' ),
								]
							),
							self::color( 'card_stock_in_color', __( 'In stock', 'searcio' ), '--whsc-stock-in-color' ),
							self::color( 'card_stock_out_color', __( 'Out of stock', 'searcio' ), '--whsc-stock-out-color' ),
						]
					),
				],
			],
			[
				'id'       => 'carousel',
				'label'    => __( 'Carousel', 'searcio' ),
				'controls' => [
					self::size( 'carousel_card_width', __( 'Card width', 'searcio' ), '--whsc-card-width', 100, 480, true ),
					self::size( 'carousel_gap', __( 'Spacing between items', 'searcio' ), '--whsc-carousel-gap', 0, 48, true ),
					...self::under(
						__( 'Arrows', 'searcio' ),
						[
							self::color( 'arrow_color', __( 'Arrow color', 'searcio' ), '--whsc-arrow-color' ),
							self::color( 'arrow_bg', __( 'Arrow background', 'searcio' ), '--whsc-arrow-bg' ),
							self::color( 'arrow_color_hover', __( 'Arrow color', 'searcio' ), '--whsc-arrow-color-hover', 'hover' ),
							self::color( 'arrow_bg_hover', __( 'Arrow background', 'searcio' ), '--whsc-arrow-bg-hover', 'hover' ),
							self::size( 'arrow_size', __( 'Arrow size', 'searcio' ), '--whsc-arrow-size', 24, 64, true ),
							self::size( 'arrow_radius', __( 'Arrow radius', 'searcio' ), '--whsc-arrow-radius', 0, 999 ),
							self::choice(
								'arrow_shadow',
								__( 'Arrow shadow', 'searcio' ),
								'--whsc-arrow-shadow',
								[
									''     => __( 'Soft (default)', 'searcio' ),
									'none' => __( 'None', 'searcio' ),
								]
							),
						]
					),
					self::color( 'dot_color', __( 'Dot color', 'searcio' ), '--whsc-dot-color' ),
					self::color( 'dot_color_active', __( 'Dot color (active)', 'searcio' ), '--whsc-dot-color-active', 'active' ),
				],
			],
			[
				'id'       => 'assistant',
				'label'    => __( 'AI Assistant', 'searcio' ),
				'controls' => [
					self::color( 'assistant_accent', __( 'Accent (avatar, dots)', 'searcio' ), '--whsc-assistant-accent' ),
					self::color( 'assistant_text', __( 'Reply text', 'searcio' ), '--whsc-assistant-text' ),
					self::color( 'assistant_user_bg', __( 'Your message background', 'searcio' ), '--whsc-assistant-user-bg' ),
					self::color( 'assistant_user_text', __( 'Your message text', 'searcio' ), '--whsc-assistant-user-text' ),
					self::color( 'assistant_row_bg', __( 'Compare row shading', 'searcio' ), '--whsc-assistant-row-bg' ),
					self::size( 'assistant_input_radius', __( 'Message field radius', 'searcio' ), '--whsc-assistant-input-radius', 0, 999 ),
				],
			],
			[
				'id'       => 'banner',
				'label'    => __( 'Promotional banner', 'searcio' ),
				'controls' => [
					self::color( 'banner_bg', __( 'Background', 'searcio' ), '--whsc-banner-bg' ),
					self::color( 'banner_text', __( 'Text', 'searcio' ), '--whsc-banner-text' ),
				],
			],
			[
				'id'       => 'quiz',
				'label'    => __( 'Guided quiz', 'searcio' ),
				'controls' => [
					self::color( 'quiz_question', __( 'Question text', 'searcio' ), '--whsc-quiz-question' ),
					...self::under(
						__( 'Answers', 'searcio' ),
						[
							self::color( 'quiz_option_bg', __( 'Background', 'searcio' ), '--whsc-quiz-option-bg' ),
							self::color( 'quiz_option_text', __( 'Text', 'searcio' ), '--whsc-quiz-option-text' ),
							self::color( 'quiz_option_border', __( 'Border', 'searcio' ), '--whsc-quiz-option-border' ),
							self::color( 'quiz_option_bg_hover', __( 'Background', 'searcio' ), '--whsc-quiz-option-bg-hover', 'hover' ),
							self::color( 'quiz_option_text_hover', __( 'Text', 'searcio' ), '--whsc-quiz-option-text-hover', 'hover' ),
							self::color( 'quiz_option_border_hover', __( 'Border', 'searcio' ), '--whsc-quiz-option-border-hover', 'hover' ),
							self::size( 'quiz_option_radius', __( 'Answer radius', 'searcio' ), '--whsc-quiz-option-radius', 0, 999 ),
						]
					),
				],
			],
		];
	}

	/**
	 * The four controls of one icon button of the window: colours in two
	 * states, a radius and a padding per device.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function icon_button( string $name, string $label ): array {
		return self::under(
			$label,
			[
				self::color( $name . '_color', __( 'Icon color', 'searcio' ), '--whsc-' . $name . '-color' ),
				self::color( $name . '_bg', __( 'Background', 'searcio' ), '--whsc-' . $name . '-bg' ),
				self::color( $name . '_color_hover', __( 'Icon color', 'searcio' ), '--whsc-' . $name . '-color-hover', 'hover' ),
				self::color( $name . '_bg_hover', __( 'Background', 'searcio' ), '--whsc-' . $name . '-bg-hover', 'hover' ),
				self::size( $name . '_radius', __( 'Border radius', 'searcio' ), '--whsc-' . $name . '-radius', 0, 999 ),
				self::spacing( $name . '_padding', __( 'Padding', 'searcio' ), '--whsc-' . $name . '-padding' ),
			]
		);
	}

	/**
	 * Puts a heading over a run of controls.
	 *
	 * @param  array<int, array<string, mixed>>  $controls
	 * @return array<int, array<string, mixed>>
	 */
	private static function under( string $heading, array $controls ): array {
		return array_map( static fn ( array $control ): array => [ 'heading' => $heading ] + $control, $controls );
	}

	/**
	 * @param  array<string, string>  $when   Search settings it applies to, e.g. `[ 'mode' => 'icon' ]`.
	 * @param  array<string, string>  $also   Properties it sets as well when it is set.
	 * @return array<string, mixed>
	 */
	private static function color( string $id, string $label, string $property, string $state = 'normal', array $when = [], array $also = [] ): array {
		return [ 'id' => $id, 'type' => 'color', 'label' => $label, 'property' => $property, 'state' => $state, 'when' => $when, 'also' => $also ];
	}

	/**
	 * @param  array<string, string>  $when
	 * @return array<string, mixed>
	 */
	private static function size( string $id, string $label, string $property, int $min, int $max, bool $responsive = false, string $unit = 'px', array $when = [] ): array {
		return [ 'id' => $id, 'type' => 'size', 'label' => $label, 'property' => $property, 'min' => $min, 'max' => $max, 'unit' => $unit, 'responsive' => $responsive, 'state' => 'normal', 'when' => $when ];
	}

	/** @return array<string, mixed> */
	private static function spacing( string $id, string $label, string $property ): array {
		return [ 'id' => $id, 'type' => 'spacing', 'label' => $label, 'property' => $property, 'min' => 0, 'max' => 120, 'unit' => 'px', 'responsive' => true, 'state' => 'normal', 'when' => [] ];
	}

	/**
	 * @param  array<string, string>  $options  CSS value => label; '' is the storefront's own.
	 * @return array<string, mixed>
	 */
	private static function choice( string $id, string $label, string $property, array $options ): array {
		return [ 'id' => $id, 'type' => 'choice', 'label' => $label, 'property' => $property, 'options' => $options, 'state' => 'normal', 'when' => [] ];
	}

	/** @return array<string, mixed> */
	private static function toggle( string $id, string $label, string $property, string $value ): array {
		return [ 'id' => $id, 'type' => 'toggle', 'label' => $label, 'property' => $property, 'value' => $value, 'state' => 'normal', 'when' => [] ];
	}

	/** @return array<string, mixed> */
	private static function font( string $id, string $label, string $property ): array {
		return [ 'id' => $id, 'type' => 'font', 'label' => $label, 'property' => $property, 'state' => 'normal', 'when' => [] ];
	}

	/**
	 * @param  array<int, string>     $selectors
	 * @param  array<string, string>  $when
	 * @return array<string, mixed>
	 */
	private static function border( string $id, string $label, array $selectors, array $when = [] ): array {
		return [ 'id' => $id, 'type' => 'border', 'label' => $label, 'selectors' => $selectors, 'state' => 'normal', 'when' => $when ];
	}

	/**
	 * @param  array<int, string>     $selectors
	 * @param  array<string, string>  $when
	 * @return array<string, mixed>
	 */
	private static function typography( string $id, string $label, array $selectors, array $when = [] ): array {
		return [ 'id' => $id, 'type' => 'typography', 'label' => $label, 'selectors' => $selectors, 'responsive' => true, 'state' => 'normal', 'when' => $when ];
	}
}
