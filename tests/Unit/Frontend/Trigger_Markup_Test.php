<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;

final class Trigger_Markup_Test extends TestCase {
	public function test_defaults_to_icon_mode_when_mode_is_missing(): void {
		$html = Trigger_Markup::render( [] );

		$this->assertStringContainsString( 'data-mode="icon"', $html );
	}

	public function test_defaults_to_icon_mode_when_mode_is_invalid(): void {
		$html = Trigger_Markup::render( [ 'mode' => 'not-a-real-mode' ] );

		$this->assertStringContainsString( 'data-mode="icon"', $html );
	}

	public function test_accepts_box_mode(): void {
		$html = Trigger_Markup::render( [ 'mode' => 'box' ] );

		$this->assertStringContainsString( 'data-mode="box"', $html );
	}

	public function test_outputs_scope_type_and_placeholder(): void {
		$html = Trigger_Markup::render( [
			'scopeType'   => 'product',
			'placeholder' => 'Search products…',
		] );

		$this->assertStringContainsString( 'data-type="product"', $html );
		$this->assertStringContainsString( 'data-placeholder="Search products…"', $html );
	}

	public function test_voice_flag_defaults_to_empty_when_not_enabled(): void {
		$html = Trigger_Markup::render( [] );

		$this->assertStringContainsString( 'data-voice=""', $html );
	}

	public function test_voice_flag_is_one_when_enabled(): void {
		$html = Trigger_Markup::render( [ 'enableVoice' => true ] );

		$this->assertStringContainsString( 'data-voice="1"', $html );
	}

	public function test_merges_custom_class_name_with_the_base_class(): void {
		$html = Trigger_Markup::render( [ 'className' => 'my-extra-class' ] );

		$this->assertStringContainsString( 'class="webhead-search-cloud-trigger my-extra-class"', $html );
	}

	public function test_escapes_attribute_values(): void {
		$html = Trigger_Markup::render( [ 'placeholder' => '"><script>alert(1)</script>' ] );

		$this->assertStringNotContainsString( '<script>', $html );
	}

	public function test_voice_icon_html_defaults_to_empty(): void {
		$html = Trigger_Markup::render( [] );

		$this->assertStringContainsString( 'data-voice-icon=""', $html );
	}

	public function test_voice_icon_html_is_output_when_provided(): void {
		$html = Trigger_Markup::render( [ 'voiceIconHtml' => '<svg>mic</svg>' ] );

		$this->assertStringContainsString( 'data-voice-icon="&lt;svg&gt;mic&lt;/svg&gt;"', $html );
	}

	public function test_card_source_defaults_to_plugin(): void {
		$html = Trigger_Markup::render( [] );

		$this->assertStringContainsString( 'data-card-source="plugin"', $html );
	}

	public function test_card_source_defaults_to_plugin_when_invalid(): void {
		$html = Trigger_Markup::render( [ 'cardSource' => 'not-a-real-source' ] );

		$this->assertStringContainsString( 'data-card-source="plugin"', $html );
	}

	public function test_card_source_accepts_server(): void {
		$html = Trigger_Markup::render( [ 'cardSource' => 'server' ] );

		$this->assertStringContainsString( 'data-card-source="server"', $html );
	}

	public function test_highlights_source_defaults_to_newest(): void {
		$html = Trigger_Markup::render( [] );

		$this->assertStringContainsString( 'data-highlights-source="newest"', $html );
	}

	public function test_highlights_source_defaults_to_newest_when_invalid(): void {
		$html = Trigger_Markup::render( [ 'highlightsSource' => 'not-a-real-source' ] );

		$this->assertStringContainsString( 'data-highlights-source="newest"', $html );
	}

	public function test_highlights_source_accepts_featured(): void {
		$html = Trigger_Markup::render( [ 'highlightsSource' => 'featured' ] );

		$this->assertStringContainsString( 'data-highlights-source="featured"', $html );
	}

	/**
	 * Only the Elementor editor asks for the modal to open by itself, so an
	 * ordinary trigger carries no trace of it - not even an "off" value.
	 */
	public function test_editor_preview_is_absent_unless_asked_for(): void {
		$html = Trigger_Markup::render( [ 'editorQuery' => 'shirt' ] );

		$this->assertStringNotContainsString( 'data-editor-preview', $html );
		$this->assertStringNotContainsString( 'data-editor-query', $html );
	}

	public function test_editor_preview_carries_its_search_term(): void {
		$html = Trigger_Markup::render( [ 'editorPreview' => true, 'editorQuery' => '  Shirt  ' ] );

		$this->assertStringContainsString( 'data-editor-preview="1" data-editor-query="Shirt"', $html );
	}

	public function test_editor_preview_escapes_its_search_term(): void {
		$html = Trigger_Markup::render( [ 'editorPreview' => true, 'editorQuery' => '"><script>alert(1)</script>' ] );

		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( 'data-editor-query="&quot;&gt;&lt;script&gt;', $html );
	}

	public function test_the_filter_bar_shows_five_buttons_unless_the_placement_says_otherwise(): void {
		$this->assertStringContainsString( 'data-facet-bar-limit="5"', Trigger_Markup::render( [] ) );
		// An emptied Elementor number field.
		$this->assertStringContainsString( 'data-facet-bar-limit="5"', Trigger_Markup::render( [ 'facetBarLimit' => '' ] ) );
		$this->assertStringContainsString( 'data-facet-bar-limit="3"', Trigger_Markup::render( [ 'facetBarLimit' => '3' ] ) );
	}

	public function test_the_filter_bar_limit_is_kept_between_none_and_eight(): void {
		$this->assertStringContainsString( 'data-facet-bar-limit="0"', Trigger_Markup::render( [ 'facetBarLimit' => 0 ] ) );
		$this->assertStringContainsString( 'data-facet-bar-limit="0"', Trigger_Markup::render( [ 'facetBarLimit' => -2 ] ) );
		$this->assertStringContainsString( 'data-facet-bar-limit="8"', Trigger_Markup::render( [ 'facetBarLimit' => 40 ] ) );
	}
}
