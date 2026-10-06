<?php
/**
 * Give the test site the styles of a site somebody has designed, or take them
 * away again. Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-site-styles.php set        # style the elements of the site
 *   wp eval-file .../tests/e2e/seed-site-styles.php set body   # set the site's own type instead
 *   wp eval-file .../tests/e2e/seed-site-styles.php set all    # both
 *   wp eval-file .../tests/e2e/seed-site-styles.php clear      # put back what was there
 *
 * Most sites this plugin is installed on are built with Elementor, on a kit a
 * designer has customized, and a kit's Site Settings are written for the whole
 * page: `.elementor-kit-7 button {}`, `.elementor-kit-7 input:not(…):focus {}`,
 * `.elementor-kit-7 a {}`. A theme does the same with bare `button {}` and
 * `h3 {}`, and a designer's own CSS reaches for an id. The search modal is
 * drawn in `body`, under all three. `set` writes every Site Settings control
 * that styles an element the storefront also draws - typography, links,
 * headings, buttons, form fields, images - to a value nobody could miss, and
 * adds a stylesheet of the kind a theme or a designer writes, through
 * Appearance > Customize > Additional CSS. `specs/site-styles.spec.js` then
 * reads the storefront with and without them.
 *
 * The site's own type (Site Settings > Typography > Body) is a separate
 * switch, because the storefront is meant to follow it: the modal takes the
 * page's font family and base size. What is written on `button`, `input`, `a`,
 * `h3` or `img` it is not meant to follow, and with `set` alone the storefront
 * has to come out exactly as it does on a site with none of it.
 *
 * Without Elementor only the Additional CSS is written.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @var array<int,string> $args
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_action     = isset( $args[0] ) ? (string) $args[0] : 'set';
$whsc_scope      = isset( $args[1] ) ? (string) $args[1] : 'elements';
$whsc_elements   = in_array( $whsc_scope, [ 'elements', 'all' ], true );
$whsc_body       = in_array( $whsc_scope, [ 'body', 'all' ], true );
$whsc_kit_backup = 'webhead_search_cloud_e2e_kit_backup';
$whsc_css_backup = 'webhead_search_cloud_e2e_css_backup';
$whsc_kit_id     = (int) get_option( 'elementor_active_kit', 0 );
$whsc_has_kit    = $whsc_kit_id > 0 && class_exists( '\Elementor\Plugin' ) && 'publish' === get_post_status( $whsc_kit_id );

$whsc_clear_elementor_cache = static function (): void {
	if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
		\Elementor\Plugin::$instance->files_manager->clear_cache();
	}
};

if ( 'clear' === $whsc_action ) {
	if ( $whsc_has_kit && false !== get_option( $whsc_kit_backup, false ) ) {
		$whsc_previous = get_option( $whsc_kit_backup );

		if ( is_array( $whsc_previous ) && [] !== $whsc_previous ) {
			update_post_meta( $whsc_kit_id, '_elementor_page_settings', wp_slash( $whsc_previous ) );
		} else {
			delete_post_meta( $whsc_kit_id, '_elementor_page_settings' );
		}
	}

	if ( false !== get_option( $whsc_css_backup, false ) ) {
		wp_update_custom_css_post( (string) get_option( $whsc_css_backup ) );
	}

	delete_option( $whsc_kit_backup );
	delete_option( $whsc_css_backup );
	$whsc_clear_elementor_cache();

	echo 'OK';

	return;
}

/** One side-by-side value, as Elementor stores a dimensions control. */
$whsc_sides = static fn ( int $size ): array => [
	'unit'     => 'px',
	'top'      => (string) $size,
	'right'    => (string) $size,
	'bottom'   => (string) $size,
	'left'     => (string) $size,
	'isLinked' => true,
];

$whsc_px = static fn ( float $size ): array => [ 'unit' => 'px', 'size' => $size ];

/**
 * One `Group_Control_Typography` value set, as Elementor stores it.
 *
 * @return array<string,mixed>
 */
