<?php
/**
 * The live preview on the Placement tab: a page of the site that holds only
 * the search trigger, the open search window or the floating button, drawn
 * from settings the admin has not saved yet.
 *
 * It is a page of the site, not of the admin, so it is drawn in the theme's
 * stylesheets and fonts, as a visitor would see it. Only a user who may manage
 * the settings opens it, with a nonce of the Placement tab; it is never
 * cached or indexed.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\DTO\Floating_Button;
use Webhead\WP\SearchCloud\DTO\Placement_Options;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Action;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Shortcodes\Allowed_Html;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Placement_Preview {
	public const QUERY = 'searcio-preview';

	public const NONCE = 'searcio_placement_preview';

	private const VIEWS = [ 'trigger', 'modal', 'floating' ];

	/** The instance class the preview draws the search under, which the editor's Look styles name. */
	public const INSTANCE = 'whsc-instance-preview';

	public function __construct(
		private Placement_Config $config,
		private Search_Surface $surface
	) {}

	/**
	 * Whether this request is the preview: the site-wide placements leave it
	 * alone, so it shows what it was asked for and nothing else.
	 */
	public static function is_preview(): bool {
		return isset( $_GET[ self::QUERY ] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only says which page this is; render() checks the nonce.
	}

	/**
	 * Where the preview is, and the nonce the Placement tab sends with it.
	 *
	 * @return array{url:string,nonce:string}
	 */
	public static function url_base(): array {
		return [
			'url'   => add_query_arg( self::QUERY, '1', home_url( '/' ) ),
			'nonce' => wp_create_nonce( self::NONCE ),
		];
	}

	/**
	 * The preview's searches are the admin's, not a visitor's: the storefront
	 * marks them `preview`, which Searcio meters but keeps out of the site's
	 * search statistics.
	 */
	#[Filter( 'searcio_storefront_is_preview' )]
	public function mark_preview( mixed $is_preview ): bool {
		return self::is_preview() || (bool) $is_preview;
	}

	#[Action( 'template_redirect', priority: 1 )]
	public function render(): void {
		if ( ! self::is_preview() ) {
			return;
		}

		$nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';

		if ( ! current_user_can( Plugin_Capabilities::MANAGE_SETTINGS ) || false === wp_verify_nonce( $nonce, self::NONCE ) ) {
			wp_die(
				esc_html__( 'This preview opens from the Placement tab of the Searcio settings.', 'searcio' ),
				esc_html__( 'Preview', 'searcio' ),
				[ 'response' => 403 ]
			);
		}

		$view = isset( $_GET['view'] ) ? sanitize_key( wp_unslash( $_GET['view'] ) ) : '';
		$view = in_array( $view, self::VIEWS, true ) ? $view : 'trigger';

		// Settings the admin has not saved yet, cleaned as a save would clean them.
		$sent    = isset( $_GET['placement'] ) ? json_decode( sanitize_textarea_field( wp_unslash( $_GET['placement'] ) ), true ) : null;
		$options = is_array( $sent ) ? Placement_Options::from_array( $sent ) : $this->config->options();

		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
		show_admin_bar( false );

		$markup = match ( $view ) {
			// On every screen width, so a desktop admin sees it too.
			'floating' => $this->surface->site(
				$options->search,
				Floating_Button::from_array( [ 'enabled' => true, 'devices' => 'all' ] + $options->floating->to_array() )
			),
			// The storefront opens the window of a trigger that says so at once,
			// and leaves the focus where it is, as it does in the Elementor editor.
			'modal'    => $this->surface->search( $options->search, [ 'editorPreview' => true ] ),
			default    => $this->surface->search( $options->search ),
		};

		$this->print_page( $markup, $view );

		exit;
	}

	private function print_page( string $markup, string $view ): void {
		$handle = \Webhead\WP\SearchCloud\PLUGIN_SLUG . '-preview';

		wp_register_style( $handle, false, [], \Webhead\WP\SearchCloud\VERSION );
		wp_add_inline_style( $handle, 'html, body.searcio-preview { min-height: 100%; margin: 0; } body.searcio-preview { padding: 24px; box-sizing: border-box; }' );
		wp_enqueue_style( $handle );

		wp_register_script( $handle, false, [], \Webhead\WP\SearchCloud\VERSION, [ 'in_footer' => true ] );
		wp_add_inline_script( $handle, self::live_look_script() );
		wp_enqueue_script( $handle );
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( [ 'searcio-preview', 'searcio-preview--' . $view ] ); ?>>
	<?php
	echo wp_kses( $markup, Allowed_Html::defaults() );
	wp_footer();
	?>
</body>
</html>
		<?php
	}

	/**
	 * The Look editor sends the CSS of what it has on screen here, as it
	 * changes (`/placement/look-css`, for this instance class), and this page
	 * draws it without loading again. Only a message from the admin's origin
	 * counts, which a site may serve apart from its pages, and what it carries
	 * is set as text. The style comes last in the page, after the footer's, so
	 * it outweighs the stored placement's.
	 */
	public static function live_look_script(): string {
		$admin  = wp_parse_url( admin_url() );
		$origin = is_array( $admin ) && isset( $admin['scheme'], $admin['host'] )
			? $admin['scheme'] . '://' . $admin['host'] . ( isset( $admin['port'] ) ? ':' . $admin['port'] : '' )
			: '';

		return 'var origin = ' . wp_json_encode( $origin ) . ' || window.location.origin;' . <<<'JS'

( function () {
	var fonts = document.createElement( 'link' );
	var css = document.createElement( 'style' );

	fonts.id = 'whsc-look-fonts';
	fonts.rel = 'stylesheet';
	fonts.href = 'data:text/css,';
	css.id = 'whsc-look-live';
	document.body.appendChild( fonts );
	document.body.appendChild( css );

	window.addEventListener( 'message', function ( event ) {
		if ( event.origin !== origin || ! event.data || 'searcio-look' !== event.data.type ) {
			return;
		}

		css.textContent = String( event.data.css || '' );
		fonts.href = /^https:\/\/fonts\.googleapis\.com\//.test( event.data.fonts || '' ) ? event.data.fonts : 'data:text/css,';
	} );

	if ( window.parent !== window ) {
		window.parent.postMessage( { type: 'searcio-look-ready' }, origin );
	}
}() );
JS;
	}
}
