<?php
/**
 * Set the plan tier the site keeps, or forget it. Run through WP-CLI:
 *
 *   wp eval-file .../tests/e2e/seed-plan.php free    # a Free plan
 *   wp eval-file .../tests/e2e/seed-plan.php paid    # any other plan
 *   wp eval-file .../tests/e2e/seed-plan.php clear   # no tier known
 *
 * The tier is a mirror of what Searcio says and has no REST route, so a
 * spec sets it here. The storefront decides on the Searcio logo from it.
 *
 * `wp eval-file` runs this through eval(), so it must not declare strict_types.
 *
 * @var array<int,string> $args
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

$whsc_tier = isset( $args[0] ) ? (string) $args[0] : 'clear';

update_option( 'webhead_search_cloud_plan_tier', in_array( $whsc_tier, [ 'free', 'paid' ], true ) ? $whsc_tier : '' );

echo 'OK';
