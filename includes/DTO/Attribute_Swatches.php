<?php
/**
 * What a swatches plugin made of a WooCommerce attribute.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Enums\Facet_Display;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.3.2
 */
final class Attribute_Swatches {
	/**
	 * Every map is keyed by the term's name, as the index holds it.
	 *
	 * @param  Facet_Display         $display        How the attribute's values are drawn, `auto` unless its type says.
	 * @param  array<string,string>  $colors         Value => hex colour.
	 * @param  array<string,string>  $second_colors  Value => second hex colour, for a value of two colours.
	 * @param  array<string,string>  $images         Value => image URL.
	 * @param  array<string,string>  $labels         Value => the short text a shop shows for it.
	 */
	public function __construct(
		public readonly Facet_Display $display = Facet_Display::Auto,
		public readonly array $colors = [],
		public readonly array $second_colors = [],
		public readonly array $images = [],
		public readonly array $labels = []
	) {}
}
