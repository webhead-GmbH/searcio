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

use Webhead\WP\SearchCloud\Enums\Category_Order;
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
	 * @param  array<string,string>  $second_colors  Value => second hex colour, for a value of two colours.
	 * @param  array<string,string>  $images   Value => image URL.
	 * @param  array<string,string>  $labels   Value => the short text a shop shows for it.
	 * @param  array{depth:int,parents?:array<string,string>,paths?:bool}|null  $tree  The levels to show and each value's parent, for a filter drawn as a tree; `paths` for values that are paths, which hold their parent.
	 * @param  bool                  $hidden   Not drawn: the category filter is drawn from the other category field.
	 * @param  Category_Order|null   $sort     The order of the values, for the category filter; by count when null.
	 * @param  array<int,string>     $values_order  The values in the shop's order, for {@see Category_Order::Shop}.
	 * @param  bool                  $match_all  A result must have every value picked (AND), so each pick changes the counts of the others.
	 */
	public function __construct(
		public readonly string $field,
		public readonly int $order,
		public readonly Facet_Display $display = Facet_Display::Auto,
		public readonly array $colors = [],
		public readonly array $second_colors = [],
		public readonly array $images = [],
		public readonly array $labels = [],
		public readonly ?array $tree = null,
		public readonly bool $hidden = false,
		public readonly ?Category_Order $sort = null,
		public readonly array $values_order = [],
		public readonly bool $match_all = false
	) {}

	/**
	 * What the storefront reads. A map is left out when it has nothing in it,
	 * and is an object, never a list, when it has.
	 *
	 * @return array{field:string,order:int,display:string,colors?:array<string,string>,secondColors?:array<string,string>,images?:array<string,string>,labels?:array<string,string>,tree?:array<string,mixed>,hidden?:true,sort?:string,valuesOrder?:array<int,string>}
	 */
	public function to_array(): array {
		$out = [
			'field'   => $this->field,
			'order'   => $this->order,
			'display' => $this->display->value,
		];

		$maps = [
			'colors'       => $this->colors,
			'secondColors' => $this->second_colors,
			'images'       => $this->images,
			'labels'       => $this->labels,
		];

		foreach ( $maps as $key => $map ) {
			if ( [] !== $map ) {
				$out[ $key ] = $map;
			}
		}

		if ( null !== $this->tree ) {
			$out['tree'] = $this->tree;
		}

		if ( $this->hidden ) {
			$out['hidden'] = true;
		}

		if ( null !== $this->sort ) {
			$out['sort'] = $this->sort->value;
		}

		if ( [] !== $this->values_order ) {
			$out['valuesOrder'] = array_values( $this->values_order );
		}

		if ( $this->match_all ) {
			$out['match'] = 'all';
		}

		return $out;
	}
}
