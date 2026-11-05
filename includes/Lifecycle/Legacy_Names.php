<?php
/**
 * The plugin's first names, still answered where others may use them.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Lifecycle;

use WP_Block_Type_Registry;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * {@see Legacy_Slug} moves what a site stored to the plugin's new names. What
 * it cannot reach still names the old ones: a block in content another plugin
 * keeps, a bookmark of the settings page, a theme's or a snippet's callback
 * on one of the plugin's filters. So the old names go on working:
 *
 * - `webhead-search-cloud/search` and `webhead-search-cloud/products` render as
 *   `searcio/search` and `searcio/products`, kept out of the inserter.
 * - `admin.php?page=webhead-search-cloud` leads to `?page=searcio`.
 * - A callback on a public filter's old name still runs, before the new
 *   name's callbacks, and WordPress says the old name is deprecated.
 *
 * The old Elementor widget names and the old WP-CLI command are answered where
 * those are registered (`Plugin::register_elementor()`, `Command_Registrar`).
 *
 * @since 1.4.0
 */
final class Legacy_Names {
	public const SINCE = '1.4.0';

	private const BLOCKS = [ 'search', 'products' ];

	/**
	 * Old name => [ new name, number of arguments ]: the filters 1.3.1 had.
	 * The others came after the slug moved and never had the old name.
	 */
	private const FILTERS = [
		'webhead_search_cloud/index/allow_protected_meta' => [ 'searcio_index_allow_protected_meta', 3 ],
		'webhead_search_cloud/sync/tick_budget'           => [ 'searcio_sync_tick_budget', 1 ],
	];

	/**
	 * Runs a filter's old name first, so a callback written for it has its
	 * say and a callback on the new name the last word.
	 */
	#[Action( 'init', priority: 0 )]
	public function bridge_filters(): void {
		foreach ( self::FILTERS as $old => [ $new, $arguments ] ) {
			add_filter(
				$new,
				static fn ( mixed ...$values ): mixed => apply_filters_deprecated( $old, $values, self::SINCE, $new ),
				PHP_INT_MIN,
				$arguments
			);
		}
	}

	/**
	 * The old block names, rendered by the new blocks with what they were
	 * saved with. Registered once the plugin's own blocks are.
	 */
	#[Action( 'init', priority: 20 )]
	public function register_blocks(): void {
		$registry = WP_Block_Type_Registry::get_instance();

		foreach ( self::BLOCKS as $block ) {
			$old = Legacy_Slug::OLD_SLUG . '/' . $block;
			$new = $registry->get_registered( Legacy_Slug::NEW_SLUG . '/' . $block );

			if ( null === $new || $registry->is_registered( $old ) ) {
				continue;
			}

			register_block_type(
				$old,
				[
					'attributes'      => $new->attributes,
					'supports'        => [ 'inserter' => false ],
					'render_callback' => static fn ( array $attributes, string $content ): string => render_block(
						[
							'blockName'    => $new->name,
							'attrs'        => $attributes,
							'innerBlocks'  => [],
							'innerHTML'    => $content,
							'innerContent' => [ $content ],
						]
					),
				]
			);
		}
	}

	/** A bookmark of the settings page under its old address. */
	#[Action( 'admin_init' )]
	public function redirect_settings_page(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only reads which page is asked for.
		if ( ! isset( $_GET['page'] ) || Legacy_Slug::OLD_SLUG !== sanitize_key( wp_unslash( $_GET['page'] ) ) ) {
			return;
		}

		wp_safe_redirect( add_query_arg( 'page', Legacy_Slug::NEW_SLUG ) );
		exit;
	}
}
