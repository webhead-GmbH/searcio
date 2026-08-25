<?php
/**
 * Search Cloud search block render template.
 *
 * @var array<string,mixed> $attributes
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

use Webhead\WP\SearchCloud\Frontend\Frontend_Assets;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;

defined( 'ABSPATH' ) || exit;

Frontend_Assets::enqueue();

$instance_id    = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $attributes['instanceId'] ?? '' ) );
$instance_class = '' !== $instance_id ? 'whsc-instance-' . $instance_id : '';

/*
 * The search modal is portalled to `document.body`, so it needs the same
 * per-instance class re-applied to it to reach these CSS custom properties
 * (they aren't inherited through normal DOM ancestry). Colors map to raw
 * color values; dimensions are plain px numbers from `RangeControl`s.
 */
$color_map = [
	'triggerIconColor'      => '--whsc-trigger-icon',
	'triggerIconColorHover' => '--whsc-trigger-icon-hover',
	'triggerBg'             => '--whsc-trigger-bg',
	'triggerBgHover'        => '--whsc-trigger-bg-hover',
	'bgColor'               => '--whsc-bg',
	'textColor'             => '--whsc-text',
	'accentColor'           => '--whsc-accent',
	'inputBgColor'          => '--whsc-input-bg',
	'inputTextColor'        => '--whsc-input-text',
	'inputIconColor'        => '--whsc-input-icon',
	'inputPlaceholderColor' => '--whsc-input-placeholder',
	'inputBorderColor'      => '--whsc-input-border',
	'inputBorderFocusColor' => '--whsc-input-border-focus',
	'btnBg'                 => '--whsc-btn-bg',
	'btnBgHover'            => '--whsc-btn-bg-hover',
	'btnText'               => '--whsc-btn-text',
	'btnTextHover'          => '--whsc-btn-text-hover',
	'iconColor'             => '--whsc-icon-color',
	'iconColorHover'        => '--whsc-icon-color-hover',
	'iconBgHover'           => '--whsc-icon-bg-hover',
	'voiceColor'            => '--whsc-voice-color',
	'voiceColorHover'       => '--whsc-voice-color-hover',
	'voiceBg'               => '--whsc-voice-bg',
	'voiceBgHover'          => '--whsc-voice-bg-hover',
	'closeColor'            => '--whsc-close-color',
	'closeColorHover'       => '--whsc-close-color-hover',
	'closeBg'               => '--whsc-close-bg',
	'closeBgHover'          => '--whsc-close-bg-hover',
	'clearBtnColor'         => '--whsc-clearbtn-color',
	'clearBtnColorHover'    => '--whsc-clearbtn-color-hover',
	'clearBtnBg'            => '--whsc-clearbtn-bg',
	'clearBtnBgHover'       => '--whsc-clearbtn-bg-hover',
	'panelBg'               => '--whsc-panel-bg',
	'panelBorder'           => '--whsc-panel-border',
	'suggestionText'        => '--whsc-suggestion-text',
	'suggestionTextHover'   => '--whsc-suggestion-text-hover',
	'suggestionBgHover'     => '--whsc-suggestion-bg-hover',
	'titleColor'            => '--whsc-title-color',
	'chipBg'                => '--whsc-chip-bg',
	'chipText'              => '--whsc-chip-text',
	'chipBorder'            => '--whsc-chip-border',
	'chipBgHover'           => '--whsc-chip-bg-hover',
	'chipTextHover'         => '--whsc-chip-text-hover',
	'chipBorderHover'       => '--whsc-chip-border-hover',
	'clearText'             => '--whsc-clear-text',
	'clearTextHover'        => '--whsc-clear-text-hover',
	'clearBgHover'          => '--whsc-clear-bg-hover',
	'clearTextActive'       => '--whsc-clear-text-active',
	'popularText'           => '--whsc-popular-text',
	'popularTextHover'      => '--whsc-popular-text-hover',
	'popularBgHover'        => '--whsc-popular-bg-hover',
	'facetBg'               => '--whsc-facet-bg',
	'facetText'             => '--whsc-facet-text',
	'facetBgHover'          => '--whsc-facet-bg-hover',
	'facetTextHover'        => '--whsc-facet-text-hover',
	'facetBgActive'         => '--whsc-facet-bg-active',
	'facetTextActive'       => '--whsc-facet-text-active',
	'facetCount'            => '--whsc-facet-count',
	'visualColor'           => '--whsc-visual-color',
	'visualColorHover'      => '--whsc-visual-color-hover',
	'visualBg'              => '--whsc-visual-bg',
	'visualBgHover'         => '--whsc-visual-bg-hover',
	'tabText'               => '--whsc-tab-text',
	'tabTextActive'         => '--whsc-tab-text-active',
	'tabIndicator'          => '--whsc-tab-indicator',
	'tabBorder'             => '--whsc-tab-border',
	'assistantAccent'       => '--whsc-assistant-accent',
	'assistantText'         => '--whsc-assistant-text',
	'assistantUserBg'       => '--whsc-assistant-user-bg',
	'assistantUserText'     => '--whsc-assistant-user-text',
	'assistantRowBg'        => '--whsc-assistant-row-bg',
	'bannerBg'              => '--whsc-banner-bg',
	'bannerText'            => '--whsc-banner-text',
	'quizQuestion'          => '--whsc-quiz-question',
	'quizOptionBg'          => '--whsc-quiz-option-bg',
	'quizOptionText'        => '--whsc-quiz-option-text',
	'quizOptionBorder'      => '--whsc-quiz-option-border',
	'quizOptionBgHover'     => '--whsc-quiz-option-bg-hover',
	'quizOptionTextHover'   => '--whsc-quiz-option-text-hover',
	'quizOptionBorderHover' => '--whsc-quiz-option-border-hover',
	'cardBg'                => '--whsc-card-bg',
	'cardBorder'            => '--whsc-card-border',
	'cardBorderHover'       => '--whsc-card-border-hover',
	'cardTitle'             => '--whsc-card-title',
	'priceColor'            => '--whsc-price-color',
	'arrowColor'            => '--whsc-arrow-color',
	'arrowBg'               => '--whsc-arrow-bg',
	'dotColor'              => '--whsc-dot-color',
	'dotColorActive'        => '--whsc-dot-color-active',
];