$whsc_typography = static function ( string $name, string $family, int $size, string $weight, string $transform, string $style, string $decoration ) use ( $whsc_px ): array {
	return [
		$name . '_typography'      => 'custom',
		$name . '_font_family'     => $family,
		$name . '_font_size'       => $whsc_px( $size ),
		$name . '_font_weight'     => $weight,
		$name . '_text_transform'  => $transform,
		$name . '_font_style'      => $style,
		$name . '_text_decoration' => $decoration,
		$name . '_line_height'     => $whsc_px( $size + 18 ),
		$name . '_letter_spacing'  => $whsc_px( 3 ),
		$name . '_word_spacing'    => $whsc_px( 6 ),
	];
};

/**
 * One `Group_Control_Border` value set.
 *
 * @return array<string,mixed>
 */
$whsc_border = static fn ( string $name, string $style, int $width, string $color ): array => [
	$name . '_border' => $style,
	$name . '_width'  => $whsc_sides( $width ),
	$name . '_color'  => $color,
];

/**
 * One `Group_Control_Box_Shadow` value set.
 *
 * @return array<string,mixed>
 */
$whsc_shadow = static fn ( string $name, string $color ): array => [
	$name . '_box_shadow_type' => 'yes',
	$name . '_box_shadow'      => [ 'horizontal' => 6, 'vertical' => 6, 'blur' => 0, 'spread' => 2, 'color' => $color ],
];

// Site Settings > Typography > Body: what the storefront follows.
$whsc_body_settings = array_merge(
	[ 'body_color' => '#b91c1c' ],
	$whsc_typography( 'body_typography', 'Georgia', 22, '700', 'uppercase', 'italic', 'none' )
);

$whsc_settings = array_merge(
	// Site Settings > Typography > Paragraph and Link.
	[
		'paragraph_spacing' => $whsc_px( 40 ),
		'link_normal_color' => '#db2777',
		'link_hover_color'  => '#7c3aed',
	],
	$whsc_typography( 'link_normal_typography', 'Georgia', 22, '900', 'uppercase', 'italic', 'overline' ),
	$whsc_typography( 'link_hover_typography', 'Georgia', 22, '900', 'uppercase', 'italic', 'line-through' ),
	// Site Settings > Buttons.
	[
		'button_text_shadow_text_shadow_type' => 'yes',
		'button_text_shadow_text_shadow'      => [ 'horizontal' => 2, 'vertical' => 2, 'blur' => 0, 'color' => '#000000' ],
		'button_text_color'                   => '#fef08a',
		'button_background_background'        => 'classic',
		'button_background_color'             => '#dc2626',
		'button_border_radius'                => $whsc_sides( 30 ),
		'button_hover_text_color'             => '#000000',
		'button_hover_background_background'  => 'classic',
		'button_hover_background_color'       => '#facc15',
		'button_hover_border_radius'          => $whsc_sides( 2 ),
		'button_padding'                      => $whsc_sides( 30 ),
	],
	$whsc_typography( 'button_typography', 'Courier New', 26, '900', 'uppercase', 'italic', 'underline' ),
	$whsc_border( 'button_border', 'dashed', 4, '#000000' ),
	$whsc_border( 'button_hover_border', 'dotted', 6, '#16a34a' ),
	$whsc_shadow( 'button_box_shadow', '#1d4ed8' ),
	$whsc_shadow( 'button_hover_box_shadow', '#be185d' ),
	// Site Settings > Form Fields.
	[
		'form_label_color'                  => '#ea580c',
		'form_field_text_color'             => '#1e3a8a',
		'form_field_accent_color'           => '#be185d',
		'form_field_background_color'       => '#fde047',
		'form_field_border_radius'          => $whsc_sides( 24 ),
		'form_field_padding'                => $whsc_sides( 22 ),
		'form_field_focus_text_color'       => '#064e3b',
		'form_field_focus_accent_color'     => '#0e7490',
		'form_field_focus_background_color' => '#bbf7d0',
		'form_field_focus_border_radius'    => $whsc_sides( 0 ),
	],
	$whsc_typography( 'form_label_typography', 'Courier New', 26, '800', 'uppercase', 'italic', 'underline' ),
	$whsc_typography( 'form_field_typography', 'Courier New', 24, '700', 'uppercase', 'italic', 'none' ),
	$whsc_border( 'form_field_border', 'double', 6, '#7c2d12' ),
	$whsc_border( 'form_field_focus_border', 'solid', 8, '#be123c' ),
	$whsc_shadow( 'form_field_box_shadow', '#a16207' ),
	$whsc_shadow( 'form_field_focus_box_shadow', '#15803d' ),
	// Site Settings > Images.
	[
		'image_border_radius'       => $whsc_sides( 40 ),
		'image_opacity'             => [ 'unit' => 'px', 'size' => 0.6 ],
		'image_hover_border_radius' => $whsc_sides( 0 ),
		'image_hover_opacity'       => [ 'unit' => 'px', 'size' => 0.3 ],
	],
	$whsc_border( 'image_border', 'solid', 6, '#f97316' ),
	$whsc_border( 'image_hover_border', 'dashed', 8, '#7c3aed' ),
	$whsc_shadow( 'image_box_shadow', '#000000' )
);

