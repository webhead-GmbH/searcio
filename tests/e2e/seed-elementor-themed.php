<?php
/**
 * Seed a published Elementor page whose Search Cloud widget has the new style
 * controls actually set, and print its permalink. Used to prove the Elementor
 * path end to end: a value saved on the widget reaches the storefront as the
 * `--whsc-*` custom property the modal reads.
 *
 *   wp eval-file .../tests/e2e/seed-elementor-themed.php
 *
 * `_elementor_data` is not writable over REST, so the page is built here - see
 * `seed-elementor.php`, which this mirrors. Prints `WHSC_URL:<permalink>`.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_settings = [
	'mode' => 'icon',

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
];

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
