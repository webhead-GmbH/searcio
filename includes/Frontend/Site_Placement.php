<?php
/**
 * The site-wide ways to place the search, set on the Placement tab.
 *
 * - The site's own search forms: `get_search_form()`, WooCommerce's
 *   `get_product_search_form()` and the Search and Product Search blocks are
 *   drawn as a Searcio search box. The form they replace stays in the page
 *   beside it until the storefront has drawn the box, so `?s=` still searches
 *   WordPress without JavaScript.
 * - Elements of the theme, by CSS selector, the keyboard shortcut and the
 *   floating button: these need the search on every page, so the entry is
 *   enqueued on every page of the front end, and a trigger they open is
 *   printed at the end of it.
 * - A link to `#searcio` or an element with the class `searcio-open`. These
 *   work wherever the search is loaded, and a page whose content, menus or
 *   widgets hold one loads it.
 *
 * Nothing here runs in the admin, a REST request, a feed, Elementor's editor
 * canvas or the Placement tab's own preview.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\DTO\Search_Placement;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Assets\Asset_Registry;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Site_Placement {
	/** The class that opens the search from any element. */
	public const OPEN_CLASS = 'searcio-open';

	/** The link target that opens the search. */
	public const OPEN_HASH = '#searcio';

	public function __construct(
		private Placement_Config $config,
		private Search_Surface $surface,
		private Asset_Registry $assets
	) {}

	#[Filter( 'get_search_form', priority: 99 )]
	public function take_over_search_form( mixed $form ): mixed {
		if ( ! $this->takes_over() ) {
			return $form;
		}

		return $this->surface->search( $this->box(), [], is_string( $form ) ? $form : '' );
	}

	/**
	 * WooCommerce's product search, held to products when the defaults hold it
	 * to nothing.
	 */
	#[Filter( 'get_product_search_form', priority: 99 )]
	public function take_over_product_search_form( mixed $form ): mixed {
		if ( ! $this->takes_over() ) {
			return $form;
		}

		return $this->surface->search( $this->box( 'product' ), [], is_string( $form ) ? $form : '' );
	}

	/**
	 * The Search block. One set to show its button alone, which opens a field
	 * when it is clicked, becomes a magnifier.
	 *
	 * @param  array<string,mixed>  $block
	 */
	#[Filter( 'render_block_core/search', priority: 99, accepted_args: 2 )]
	public function take_over_search_block( mixed $content, mixed $block = [] ): mixed {
		if ( ! is_string( $content ) || '' === $content || ! $this->takes_over() ) {
			return $content;
		}

		$button_only = 'button-only' === ( is_array( $block ) ? ( $block['attrs']['buttonPosition'] ?? '' ) : '' );

		return $this->surface->search( $button_only ? $this->icon() : $this->box(), [], $content );
	}

	#[Filter( 'render_block_woocommerce/product-search', priority: 99 )]
	public function take_over_product_search_block( mixed $content ): mixed {
		if ( ! is_string( $content ) || '' === $content || ! $this->takes_over() ) {
			return $content;
		}

		return $this->surface->search( $this->box( 'product' ), [], $content );
	}

	#[Action( 'wp_enqueue_scripts' )]
	public function enqueue_on_every_page(): void {
		if ( $this->is_storefront() && $this->config->options()->needs_every_page() ) {
			$this->assets->enqueue( Frontend_Config::ENTRY );
		}
	}

	/**
	 * Loads the search on a page that holds a link or an element that opens
	 * it. The page's content, its menus, its widgets and what Elementor draws
	 * pass through here on their way out, unchanged.
	 */
	#[Filter( 'the_content', priority: 99 )]
	#[Filter( 'wp_nav_menu_items', priority: 99 )]
	#[Filter( 'widget_text', priority: 99 )]
	#[Filter( 'widget_block_content', priority: 99 )]
	#[Filter( 'render_block_core/navigation-link', priority: 99 )]
	#[Filter( 'render_block_core/button', priority: 99 )]
	#[Filter( 'elementor/frontend/the_content', priority: 99 )]
	public function load_for_openers( mixed $html ): mixed {
		if (
			is_string( $html )
			&& ( str_contains( $html, self::OPEN_CLASS ) || str_contains( $html, self::OPEN_HASH ) )
			&& $this->is_storefront()
		) {
			$this->assets->enqueue( Frontend_Config::ENTRY );
		}

		return $html;
	}

	/**
	 * The trigger the site-wide ways open, on every page that loads the
	 * search: the floating button, or one that draws nothing. Late in the
	 * footer, so a popup or a widget printed in `wp_footer` that loads the
	 * search is counted, and before the scripts are printed at 20.
	 */
	#[Action( 'wp_footer', priority: 19 )]
	public function print_site_trigger(): void {
		if ( ! $this->is_storefront() ) {
			return;
		}

		$handle = $this->assets->script_handle( Frontend_Config::ENTRY );

		if ( null === $handle || ! wp_script_is( $handle, 'enqueued' ) ) {
			return;
		}

		$options = $this->config->options();

		echo $this->surface->site( $this->config->search(), $options->floating ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by Trigger_Markup and Style_Tokens.
	}

	/**
	 * Polylang keeps a string only for the request that registers it, and
	 * lists the strings on an admin screen.
	 */
	#[Action( 'admin_init' )]
	public function register_strings(): void {
		if ( $this->config->uses_polylang() ) {
			$this->config->register_strings();
		}
	}

	private function takes_over(): bool {
		return $this->config->options()->takeover && $this->is_storefront();
	}

	/** The defaults as a box, which is what a form it replaces is. */
	private function box( string $type = '' ): Search_Placement {
		$search = $this->config->search();

		return Search_Placement::from_array(
			array_filter(
				[
					'mode' => 'box',
					'type' => '' === $search->type && '' !== $type ? $type : null,
				],
				static fn ( mixed $value ): bool => null !== $value
			),
			$search
		);
	}

	private function icon(): Search_Placement {
		return Search_Placement::from_array( [ 'mode' => 'icon' ], $this->config->search() );
	}

	/**
	 * A page a visitor sees. The block editor draws a Search block over REST,
	 * and Elementor's canvas is a page of the front end where a click on the
	 * theme's search must select it, not open Searcio.
	 */
	private function is_storefront(): bool {
		if ( is_admin() || is_feed() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return false;
		}

		if ( Placement_Preview::is_preview() ) {
			return false;
		}

		return ! $this->in_elementor_editor();
	}

	private function in_elementor_editor(): bool {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}

		$elementor = \Elementor\Plugin::$instance;

		return isset( $elementor->preview ) && $elementor->preview->is_preview_mode();
	}
}
