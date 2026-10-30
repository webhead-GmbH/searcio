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
use Webhead\WP\SearchCloud\Plugin;
use Webhead\WP\SearchCloud\Frontend\Style_Tokens;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;

defined( 'ABSPATH' ) || exit;

// WordPress includes this file itself, so it asks for the running plugin.
Plugin::instance()?->get_assets()->enqueue( Frontend_Config::ENTRY );

$instance_id    = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $attributes['instanceId'] ?? '' ) );
$instance_class = '' !== $instance_id ? 'whsc-instance-' . $instance_id : '';

// The search modal is drawn in `body`, so the same instance class is copied
// onto it for these custom properties to reach it.
echo Style_Tokens::style_element( $instance_class, $attributes ); // phpcs:ignore -- every value is reduced to a safe character set inside.

printf(
	'<div %1$s>%2$s</div>',
	wp_kses_data(
		get_block_wrapper_attributes( [ 'class' => 'webhead-search-cloud-search-block' ] )
	),
	Trigger_Markup::render( array_merge( $attributes, [ 'instanceClass' => $instance_class ] ) ) // phpcs:ignore -- markup is escaped inside Trigger_Markup::render().
);
