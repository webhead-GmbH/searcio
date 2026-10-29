<?php
/**
 * How a product row placed without a block or a widget looks: by the
 * `[searcio_products]` shortcode and the classic products widget.
 *
 * Stored on the Placement tab as their defaults, by the shortcode's attribute
 * names. The subject of a row (the product, or the field and value of a
 * category) is never a default: it belongs to the one row it is written in,
 * and a row without one takes it from the page.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Frontend\Attribute_Value as Value;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Products_Placement {
	public const SOURCES = [ 'similar', 'category' ];

	public const LAYOUTS = [ 'carousel', 'grid' ];

	public const CARDS = [ 'plugin', 'server' ];

	/** A category row asks for up to 24, a similar row for up to 20; {@see \Webhead\WP\SearchCloud\Frontend\Product_List_Markup} holds each to its own. */
	public const LIMIT_MAX = 24;

	/**
	 * @param  string  $source   `similar` products, or a `category` listing.
	 * @param  string  $layout   `carousel` or `grid`.
	 * @param  ?int    $limit    How many products; null is the storefront's own number.
	 * @param  bool    $banner   Whether a merchandising banner of the listing is shown above it.
	 * @param  string  $heading  The row's title; empty is the storefront's own.
	 * @param  string  $cards    `plugin` or `server` cards.
	 */
	public function __construct(
		public readonly string $source = 'similar',
		public readonly string $layout = 'carousel',
		public readonly ?int $limit = null,
		public readonly bool $banner = true,
		public readonly string $heading = '',
		public readonly string $cards = 'plugin'
	) {}

	/**
	 * Reads stored settings or shortcode attributes; a key that is missing or
	 * holds what it may not is taken from `$fallback`.
	 *
	 * @param  array<string,mixed>  $data
	 */
	public static function from_array( array $data, ?self $fallback = null ): self {
		$fallback ??= new self();

		// 0, empty or unreadable is the storefront's own number.
		$limit = array_key_exists( 'limit', $data ) ? Value::number( $data['limit'], 0, self::LIMIT_MAX ) : $fallback->limit;
		$limit = 0 === $limit ? null : $limit;

		return new self(
			source: Value::choice( $data['source'] ?? null, self::SOURCES, $fallback->source ),
			layout: Value::choice( $data['layout'] ?? null, self::LAYOUTS, $fallback->layout ),
			limit: $limit,
			banner: Value::flag( $data['banner'] ?? null, $fallback->banner ),
			heading: array_key_exists( 'heading', $data ) ? Value::text( $data['heading'] ) : $fallback->heading,
			cards: Value::choice( $data['cards'] ?? null, self::CARDS, $fallback->cards )
		);
	}

	/**
	 * @return array{source:string,layout:string,limit:?int,banner:bool,heading:string,cards:string}
	 */
	public function to_array(): array {
		return [
			'source'  => $this->source,
			'layout'  => $this->layout,
			'limit'   => $this->limit,
			'banner'  => $this->banner,
			'heading' => $this->heading,
			'cards'   => $this->cards,
		];
	}

	/**
	 * By the names {@see \Webhead\WP\SearchCloud\Frontend\Product_List_Markup::render()} reads.
	 *
	 * @return array<string,mixed>
	 */
	public function to_markup_attributes(): array {
		return [
			'source'     => $this->source,
			'layout'     => $this->layout,
			'limit'      => $this->limit,
			'showBanner' => $this->banner,
			'heading'    => $this->heading,
			'cardSource' => $this->cards,
		];
	}

	public function with_heading( string $heading ): self {
		return self::from_array( [ 'heading' => $heading ], $this );
	}

	/**
	 * @return array<string,string>
	 */
	public function to_shortcode_defaults(): array {
		return Value::to_strings( $this->to_array() );
	}
}