$dimension_map = [
	'triggerRadius'   => '--whsc-trigger-radius',
	'triggerIconSize' => '--whsc-trigger-icon-size',
	'triggerBtnSize'  => '--whsc-trigger-size',
	'radiusPanel'     => '--whsc-radius-panel',
	'modalPadding'    => '--whsc-padding',
	'modalGap'        => '--whsc-gap',
	'inputRadius'     => '--whsc-input-radius',
	'btnRadius'       => '--whsc-btn-radius',
	'panelRadius'     => '--whsc-panel-radius',
	'chipRadius'      => '--whsc-chip-radius',
	'facetRadius'     => '--whsc-facet-radius',
	'facetsMaxHeight' => '--whsc-facets-max-height',
	'assistantInputRadius' => '--whsc-assistant-input-radius',
	'quizOptionRadius' => '--whsc-quiz-option-radius',
	'cardRadius'      => '--whsc-card-radius',
	'cardPadding'     => '--whsc-card-padding',
	'carouselGap'     => '--whsc-carousel-gap',
	'popularGap'      => '--whsc-popular-gap',
	'popularRadius'   => '--whsc-popular-radius',
];

$declarations = [];

foreach ( $color_map as $attribute_key => $css_var ) {
	$value = $attributes[ $attribute_key ] ?? '';

	if ( is_string( $value ) && '' !== trim( $value ) ) {
		$declarations[] = sprintf( '%s:%s', $css_var, preg_replace( '/[^#a-zA-Z0-9(),.%\s-]/', '', $value ) );
	}
}

foreach ( $dimension_map as $attribute_key => $css_var ) {
	$value = $attributes[ $attribute_key ] ?? null;

	if ( is_numeric( $value ) ) {
		$declarations[] = sprintf( '%s:%dpx', $css_var, (int) $value );
	}
}

if ( is_numeric( $attributes['animationDuration'] ?? null ) ) {
	$declarations[] = sprintf( '--whsc-anim-duration:%dms', (int) $attributes['animationDuration'] );
}

if ( [] !== $declarations && '' !== $instance_class ) {
	printf(
		'<style>.%1$s{%2$s}</style>',
		esc_attr( $instance_class ),
		implode( ';', $declarations ) // phpcs:ignore -- sanitized above to a safe value character set.
	);
}

printf(
	'<div %1$s>%2$s</div>',
	wp_kses_data(
		get_block_wrapper_attributes( [ 'class' => 'webhead-search-cloud-search-block' ] )
	),
	Trigger_Markup::render( array_merge( $attributes, [ 'instanceClass' => $instance_class ] ) ) // phpcs:ignore -- markup is escaped inside Trigger_Markup::render().
);
