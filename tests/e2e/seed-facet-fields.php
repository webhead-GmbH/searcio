<?php
/**
 * Set the facet fields the site keeps from Search Config, in their order, or
 * forget them. Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-facet-fields.php categories,brand,price
 *   wp eval-file .../tests/e2e/seed-facet-fields.php clear
 *
 * The plugin keeps a copy of `facet_fields` whenever an admin reads or writes
 * the search configuration; the e2e site reaches no service, so a spec sets
 * the copy here. The search window lays its filter bar out in this order.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @var array<int,string> $args
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_fields = isset( $args[0] ) && 'clear' !== $args[0] ? array_values( array_filter( array_map( 'trim', explode( ',', (string) $args[0] ) ) ) ) : [];

update_option( 'webhead_search_cloud_facet_fields', $whsc_fields );

echo 'OK';
