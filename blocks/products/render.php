<?php
/**
 * Searcio products block render template.
 *
 * @var array<string,mixed> $attributes
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Frontend\Product_List_Markup;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Shortcodes\Allowed_Html;

defined( 'ABSPATH' ) || exit;

$searcio_markup = Product_List_Markup::render(
	[
		'source'      => $attributes['source'] ?? 'similar',
		'documentId'  => $attributes['documentId'] ?? '',
		'filterField' => $attributes['filterField'] ?? '',
		'filterValue' => $attributes['filterValue'] ?? '',
		'heading'     => $attributes['heading'] ?? '',
		'limit'       => $attributes['limit'] ?? null,
		'layout'      => $attributes['layout'] ?? 'carousel',
		'showBanner'  => $attributes['showBanner'] ?? true,
		'cardSource'  => $attributes['cardSource'] ?? 'plugin',
		'className'   => $attributes['className'] ?? '',
	]
);

// Renders nothing on a page with no product and no category to work from, so
// only enqueue the front-end bundle when there is actually a row to hydrate.
if ( '' === $searcio_markup ) {
	return;
}

// WordPress includes this file itself, so it asks for the running plugin.
Plugin::instance()?->get_assets()->enqueue( Frontend_Config::ENTRY );

// The markup a shortcode may print, as the framework lists it: the row is an
// empty `div` with `data-*` attributes, which the list keeps.
echo wp_kses(
	sprintf(
		'<div %1$s>%2$s</div>',
		get_block_wrapper_attributes( [ 'class' => 'searcio-products-block' ] ),
		$searcio_markup
	),
	Allowed_Html::defaults()
);
