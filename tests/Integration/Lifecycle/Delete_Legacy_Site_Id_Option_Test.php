<?php
/**
 * Legacy site-id option removal.
 *
 * The option is dead since the connection went key-relative, but it stayed in
 * the database and went stale - a site reconnected to a different tenant kept
 * reporting the old id. The upgrade step clears it on existing installs.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Lifecycle;

use Webhead\WP\SearchCloud\Lifecycle\Upgrade_Steps\Delete_Legacy_Site_Id_Option;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Delete_Legacy_Site_Id_Option_Test extends Integration_Test_Case {

	public function test_it_removes_the_option_and_its_metadata_sibling(): void {
		update_option( 'webhead_search_cloud_site_id', 5 );
		update_option( 'webhead_search_cloud_site_id_metadata', [ 'version' => 1 ] );

		( new Delete_Legacy_Site_Id_Option() )->run();

		$this->assertFalse( get_option( 'webhead_search_cloud_site_id', false ) );
		$this->assertFalse( get_option( 'webhead_search_cloud_site_id_metadata', false ) );
	}

	/** Upgrade steps may be replayed, so a missing option must not be an error. */
	public function test_it_is_safe_to_run_when_the_option_is_already_gone(): void {
		delete_option( 'webhead_search_cloud_site_id' );

		( new Delete_Legacy_Site_Id_Option() )->run();

		$this->assertFalse( get_option( 'webhead_search_cloud_site_id', false ) );
	}

	/** The step only runs on installs upgrading past this version. */
	public function test_it_is_pinned_to_the_release_that_introduces_it(): void {
		$this->assertSame( '1.0.3', ( new Delete_Legacy_Site_Id_Option() )->version() );
	}
}
