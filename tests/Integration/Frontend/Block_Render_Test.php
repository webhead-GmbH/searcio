<?php
/**
 * Block editor render tests for `webhead-search-cloud/search`.
 *
 * The block is a dynamic (server-rendered) block: its `render.php` builds the
 * front-end trigger markup and a per-instance scoped `<style>` from the saved
 * attributes. These tests drive the block through WordPress's own
 * `render_block()` so a change to the block metadata, the render template, or
 * the shared `Trigger_Markup` shows up as a failure here. They need neither
 * Elementor nor WooCommerce, and run without a JS build (the render callback is
 * registered from `block.json` regardless of whether the editor bundle exists).
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Frontend;

use WP_Block_Type_Registry;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Block_Render_Test extends Integration_Test_Case {
	private const BLOCK = 'webhead-search-cloud/search';

	public function test_block_is_registered_from_metadata(): void {
		$this->assertTrue(
			WP_Block_Type_Registry::get_instance()->is_registered( self::BLOCK ),
			'The search block was not registered on init.'
		);
	}

	public function test_renders_the_default_trigger_markup(): void {
		$html = $this->render_search_block( [] );

		$this->assertStringContainsString( 'data-whsc-trigger', $html );
		$this->assertStringContainsString( 'webhead-search-cloud-search-block', $html );
		// Trigger_Markup falls back to icon mode when none is given.
		$this->assertStringContainsString( 'data-mode="icon"', $html );
	}

	public function test_reflects_content_attributes_in_data_attributes(): void {
		$html = $this->render_search_block(
			[
				'mode'             => 'box',
				'scopeType'        => 'product',
				'placeholder'      => 'Find products',
				'enableVoice'      => true,
				'showCount'        => false,
				'cardSource'       => 'server',
				'highlightsSource' => 'featured',
			]
		);

		$this->assertStringContainsString( 'data-mode="box"', $html );
		$this->assertStringContainsString( 'data-type="product"', $html );
		$this->assertStringContainsString( 'data-placeholder="Find products"', $html );
		$this->assertStringContainsString( 'data-voice="1"', $html );
		$this->assertStringContainsString( 'data-show-count="0"', $html );
		$this->assertStringContainsString( 'data-card-source="server"', $html );
		$this->assertStringContainsString( 'data-highlights-source="featured"', $html );
	}

	public function test_falls_back_invalid_enum_attributes_to_their_defaults(): void {
		$html = $this->render_search_block(
			[
				'mode'      => 'not-a-mode',
				'animation' => 'explode',
			]
		);

		$this->assertStringContainsString( 'data-mode="icon"', $html );
		$this->assertStringContainsString( 'data-animation="fade"', $html );
	}

	public function test_emits_a_scoped_style_block_for_a_named_instance(): void {
		$html = $this->render_search_block(
			[
				'instanceId' => 'abc123',
				'bgColor'    => '#ff0000',
				'modalGap'   => 24,
			]
		);

		$this->assertStringContainsString( 'whsc-instance-abc123', $html );
		$this->assertStringContainsString( '.whsc-instance-abc123{', $html );
		$this->assertStringContainsString( '--whsc-bg:#ff0000', $html );
		$this->assertStringContainsString( '--whsc-gap:24px', $html );
	}

	/**
	 * The stock line was the one text colour on a result card with no token
	 * behind it: a fixed green and red that no placement could change.
	 */
	public function test_emits_the_stock_line_colours_for_a_named_instance(): void {
		$html = $this->render_search_block(
			[
				'instanceId'    => 'stock1',
				'stockInColor'  => '#1d4ed8',
				'stockOutColor' => '#7c2d12',
			]
		);

		$this->assertStringContainsString( '.whsc-instance-stock1{', $html );
		$this->assertStringContainsString( '--whsc-stock-in-color:#1d4ed8', $html );
		$this->assertStringContainsString( '--whsc-stock-out-color:#7c2d12', $html );
	}

	/** A colour left unset declares nothing, so the stylesheet's default applies. */
	public function test_an_unset_stock_colour_declares_nothing(): void {
		$html = $this->render_search_block( [ 'instanceId' => 'stock2', 'stockInColor' => '', 'bgColor' => '#fff' ] );

		$this->assertStringNotContainsString( '--whsc-stock-in-color', $html );
		$this->assertStringNotContainsString( '--whsc-stock-out-color', $html );
	}

	public function test_block_metadata_declares_the_stock_colours(): void {
		$attributes = WP_Block_Type_Registry::get_instance()->get_registered( self::BLOCK )->attributes;

		foreach ( [ 'stockInColor', 'stockOutColor' ] as $name ) {
			$this->assertSame( [ 'type' => 'string', 'default' => '' ], $attributes[ $name ] ?? null, $name );
		}
	}

	/**
	 * The block styles the filter bar as the Elementor widget does, and says
	 * how many group buttons the bar shows.
	 */
	public function test_emits_the_filter_bar_settings_for_a_named_instance(): void {
		$html = $this->render_search_block(
			[
				'instanceId'      => 'filters1',
				'facetBarLimit'   => 3,
				'filterHeight'    => 36,
				'filterBadgeBg'   => '#7c2d12',
				'filterBadgeText' => '#ffffff',
				'popoverWidth'    => 420,
				'popoverRadius'   => 6,
				'drawerWidth'     => 480,
				'sheetRadius'     => 12,
			]
		);

		$this->assertStringContainsString( 'data-facet-bar-limit="3"', $html );

		foreach ( [
			'--whsc-filter-height:36px',
			'--whsc-filter-badge-bg:#7c2d12',
			'--whsc-filter-badge-text:#ffffff',
			'--whsc-popover-width:420px',
			'--whsc-popover-radius:6px',
			'--whsc-drawer-width:480px',
			'--whsc-sheet-radius:12px',
		] as $declaration ) {
			$this->assertStringContainsString( $declaration, $html );
		}
	}

	public function test_the_filter_bar_shows_five_buttons_by_default(): void {
		$this->assertStringContainsString( 'data-facet-bar-limit="5"', $this->render_search_block( [] ) );

		$attributes = WP_Block_Type_Registry::get_instance()->get_registered( self::BLOCK )->attributes;

		$this->assertSame( [ 'type' => 'number', 'default' => 5 ], $attributes['facetBarLimit'] ?? null );
	}

	public function test_strips_unsafe_characters_from_the_instance_id(): void {
		$html = $this->render_search_block( [ 'instanceId' => 'a<b>"c', 'bgColor' => '#fff' ] );

		$this->assertStringContainsString( 'whsc-instance-abc', $html );
		$this->assertStringNotContainsString( 'whsc-instance-a<b>', $html );
	}

	public function test_filters_unsafe_characters_out_of_a_color_value(): void {
		// The render template filters CSS values to a safe character set, so an
		// injected `}</style><script>` cannot escape the scoped style rule.
		$html = $this->render_search_block(
			[
				'instanceId' => 'inst',
				'bgColor'    => 'red;}</style><script>alert(1)</script>',
			]
		);

		$this->assertStringNotContainsString( '<script>', $html );
		// Exactly one closing tag - the legitimate scoped `<style>` block - which
		// means the injected `</style>` was stripped rather than passed through.
		$this->assertSame( 1, substr_count( $html, '</style>' ) );
	}

	/**
	 * @param  array<string,mixed>  $attrs
	 */
	private function render_search_block( array $attrs ): string {
		return render_block(
			[
				'blockName'    => self::BLOCK,
				'attrs'        => $attrs,
				'innerBlocks'  => [],
				'innerHTML'    => '',
				'innerContent' => [],
			]
		);
	}
}
