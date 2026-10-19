<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit;

/**
 * Resets the shared `$GLOBALS['wp_test_state']` fake (post meta, filters,
 * Polylang stand-ins - see `tests/bootstrap.php`) before every test so one
 * test's setup can never leak into another.
 */
trait Resets_Wp_Test_State {
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['wp_test_state'] = [
			'post_meta'         => [],
			'post_types'        => [],
			'filters'           => [],
			'pll_languages'     => [],
			'pll_post_language' => [],
			'pll_active'        => false,
		];
	}
}
