<?php
/**
 * Set how the search window's category filter lists the categories, with a
 * small tree of categories, or take both away. Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-category-filter.php nested 2
 *   wp eval-file .../tests/e2e/seed-category-filter.php main
 *   wp eval-file .../tests/e2e/seed-category-filter.php clear
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @var array<int,string> $args
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_tree = [
	'Clothing' => [ 'Jackets' => [ 'Rain jackets' ] ],
	'Shoes'    => [],
];

$whsc_mode = $args[0] ?? 'clear';

if ( 'clear' === $whsc_mode ) {
	delete_option( 'webhead_search_cloud_category_filter' );
	delete_option( 'webhead_search_cloud_category_filter_depth' );

	foreach ( [ 'Rain jackets', 'Jackets', 'Clothing', 'Shoes' ] as $whsc_name ) {
		$whsc_term = get_term_by( 'name', $whsc_name, 'category' );

		if ( $whsc_term ) {
			wp_delete_term( $whsc_term->term_id, 'category' );
		}
	}

	echo 'OK';

	return;
}

$whsc_insert = static function ( string $name, int $parent ): int {
	$existing = term_exists( $name, 'category', $parent );
	$term     = $existing ?: wp_insert_term( $name, 'category', [ 'parent' => $parent ] );

	return (int) $term['term_id'];
};

foreach ( $whsc_tree as $whsc_main => $whsc_children ) {
	$whsc_main_id = $whsc_insert( $whsc_main, 0 );

	foreach ( $whsc_children as $whsc_child => $whsc_grandchildren ) {
		$whsc_child_id = $whsc_insert( $whsc_child, $whsc_main_id );

		foreach ( $whsc_grandchildren as $whsc_grandchild ) {
			$whsc_insert( $whsc_grandchild, $whsc_child_id );
		}
	}
}

update_option( 'webhead_search_cloud_category_filter', $whsc_mode );
update_option( 'webhead_search_cloud_category_filter_depth', (int) ( $args[1] ?? 2 ) );

echo 'OK';
