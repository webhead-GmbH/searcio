<?php
/**
 * A "Searcio" box on Appearance > Menus that adds a search item to a classic
 * menu: a custom link to `#searcio` with the class `searcio-open`, which the
 * storefront opens the search from. Its label is the admin's to change, like
 * any menu item's.
 *
 * The box is drawn as WordPress draws its own: a checklist in a
 * `posttype-*` panel with a "Add to menu" button whose id names it, which is
 * what the menu screen's script reads the selected items from.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Admin;

use Webhead\WP\SearchCloud\Frontend\Site_Placement;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Menu_Item {
	private const PANEL = 'posttype-webhead-search-cloud';

	#[Action( 'admin_head-nav-menus.php' )]
	public function add_meta_box(): void {
		add_meta_box(
			'webhead-search-cloud-menu-item',
			__( 'Searcio', 'searcio' ),
			[ $this, 'render' ],
			'nav-menus',
			'side',
			'low'
		);
	}

	public function render(): void {
		$label = __( 'Search', 'searcio' );
		?>
		<div id="<?php echo esc_attr( self::PANEL ); ?>" class="posttypediv">
			<p class="description"><?php esc_html_e( 'A menu item that opens the Searcio search.', 'searcio' ); ?></p>
			<div id="tabs-panel-webhead-search-cloud" class="tabs-panel tabs-panel-active">
				<ul id="webhead-search-cloud-checklist" class="categorychecklist form-no-clear">
					<li>
						<label class="menu-item-title">
							<input type="checkbox" class="menu-item-checkbox" name="menu-item[-1][menu-item-object-id]" value="-1">
							<?php esc_html_e( 'Searcio search', 'searcio' ); ?>
						</label>
						<input type="hidden" class="menu-item-type" name="menu-item[-1][menu-item-type]" value="custom">
						<input type="hidden" class="menu-item-title" name="menu-item[-1][menu-item-title]" value="<?php echo esc_attr( $label ); ?>">
						<input type="hidden" class="menu-item-url" name="menu-item[-1][menu-item-url]" value="<?php echo esc_attr( Site_Placement::OPEN_HASH ); ?>">
						<input type="hidden" class="menu-item-classes" name="menu-item[-1][menu-item-classes]" value="<?php echo esc_attr( Site_Placement::OPEN_CLASS ); ?>">
					</li>
				</ul>
			</div>
			<p class="button-controls wp-clearfix">
				<span class="add-to-menu">
					<button type="submit" class="button submit-add-to-menu right" value="<?php esc_attr_e( 'Add to menu', 'searcio' ); ?>" name="add-post-type-menu-item" id="<?php echo esc_attr( 'submit-' . self::PANEL ); ?>"><?php esc_html_e( 'Add to menu', 'searcio' ); ?></button>
					<span class="spinner"></span>
				</span>
			</p>
		</div>
		<?php
	}
}
