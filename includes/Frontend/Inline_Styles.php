<?php
/**
 * The CSS of one placement, handed to WordPress to print.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * A placement's colours, sizes and look are CSS of its own, on a class only it
 * carries. WordPress prints that CSS as the inline style of a handle of its
 * own: in the head when the page is drawn before it, as a block theme's is,
 * and with the footer's styles when the placement is drawn in the body of a
 * classic theme, as core does with the styles of its block supports.
 *
 * Two placements that look the same share a class, and the same CSS is added
 * to it once; different CSS for one class is added after what it has, so the
 * later wins, as it would in the page.
 *
 * @since 1.4.0
 */
final class Inline_Styles {
	/**
	 * @param  string  $id   The instance class the CSS is written for.
	 * @param  string  $css  Rules, without a `<style>` element.
	 */
	public static function add( string $id, string $css ): void {
		$id = (string) preg_replace( '/[^a-zA-Z0-9_-]/', '', $id );

		if ( '' === $id || '' === trim( $css ) ) {
			return;
		}

		$handle = self::handle( $id );

		if ( ! wp_style_is( $handle, 'registered' ) ) {
			wp_register_style( $handle, false, [], \Webhead\WP\SearchCloud\VERSION );
		}

		$added = wp_styles()->get_data( $handle, 'after' );

		if ( ! is_array( $added ) || ! in_array( $css, $added, true ) ) {
			wp_add_inline_style( $handle, $css );
		}

		wp_enqueue_style( $handle );
	}

	/** A stylesheet a placement's CSS asks for, a Google font's. */
	public static function add_stylesheet( string $url ): void {
		if ( '' === $url ) {
			return;
		}

		// No version: the address names exactly what it loads.
		wp_enqueue_style( self::handle( 'fonts-' . substr( md5( $url ), 0, 8 ) ), $url, [], null ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- a Google Fonts address, which a version would only change.
	}

	public static function handle( string $id ): string {
		return \Webhead\WP\SearchCloud\PLUGIN_SLUG . '-' . $id;
	}
}
