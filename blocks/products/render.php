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

defined( 'ABSPATH' ) || exit;

$markup = Product_List_Markup::render(
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
if ( '' === $markup ) {
	return;
}

// WordPress includes this file itself, so it asks for the running plugin.
Plugin::instance()?->get_assets()->enqueue( Frontend_Config::ENTRY );

// Not run through kses: it would strip the `data-*` attributes the front-end
// hydrates from. Every part is escaped inside Product_List_Markup::render(),
// which is the same contract the search block's trigger markup has.
printf(
	'<div %1$s>%2$s</div>',
	wp_kses_data( get_block_wrapper_attributes( [ 'class' => 'webhead-search-cloud-products-block' ] ) ),
	$markup // phpcs:ignore -- markup is escaped inside Product_List_Markup::render().
);
