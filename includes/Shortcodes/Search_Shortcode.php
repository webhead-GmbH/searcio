<?php
/**
 * `[searcio]`: the search, for a theme or a page builder that has no block or
 * Elementor widget for it. Avia's code block, WPBakery's shortcode element,
 * Divi's code module, a classic Text widget and a template's `do_shortcode()`
 * all print it.
 *
 * Every attribute is optional. One that is left out, or that holds what it may
 * not, takes the default set on the Placement tab, so a shop sets its look
 * once and writes `[searcio]`:
 *
 *     [searcio mode="box" placeholder="Search the shop" width="320" align="center"]
 *
 * mode (icon|box), placeholder, voice (yes|no), trigger (submit|type),
 * count (yes|no), type (a post type, e.g. product), highlights (newest|featured),
 * filters (0-8), animation (none|fade|slide-down|slide-up|zoom),
 * cards (plugin|server), width (px, 0 fills), align (start|center|end),
 * accent, background, text, icon_color (colours), radius (px), class.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Shortcodes;

use Webhead\WP\SearchCloud\DTO\Search_Placement;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Frontend\Search_Surface;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Shortcodes\Abstract_Shortcode;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Search_Shortcode extends Abstract_Shortcode {
	public const TAG = 'searcio';

	public function __construct(
		private Placement_Config $config,
		private Search_Surface $surface
	) {}

	public function tag(): string {
		return self::TAG;
	}

	public function description(): string {
		return __( 'The Searcio search: a magnifier or a search field that opens the search window.', 'searcio' );
	}

	/**
	 * The Placement tab's settings, in the page's language. `shortcode_atts()`
	 * fills an attribute that was left out from these, and drops one this
	 * list does not name.
	 *
	 * @return array<string,string>
	 */
	public function defaults(): array {
		return $this->config->search()->to_shortcode_defaults() + [ 'class' => '' ];
	}

	/**
	 * @param  array<string,mixed>  $attributes
	 */
	public function render( array $attributes = [], ?string $content = null, string $tag = '' ): string {
		$placement = Search_Placement::from_array( $attributes, $this->config->search() );
		$class     = is_string( $attributes['class'] ?? null )
			? implode( ' ', array_map( 'sanitize_html_class', preg_split( '/\s+/', trim( $attributes['class'] ) ) ?: [] ) )
			: '';

		return $this->surface->search( $placement, [ 'className' => trim( $class ) ] );
	}
}
