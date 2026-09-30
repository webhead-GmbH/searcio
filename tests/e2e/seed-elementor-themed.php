<?php
/**
 * Seed a published Elementor page whose Search Cloud widget has the new style
 * controls actually set, and print its permalink. Used to prove the Elementor
 * path end to end: a value saved on the widget reaches the storefront, either
 * as the `--whsc-*` custom property the modal reads or, for typography, as a
 * rule that outranks the storefront stylesheet.
 *
 *   wp eval-file .../tests/e2e/seed-elementor-themed.php [icon|box]
 *
 * The typography values below are asserted by `specs/elementor-widget.spec.js`;
 * change them together.
 *
 * `_elementor_data` is not writable over REST, so the page is built here - see
 * `seed-elementor.php`, which this mirrors. Prints `WHSC_URL:<permalink>`.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @var array<int,string> $args Positional WP-CLI args; $args[0] is the trigger mode.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_mode = isset( $args[0] ) ? preg_replace( '/[^a-z]/', '', (string) $args[0] ) : 'icon';
$whsc_mode = in_array( $whsc_mode, [ 'icon', 'box' ], true ) ? $whsc_mode : 'icon';

/**
 * One `Group_Control_Typography` value set, as Elementor stores it.
 *
 * @return array<string,mixed>
 */
$whsc_typography = static function ( string $name, int $size, string $weight, int $line_height, string $transform ): array {
	return [
		$name . '_typography'     => 'custom',
		$name . '_font_size'      => [ 'unit' => 'px', 'size' => $size ],
		$name . '_font_weight'    => $weight,
		$name . '_line_height'    => [ 'unit' => 'px', 'size' => $line_height ],
		$name . '_text_transform' => $transform,
	];
};

$whsc_settings = [
	'mode' => $whsc_mode,

	// Colour controls store a plain string; only sliders take unit/size.

	// Photo-search button.
	'visual_color'            => '#b91c1c',
	'visual_bg'               => '#fee2e2',

	// Guided quiz.
	'quiz_question'           => '#1d4ed8',
	'quiz_option_bg'          => '#eff6ff',
	'quiz_option_text'        => '#1e3a8a',
	'quiz_option_border'      => '#93c5fd',
	'quiz_option_radius'      => [ 'unit' => 'px', 'size' => 8 ],

	// Merchandising banner.
	'banner_bg'               => '#fef3c7',
	'banner_text'             => '#92400e',

	// The overlay, card image, sale badge, carousel card and filter group
	// name, each away from its default.
	'modal_overlay'           => 'rgba(18, 52, 86, 0.8)',
	'card_image_ratio'        => '4 / 5',
	'card_image_bg'           => '#fde68a',
	'card_badge_bg'           => '#7c2d12',
	'card_badge_text'         => '#fef3c7',
	'card_badge_radius'       => [ 'unit' => 'px', 'size' => 0 ],
	'carousel_card_width'     => [ 'unit' => 'px', 'size' => 260 ],
	'facet_group_color'       => '#065f46',
];

// Each size, weight and line height differs from the storefront stylesheet's
// own for that element, so a value that loses to it cannot pass as applied.
$whsc_settings = array_merge(
	$whsc_settings,
	$whsc_typography( 'trigger_box_typography', 20, '700', 28, 'uppercase' ),
	$whsc_typography( 'field_typography', 22, '700', 30, 'uppercase' ),
	$whsc_typography( 'title_typography', 19, '300', 27, 'lowercase' ),
	$whsc_typography( 'popular_typography', 18, '700', 26, 'uppercase' ),
	$whsc_typography( 'facet_typography', 17, '800', 25, 'uppercase' ),
	$whsc_typography( 'facet_count_typography', 16, '700', 24, 'uppercase' ),
	$whsc_typography( 'card_title_typography', 23, '300', 31, 'uppercase' ),
	$whsc_typography( 'card_price_typography', 21, '800', 29, 'none' ),
	$whsc_typography( 'card_price_suffix_typography', 15, '700', 19, 'uppercase' )
);

$whsc_data = [
	[
		'id'       => 'whscsec2',
		'elType'   => 'section',
		'settings' => [],
		'elements' => [
			[
				'id'       => 'whsccol2',
				'elType'   => 'column',
				'settings' => [ '_column_size' => 100 ],
				'elements' => [
					[
						'id'         => 'whscwid2',
						'elType'     => 'widget',
						'widgetType' => 'webhead-search-cloud-search',
						'settings'   => $whsc_settings,
					],
				],
			],
		],
	],
];

$whsc_id = wp_insert_post(
	[
		'post_title'   => 'Elementor themed final',
		'post_name'    => 'elementor-themed-final',
		'post_status'  => 'publish',
		'post_type'    => 'page',
		'post_content' => '',
	]
);

update_post_meta( $whsc_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $whsc_id, '_elementor_template_type', 'wp-page' );
update_post_meta( $whsc_id, '_elementor_version', '3.0.0' );
update_post_meta( $whsc_id, '_elementor_data', wp_slash( (string) wp_json_encode( $whsc_data ) ) );

// Elementor caches the compiled CSS per post; drop it so the new settings render.
if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
	( new \Elementor\Core\Files\CSS\Post( $whsc_id ) )->update();
}

echo 'WHSC_URL:' . get_permalink( $whsc_id ) . "\n";
