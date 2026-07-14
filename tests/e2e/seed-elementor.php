<?php
/**
 * Seed a published Elementor page holding a single Search Cloud widget and print
 * its permalink, for the Elementor end-to-end test. Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-elementor.php <mode>
 *
 * Elementor renders the front end from `_elementor_data`, which is not writable
 * over the REST API, so the E2E helper builds the page here instead. Building the
 * Elementor JSON in PHP also avoids shell-quoting it. Prints `WHSC_URL:<permalink>`
 * so the caller can parse the URL unambiguously out of WP-CLI's wrapper output.
 *
 * @var array<int,string> $args Positional WP-CLI args; $args[0] is the trigger mode.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_mode = isset( $args[0] ) ? preg_replace( '/[^a-z]/', '', (string) $args[0] ) : 'icon';
$whsc_mode = in_array( $whsc_mode, [ 'icon', 'box' ], true ) ? $whsc_mode : 'icon';

$whsc_data = [
	[
		'id'       => 'whscsec',
		'elType'   => 'section',
		'settings' => [],
		'elements' => [
			[
				'id'       => 'whsccol',
				'elType'   => 'column',
				'settings' => [ '_column_size' => 100 ],
				'elements' => [
					[
						'id'         => 'whscwid',
						'elType'     => 'widget',
						'widgetType' => 'webhead-search-cloud-search',
						'settings'   => [ 'mode' => $whsc_mode ],
					],
				],
			],
		],
	],
];

$whsc_id = wp_insert_post(
	[
		'post_title'   => 'Elementor E2E',
		'post_status'  => 'publish',
		'post_type'    => 'page',
		'post_content' => '',
	]
);

update_post_meta( $whsc_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $whsc_id, '_elementor_template_type', 'wp-page' );
update_post_meta( $whsc_id, '_elementor_version', '3.0.0' );
update_post_meta( $whsc_id, '_elementor_data', wp_slash( (string) wp_json_encode( $whsc_data ) ) );

echo 'WHSC_URL:' . get_permalink( $whsc_id ) . PHP_EOL;
