<?php
/**
 * Local mirror of Search Cloud's `search-config.languages`.
 *
 * A thin wrapper around the {@see Plugin_Settings::ENABLED_LANGUAGES} option -
 * deliberately never calls the Search Cloud API itself, since
 * `Document_Builder` reads this on every document build and the front-end
 * language filter reads it on every page load.
 * {@see \Webhead\WP\SearchCloud\Routing\Search_Config_Endpoint} refreshes this
 * mirror whenever an admin reads or writes the search configuration.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Language_Config {
	public function __construct( private Settings_Manager $settings ) {}

	/**
	 * ISO codes the site has enabled for indexing/search. Empty = unrestricted.
	 *
	 * @return array<int,string>
	 */
	public function enabled_languages(): array {
		$stored = $this->settings->get( Plugin_Settings::ENABLED_LANGUAGES );

		return is_array( $stored ) ? array_values( array_filter( $stored, 'is_string' ) ) : [];
	}

	/**
	 * @param  mixed  $languages
	 */
	public function set_enabled_languages( mixed $languages ): void {
		$languages = is_array( $languages ) ? array_values( array_filter( $languages, 'is_string' ) ) : [];

		$this->settings->set( Plugin_Settings::ENABLED_LANGUAGES, $languages );
	}
}
