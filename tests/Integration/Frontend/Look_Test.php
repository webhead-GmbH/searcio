<?php
/**
 * The Placement tab's Look: every setting of the Elementor widget, cleaned by
 * its type, written as CSS for a device each, on what the tab places.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use WP_REST_Request;
use WP_REST_Server;
use Webhead\WP\SearchCloud\DTO\Look;
use Webhead\WP\SearchCloud\DTO\Placement_Options;
use Webhead\WP\SearchCloud\Frontend\Google_Fonts;
use Webhead\WP\SearchCloud\Frontend\Look_Schema;
use Webhead\WP\SearchCloud\Frontend\Look_Styles;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Frontend\Placement_Preview;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Look_Test extends Integration_Test_Case {
	public function test_every_group_holds_controls_with_an_id_a_label_and_a_type(): void {
		$ids = [];

		foreach ( Look_Schema::groups() as $group ) {
			$this->assertNotSame( '', $group['label'] );
			$this->assertNotEmpty( $group['controls'], $group['id'] );

			foreach ( $group['controls'] as $control ) {
				$this->assertNotSame( '', $control['label'], $control['id'] );
				$this->assertContains( $control['type'], [ 'color', 'size', 'spacing', 'choice', 'toggle', 'font', 'border', 'typography' ], $control['id'] );
				$ids[] = $control['id'];
			}
		}

		$this->assertSame( $ids, array_unique( $ids ), 'An id names one control.' );
		$this->assertGreaterThan( 140, count( $ids ), 'Every setting of the Elementor widget.' );
	}

	public function test_values_are_cleaned_by_the_type_of_their_control(): void {
		$look = Look::from_array(
			[
				'field_bg'              => '#123abc',
				'modal_text'            => 'red;}body{display:none',
				'modal_padding'         => [ 'desktop' => '24', 'tablet' => 500, 'mobile' => 'wide' ],
				'field_radius'          => 12.6,
				'popular_padding'       => [ 'desktop' => [ 4, 8, 4, 8 ], 'mobile' => [ 1, 2 ] ],
				'card_image_ratio'      => '4 / 5',
				'card_image_fit'        => 'stretch',
				'modal_round_top'       => 'yes',
				'modal_font_family'     => 'Inter"; } body {',
				'trigger_box_border'    => [ 'style' => 'dashed', 'width' => 99, 'color' => '#000' ],
				'card_title_typography' => [ 'family' => 'Lora', 'weight' => '650', 'size' => [ 'desktop' => 18, 'mobile' => 14 ], 'line_height' => [ 'desktop' => '1.35' ], 'transform' => 'shout' ],
				'not_a_control'         => '#fff',
			]
		);

		$this->assertSame(
			[
				'field_bg'              => '#123abc',
				'modal_text'            => 'redbodydisplaynone',
				'modal_padding'         => [ 'desktop' => 24, 'tablet' => 80 ],
				'field_radius'          => 13,
				'popular_padding'       => [ 'desktop' => [ 4, 8, 4, 8 ] ],
				'card_image_ratio'      => '4 / 5',
				'modal_round_top'       => true,
				'modal_font_family'     => 'Inter body',
				'trigger_box_border'    => [ 'style' => 'dashed', 'width' => 20, 'color' => '#000' ],
				'card_title_typography' => [ 'family' => 'Lora', 'size' => [ 'desktop' => 18, 'mobile' => 14 ], 'line_height' => [ 'desktop' => 1.35 ] ],
			],
			$look->to_array()
		);
	}

	public function test_the_css_sets_each_device_at_elementors_breakpoints(): void {
		$css = Look_Styles::css(
			Look::from_array(
				[
					'field_bg'              => '#123abc',
					'modal_padding'         => [ 'desktop' => 24, 'tablet' => 16, 'mobile' => 12 ],
					'popular_padding'       => [ 'mobile' => [ 4, 8, 4, 8 ] ],
					'facet_group_color'     => '#333333',
					'modal_font_family'     => 'Inter',
					'card_title_typography' => [ 'family' => 'Lora', 'weight' => '600', 'size' => [ 'desktop' => 18, 'mobile' => 14 ] ],
				]
			),
			'whsc-instance-p1'
		);

		$this->assertSame(
			'.whsc-instance-p1{--whsc-input-bg:#123abc;--whsc-padding:24px;--whsc-facet-group-label:#333333;--whsc-facet-group-label-opacity:1;--whsc-font-family:"Inter"}'
			. '.whsc-instance-p1 .whsc-card__title:not(#whsc#whsc#whsc#whsc){font-family:"Lora";font-weight:600;font-size:18px}'
			. '@media (max-width:1024px){.whsc-instance-p1{--whsc-padding:16px}}'
			. '@media (max-width:767px){.whsc-instance-p1{--whsc-padding:12px;--whsc-popular-padding:4px 8px 4px 8px}.whsc-instance-p1 .whsc-card__title:not(#whsc#whsc#whsc#whsc){font-size:14px}}',
			$css
		);
	}

	public function test_a_border_is_written_on_the_line_round_the_box(): void {
		$css = Look_Styles::css( Look::from_array( [ 'trigger_box_border' => [ 'style' => 'solid', 'width' => 2, 'color' => '#ff0000' ] ] ), 'whsc-instance-p1' );

		$this->assertSame( '.whsc-instance-p1 .whsc-trigger-box .components-input-control__backdrop:not(#whsc#whsc#whsc#whsc){border-style:solid;border-width:2px;border-color:#ff0000}', $css );
	}

	public function test_a_google_family_is_loaded_unless_the_site_has_it(): void {
		$look = Look::from_array(
			[
				'modal_font_family'     => 'Inter',
				'card_title_typography' => [ 'family' => 'Lora', 'weight' => '300' ],
				'tab_typography'        => [ 'family' => 'My Theme Sans' ],
			]
		);

		$this->assertSame( [ 'Inter' => [], 'Lora' => [ 300 ] ], Look_Styles::google_families( $look, [] ) );
		$this->assertSame( [ 'Lora' => [ 300 ] ], Look_Styles::google_families( $look, [ 'Inter' ] ) );
		$this->assertSame(
			'https://fonts.googleapis.com/css2?family=Lora:wght@300;400;500;600;700&display=swap',
			Google_Fonts::url( [ 'Lora' => [ 300 ] ] )
		);
	}

	public function test_the_colours_and_radius_saved_before_the_editor_are_the_editors_now(): void {
		$options = Placement_Options::from_array( [ 'search' => [ 'mode' => 'icon', 'accent' => '#00aa00', 'icon_color' => '#111111', 'radius' => 20 ] ] );

		$this->assertSame( [ 'modal_accent' => '#00aa00', 'trigger_icon_color' => '#111111', 'modal_radius' => 20 ], $options->search->look->to_array() );
		$this->assertSame( [], $options->search->colors );
		$this->assertNull( $options->search->radius );

		// Saved again, they are read as they were saved.
		$again = Placement_Options::from_array( $options->to_array() );
		$this->assertSame( $options->search->look->to_array(), $again->search->look->to_array() );
	}

	public function test_the_shortcode_carries_the_look_and_its_own_colour_outweighs_it(): void {
		$this->config()->save( [ 'search' => [ 'mode' => 'box', 'look' => [ 'modal_accent' => '#00aa00', 'field_radius' => 6 ] ] ] );

		$html = do_shortcode( '[searcio accent="#123abc"]' );

		$this->assertMatchesRegularExpression( '/class="[^"]*(whsc-instance-p[0-9a-f]{8})/', $html );
		preg_match( '/whsc-instance-p[0-9a-f]{8}/', $html, $instance );

		$look   = strpos( $html, '.' . $instance[0] . '{--whsc-accent:#00aa00;--whsc-input-radius:6px}' );
		$tokens = strpos( $html, '--whsc-accent:#123abc' );

		$this->assertNotFalse( $look );
		$this->assertNotFalse( $tokens );
		$this->assertGreaterThan( $look, $tokens, 'The shortcode\'s own colour comes later, and wins.' );
	}

	public function test_the_preview_is_sent_the_css_of_what_the_editor_holds(): void {
		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'POST', '/webhead-search-cloud/v1/placement/look-css' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( [ 'look' => [ 'field_bg' => '#123abc', 'modal_font_family' => 'Inter' ] ] ) );

		$this->acting_as( 'subscriber' );
		$this->assertSame( 403, $wp_rest_server->dispatch( $request )->get_status() );

		$this->acting_as();
		$data = $wp_rest_server->dispatch( $request )->get_data();

		$this->assertSame( '.whsc-instance-preview{--whsc-input-bg:#123abc;--whsc-font-family:"Inter"}', $data['css'] );
		$this->assertStringStartsWith( 'https://fonts.googleapis.com/css2?family=Inter:', $data['fonts'] );

		$wp_rest_server = null;
	}

	/**
	 * The preview draws the search under a fixed class, which the CSS the
	 * editor sends names, and takes that CSS only from the admin's origin.
	 */
	public function test_the_preview_draws_what_the_editor_sends_from_the_admins_origin(): void {
		$this->config()->save( [ 'search' => [ 'look' => [ 'field_bg' => '#123abc' ] ] ] );
		$_GET[ Placement_Preview::QUERY ] = '1';

		$preview = $this->service( 'placement_preview' );
		$markup  = $this->service( 'search_surface' )->search( $this->config()->options()->search );
		$print   = new \ReflectionMethod( $preview, 'print_page' );

		// The page's own lines, without what the theme and the plugins print
		// into its head and its foot.
		remove_all_actions( 'wp_head' );
		remove_all_actions( 'wp_footer' );

		ob_start();
		$print->invoke( $preview, $markup, 'trigger' );
		$page = (string) ob_get_clean();

		unset( $_GET[ Placement_Preview::QUERY ] );

		$this->assertStringContainsString( Placement_Preview::INSTANCE, $markup );
		$this->assertStringNotContainsString( '#123abc', $markup, 'The stored look is the editor\'s to send.' );
		$this->assertStringContainsString( '<style id="whsc-look-live"></style>', $page );
		$admin = (array) wp_parse_url( admin_url() );
		$this->assertStringContainsString(
			'var origin = ' . wp_json_encode( $admin['scheme'] . '://' . $admin['host'] . ( isset( $admin['port'] ) ? ':' . $admin['port'] : '' ) ),
			$page
		);
	}

	public function test_the_tab_is_given_the_groups_and_the_fonts(): void {
		$catalog = $this->config()->catalog();

		$this->assertSame( 'trigger', $catalog['look'][0]['id'] );
		$this->assertContains( 'Inter', $catalog['fonts']['google'] );
		$this->assertIsArray( $catalog['fonts']['site'] );
		$this->assertSame( [], $catalog['placement']['search']['look'] );
	}

	private function config(): Placement_Config {
		return $this->service( 'placement_config' );
	}
}
