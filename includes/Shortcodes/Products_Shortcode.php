<?php
/**
 * `[searcio_products]`: a row of products from the search index, as the
 * products block and the Elementor products widget draw it.
 *
 *     [searcio_products]                              similar to the product on the page
 *     [searcio_products source="category" layout="grid" limit="8"]
 *     [searcio_products source="category" field="categories" value="Jackets"]
 *     [searcio_products id="product-123" heading="You may also like"]
 *
 * source (similar|category), id (a document id; empty is the page's product),
 * field and value (the category's field and value; empty is the page's
 * category), heading, limit (1-24), layout (carousel|grid), banner (yes|no),
 * cards (plugin|server), class. An attribute that is left out takes the
 * default set on the Placement tab. On a page without a product or a category
 * to work from, a row with no subject of its own prints nothing.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Shortcodes;

use Webhead\WP\SearchCloud\DTO\Products_Placement;
use Webhead\WP\SearchCloud\Frontend\Placement_Config;
use Webhead\WP\SearchCloud\Frontend\Search_Surface;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Shortcodes\Abstract_Shortcode;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Products_Shortcode extends Abstract_Shortcode {
	public const TAG = 'searcio_products';

	public function __construct(
		private Placement_Config $config,
		private Search_Surface $surface
	) {}

	public function tag(): string {
		return self::TAG;
	}

	public function description(): string {
		return __( 'A row of products from Searcio: similar to the product on the page, or a category listing.', 'searcio' );
	}

	/**
	 * @return array<string,string>
	 */
	public function defaults(): array {
		return $this->config->products()->to_shortcode_defaults() + [
			'id'    => '',
			'field' => '',
			'value' => '',
			'class' => '',
		];
	}

	/**
	 * @param  array<string,mixed>  $attributes
	 */
	public function render( array $attributes = [], ?string $content = null, string $tag = '' ): string {
		$placement = Products_Placement::from_array( $attributes, $this->config->products() );

		return $this->surface->products(
			$placement,
			[
				'documentId'  => is_string( $attributes['id'] ?? null ) ? $attributes['id'] : '',
				'filterField' => is_string( $attributes['field'] ?? null ) ? $attributes['field'] : '',
				'filterValue' => is_string( $attributes['value'] ?? null ) ? $attributes['value'] : '',
				'className'   => is_string( $attributes['class'] ?? null ) ? $attributes['class'] : '',
			]
		);
	}
}