// Site Settings > Typography > H1 to H6.
foreach ( [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ] as $whsc_heading ) {
	$whsc_settings[ $whsc_heading . '_color' ] = '#0e7490';
	$whsc_settings                              = array_merge(
		$whsc_settings,
		$whsc_typography( $whsc_heading . '_typography', 'Courier New', 34, '300', 'uppercase', 'italic', 'underline' )
	);
}

$whsc_settings = array_merge( $whsc_elements ? $whsc_settings : [], $whsc_body ? $whsc_body_settings : [] );

if ( $whsc_has_kit ) {
	$whsc_current = get_post_meta( $whsc_kit_id, '_elementor_page_settings', true );

	// Kept once: a second `set` must not record the customized kit as the original.
	add_option( $whsc_kit_backup, is_array( $whsc_current ) ? $whsc_current : [] );
	update_post_meta(
		$whsc_kit_id,
		'_elementor_page_settings',
		wp_slash( array_merge( is_array( $whsc_current ) ? $whsc_current : [], $whsc_settings ) )
	);
}

/*
 * What a theme or a designer writes: bare elements, a role, and an id, which is
 * the heaviest selector a site's own stylesheet normally reaches. Nothing here
 * is `!important`: a site that marks a declaration that way still wins, and
 * nothing short of another one stops it.
 */
