<?php
/**
 * The floating search button: a button fixed to a bottom corner of every
 * page, for a theme that has no search in its header on a phone.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Enums\Floating_Devices;
use Webhead\WP\SearchCloud\Enums\Floating_Position;
use Webhead\WP\SearchCloud\Enums\Floating_Style;
use Webhead\WP\SearchCloud\Frontend\Attribute_Value as Value;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Floating_Button {
	/** The default distance from the bottom edge, in px: above WooCommerce's store notice and most cookie bars' collapsed tab. */
	public const OFFSET = 24;

	/** The most it may be asked to be lifted: a cart bar and a cookie bar together. */
	public const OFFSET_MAX = 400;

	public function __construct(
		public readonly bool $enabled = false,
		public readonly Floating_Position $position = Floating_Position::End,
		public readonly Floating_Devices $devices = Floating_Devices::Phones,
		public readonly Floating_Style $style = Floating_Style::Icon,
		public readonly int $offset = self::OFFSET
	) {}

	/**
	 * @param  array<string,mixed>  $data
	 */
	public static function from_array( array $data ): self {
		return new self(
			enabled: Value::flag( $data['enabled'] ?? null, false ),
			position: Floating_Position::from_storage( $data['position'] ?? null ),
			devices: Floating_Devices::from_storage( $data['devices'] ?? null ),
			style: Floating_Style::from_storage( $data['style'] ?? null ),
			offset: Value::number( $data['offset'] ?? null, 0, self::OFFSET_MAX ) ?? self::OFFSET
		);
	}

	/**
	 * @return array{enabled:bool,position:string,devices:string,style:string,offset:int}
	 */
	public function to_array(): array {
		return [
			'enabled'  => $this->enabled,
			'position' => $this->position->value,
			'devices'  => $this->devices->value,
			'style'    => $this->style->value,
			'offset'   => $this->offset,
		];
	}
}
