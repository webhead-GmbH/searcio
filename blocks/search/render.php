<?php
/**
 * Searcio search block render template.
 *
 * @var array<string,mixed> $attributes
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

use Webhead\WP\SearchCloud\Frontend\Frontend_Config;
use Webhead\WP\SearchCloud\Frontend\Inline_Styles;
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Frontend\Style_Tokens;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Support\Allowed_Html;

defined( 'ABSPATH' ) || exit;

// WordPress includes this file itself, so it asks for the running plugin.
Plugin::instance()?->get_assets()->enqueue( Frontend_Config::ENTRY );

$searcio_instance_id    = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $attributes['instanceId'] ?? '' ) );
$searcio_instance_class = '' !== $searcio_instance_id ? 'whsc-instance-' . $searcio_instance_id : '';

// The search modal is drawn in `body`, so the same instance class is copied
// onto it for these custom properties to reach it.
Inline_Styles::add( $searcio_instance_class, Style_Tokens::rule( $searcio_instance_class, $attributes ) );

// The markup a shortcode may print, as the framework lists it: the trigger is
// an empty `div` with `data-*` attributes, which the list keeps.
echo wp_kses(
	sprintf(
		'<div %1$s>%2$s</div>',
		get_block_wrapper_attributes( [ 'class' => 'searcio-search-block' ] ),
		Trigger_Markup::render( array_merge( $attributes, [ 'instanceClass' => $searcio_instance_class ] ) )
	),
	Allowed_Html::defaults()
);