$whsc_css = <<<'CSS'
/* webhead-search-cloud e2e: a designed site */
button, [type="button"], [type="submit"] { font-family: "Courier New", monospace; font-size: 25px; font-style: italic; letter-spacing: 5px; word-spacing: 9px; text-transform: uppercase; text-shadow: 2px 2px 0 #f00; text-decoration: underline wavy; border: 5px dashed #7c3aed; border-radius: 40px; padding: 25px 35px; margin: 12px; background: #111 linear-gradient(#444, #000); color: #ff0; box-shadow: 8px 8px 0 #f0f; min-height: 90px; min-width: 120px; line-height: 3; opacity: 0.7; transform: rotate(-2deg); filter: saturate(3); }
button:hover { background: #ff0; color: #111; border-color: #0f0; transform: scale(1.2); }
button:focus, button:focus-visible { outline: 6px dotted #0ff; outline-offset: 8px; box-shadow: 0 0 0 12px #f00; }
button svg { width: 60px; height: 60px; fill: #0f0; }
input, textarea, select { font-family: "Courier New", monospace; font-size: 25px; font-style: italic; letter-spacing: 4px; text-transform: uppercase; text-indent: 30px; border: 6px double #f00; border-radius: 0; padding: 20px; margin: 10px; background: #ffe4e6; color: #881337; height: 80px; box-shadow: inset 0 0 0 4px #00f; }
input:focus, textarea:focus { outline: 8px solid #00f; outline-offset: 6px; box-shadow: 0 0 0 10px #0f0; background: #bbf7d0; }
input::placeholder, textarea::placeholder { color: #f0f; font-style: italic; opacity: 0.4; text-transform: uppercase; }
label { color: #ea580c; font-size: 26px; font-style: italic; text-transform: uppercase; letter-spacing: 4px; display: block; margin: 20px 0; }
a { color: #db2777; text-decoration: overline wavy #00f; font-weight: 900; font-style: italic; letter-spacing: 3px; text-transform: uppercase; }
a:hover { color: #7c3aed; text-decoration: line-through; background: #fef08a; }
a:focus, a:focus-visible { outline: 5px dashed #f97316; outline-offset: 6px; background: #fde68a; }
h1, h2, h3, h4, h5, h6 { font-family: "Courier New", monospace; font-size: 40px; font-style: italic; font-weight: 300; text-transform: uppercase; text-decoration: underline; letter-spacing: 6px; line-height: 2.5; color: #0e7490; margin: 40px 0; padding: 20px; border-bottom: 6px double #0e7490; text-shadow: 2px 2px 0 #fde047; }
p { margin: 40px 0; font-size: 24px; text-indent: 3em; line-height: 3; letter-spacing: 2px; }
ul, ol { list-style: square inside; margin: 30px; padding-left: 60px; border: 3px dotted #000; }
li { margin: 20px 0; padding: 10px; border-bottom: 2px dotted #000; list-style: square inside; }
img { border: 6px solid #f97316; border-radius: 40px; opacity: 0.6; box-shadow: 0 0 0 8px #000; padding: 10px; margin: 10px; filter: grayscale(1); }
table { border: 4px solid #f00; border-collapse: separate; border-spacing: 12px; margin: 30px 0; font-size: 22px; }
th, td { border: 3px solid #f00; padding: 20px; background: #fee2e2; text-transform: uppercase; font-style: italic; text-align: right; }
small { font-size: 22px; text-transform: uppercase; color: #f00; }
del, ins { color: #00f; font-size: 26px; background: #ff0; text-decoration: overline; }
strong, b { color: #f00; font-size: 26px; text-transform: uppercase; }
form { border: 6px dashed #f00; padding: 30px; margin: 30px; background: #fef9c3; }
[role="tab"], [role="tablist"] { background: #000; color: #0f0; border: 4px solid #f0f; padding: 30px; letter-spacing: 6px; }
[role="dialog"] { border: 10px solid #f00; border-radius: 60px; }
#wp--skip-link--target a, .wp-site-blocks a, body a[href] { color: #be123c; text-decoration: underline dotted; letter-spacing: 4px; }
#wp--skip-link--target button, .wp-site-blocks button, body button[type] { background: #7c2d12; color: #fff; border: 7px ridge #000; letter-spacing: 6px; text-transform: uppercase; }
#wp--skip-link--target input, .wp-site-blocks input, body input[type] { background: #fecaca; border: 7px ridge #000; font-size: 27px; text-transform: uppercase; }
#wp--skip-link--target img, .wp-site-blocks img { border: 9px ridge #000; opacity: 0.5; }
#wp--skip-link--target h2, #wp--skip-link--target h3, .wp-site-blocks h2, .wp-site-blocks h3 { font-size: 44px; color: #7c3aed; letter-spacing: 8px; }
#wp--skip-link--target li, #wp--skip-link--target p, .wp-site-blocks li { letter-spacing: 5px; text-transform: uppercase; font-style: italic; }
CSS;

// A theme's own type, where there is no kit to set it on.
$whsc_body_css = <<<'CSS'
/* webhead-search-cloud e2e: the site's own type */
body { font-family: Georgia, serif; font-size: 22px; font-weight: 700; font-style: italic; line-height: 40px; letter-spacing: 3px; word-spacing: 6px; text-transform: uppercase; color: #b91c1c; }
CSS;

add_option( $whsc_css_backup, (string) wp_get_custom_css() );
wp_update_custom_css_post( ( $whsc_elements ? $whsc_css : '' ) . ( $whsc_body ? "
" . $whsc_body_css : '' ) );
$whsc_clear_elementor_cache();

echo 'OK';
