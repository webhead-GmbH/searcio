<?php
/**
 * Shared front-end trigger markup.
 *
 * One render helper used by both the Gutenberg block's `render.php` and the
 * Elementor widget so the two embed points never drift apart.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Trigger_Markup {
	private const ANIMATIONS = [ 'none', 'fade', 'slide-down', 'slide-up', 'zoom' ];

	private const CARD_SOURCES = [ 'plugin', 'server' ];

	private const HIGHLIGHTS_SOURCES = [ 'newest', 'featured' ];

	/**
	 * @param  array{mode?:string,scopeType?:string,placeholder?:string,className?:string,enableVoice?:bool,searchTrigger?:string,instanceClass?:string,iconHtml?:string,voiceIconHtml?:string,animation?:string,showCount?:bool,cardSource?:string,highlightsSource?:string,editorPreview?:bool,editorQuery?:string}  $attributes
	 */
	public static function render( array $attributes ): string {
		$mode           = in_array( $attributes['mode'] ?? '', [ 'box', 'icon' ], true ) ? $attributes['mode'] : 'icon';
		$scope_type     = is_string( $attributes['scopeType'] ?? null ) ? trim( (string) $attributes['scopeType'] ) : '';
		$placeholder    = is_string( $attributes['placeholder'] ?? null ) ? trim( (string) $attributes['placeholder'] ) : '';
		$class_name     = is_string( $attributes['className'] ?? null ) ? trim( (string) $attributes['className'] ) : '';
		$enable_voice   = ! empty( $attributes['enableVoice'] );
		$search_trigger = 'type' === ( $attributes['searchTrigger'] ?? '' ) ? 'type' : 'submit';
		$instance_class = is_string( $attributes['instanceClass'] ?? null ) ? trim( (string) $attributes['instanceClass'] ) : '';
		$icon_html      = is_string( $attributes['iconHtml'] ?? null ) ? trim( (string) $attributes['iconHtml'] ) : '';
		$voice_icon_html = is_string( $attributes['voiceIconHtml'] ?? null ) ? trim( (string) $attributes['voiceIconHtml'] ) : '';
		$animation      = in_array( $attributes['animation'] ?? '', self::ANIMATIONS, true ) ? (string) $attributes['animation'] : 'fade';
		// Count is shown unless explicitly disabled.
		$show_count     = array_key_exists( 'showCount', $attributes ) ? ! empty( $attributes['showCount'] ) : true;
		$card_source    = in_array( $attributes['cardSource'] ?? '', self::CARD_SOURCES, true ) ? $attributes['cardSource'] : 'plugin';
		// 'featured' sources the empty-query highlights carousel from
		// `filter[featured]=true` instead of a plain match-all.
		$highlights_source = in_array( $attributes['highlightsSource'] ?? '', self::HIGHLIGHTS_SOURCES, true ) ? $attributes['highlightsSource'] : 'newest';
		// Opens the modal on its own, which only the Elementor editor asks for
		// (the widget checks it is rendering there), so it is omitted entirely
		// otherwise rather than written as an "off" value.
		$editor_preview = ! empty( $attributes['editorPreview'] )
			? sprintf(
				' data-editor-preview="1" data-editor-query="%s"',
				esc_attr( is_string( $attributes['editorQuery'] ?? null ) ? trim( (string) $attributes['editorQuery'] ) : '' )
			)
			: '';

		// The instance class is applied to the trigger itself (so Elementor's
		// Style-tab selectors, which target the trigger's ancestor wrapper,
		// still resolve) and is also read by the front-end JS via
		// `data-instance-class` so it can be re-applied to the modal - the
		// modal is portalled to `document.body`, so it is not a DOM descendant
		// of this trigger and needs the class copied onto it explicitly for
		// per-instance CSS custom properties to reach it.
		// Join only the non-empty parts so an empty instance/custom class never
		// leaves a doubled space in the class attribute.
		$classes = implode(
			' ',
			array_filter( [ 'webhead-search-cloud-trigger', $instance_class, $class_name ], static fn ( string $part ): bool => '' !== $part )
		);

		// `data-webhead-frontend-root` scopes the shared frontend reset
		// (`src/components/Default/frontend-reset.scss`) to this trigger. The
		// portalled modal (rendered separately under `document.body`, see
		// `index.js`) carries the same attribute on its own mount element.
		return sprintf(
			'<div class="%1$s" data-whsc-trigger data-webhead-frontend-root data-mode="%2$s" data-type="%3$s" data-placeholder="%4$s" data-voice="%5$s" data-search-trigger="%6$s" data-instance-class="%7$s" data-animation="%8$s" data-show-count="%9$s" data-icon="%10$s" data-voice-icon="%11$s" data-card-source="%12$s" data-highlights-source="%13$s"%14$s></div>',
			esc_attr( $classes ),
			esc_attr( $mode ),
			esc_attr( $scope_type ),
			esc_attr( $placeholder ),
			esc_attr( $enable_voice ? '1' : '' ),
			esc_attr( $search_trigger ),
			esc_attr( $instance_class ),
			esc_attr( $animation ),
			esc_attr( $show_count ? '1' : '0' ),
			// Both icon markups are rendered by Elementor's Icons_Manager
			// (trusted, sanitized). esc_attr keeps them safely contained inside
			// the attribute; the front-end JS decodes and renders them.
			esc_attr( $icon_html ),
			esc_attr( $voice_icon_html ),
			esc_attr( $card_source ),
			esc_attr( $highlights_source ),
			$editor_preview
		);
	}
}
