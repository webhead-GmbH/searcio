<?php
/**
 * One filter of the search window, as the storefront config hands it over.
 *
 * Its name is not part of it: the storefront names a field from `fieldLabels`
 * of the same config, which already carries the shop's names in the page's
 * language, and from the plugin's own names for its own fields.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Enums\Facet_Display;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Storefront_Facet {
	/**
	 * @param  string                $field    The document field, e.g. `attr_color`.
	 * @param  int                   $order    Its place in the order Search Config lists the facet fields in.
	 * @param  Facet_Display         $display  How its values are drawn.
	 * @param  array<string,string>  $colors   Value => hex colour, for the values that have one.
	 */
	public function __construct(
		public readonly string $field,
		public readonly int $order,
		public readonly Facet_Display $display = Facet_Display::Auto,
		public readonly array $colors = []
	) {}

	/**
	 * What the storefront reads. `colors` is left out when there are none, and
	 * is an object, never a list, when there are.
	 *
	 * @return array{field:string,order:int,display:string,colors?:array<string,string>}
	 */
	public function to_array(): array {
		$out = [
			'field'   => $this->field,
			'order'   => $this->order,
			'display' => $this->display->value,
		];

		if ( [] !== $this->colors ) {
			$out['colors'] = $this->colors;
		}

		return $out;
	}
}
