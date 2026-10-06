<?php
/**
 * Site Health tests.
 *
 * Registered while the plugin boots, which is on every request of the site, so
 * registering translates nothing: the name a test is listed under is given in
 * English and put into the reader's language when WordPress asks for the list,
 * which it does on the Site Health screen and nowhere else. What a test
 * reports is worked out, and translated, when the test runs.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Health;

use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Sync\Sync_State;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Health_Result;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Site_Health_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.1.0
 */
final class Health_Tests {
	public function __construct(
		private Site_Health_Manager $site_health_manager,
		private Search_Cloud_Client $client,
		private Index_Config $index_config,
		private Sync_State $sync_state
	) {}

	/**
	 * Reachability is an async REST test, not a direct test, so it only makes
	 * a live HTTP call when a user opens the Site Health page.
	 */
	public function register(): void {
		$this->site_health_manager->register_direct_test(
			'webhead_search_cloud_connection_configured',
			'webhead Search Cloud connection',
			$this->connection_configured( ... )
		);

		$this->site_health_manager->register_async_rest_test(
			'webhead_search_cloud_connection_reachable',
			'webhead Search Cloud reachability',
			$this->connection_reachable( ... )
		);

		$this->site_health_manager->register_direct_test(
			'webhead_search_cloud_indexing_configured',
			'webhead Search Cloud indexing',
			$this->indexing_configured( ... )
		);

		// Surface content left out of the index by language restriction instead
		// of letting it go silently missing.
		$this->site_health_manager->register_direct_test(
			'webhead_search_cloud_language_coverage',
			'webhead Search Cloud language coverage',
			$this->language_coverage( ... )
		);
	}

	/**
	 * After the framework has added the tests to WordPress's list (priority 10).
	 *
	 * @param  array<string,array<string,array<string,mixed>>>  $tests
	 * @return array<string,array<string,array<string,mixed>>>
	 */
	#[Filter( 'site_status_tests', priority: 11 )]
	public function translate_labels( array $tests ): array {
		$labels = [
			'webhead_search_cloud_connection_configured' => __( 'webhead Search Cloud connection', 'webhead-search-cloud' ),
			'webhead_search_cloud_connection_reachable'  => __( 'webhead Search Cloud reachability', 'webhead-search-cloud' ),
			'webhead_search_cloud_indexing_configured'   => __( 'webhead Search Cloud indexing', 'webhead-search-cloud' ),
			'webhead_search_cloud_language_coverage'     => __( 'webhead Search Cloud language coverage', 'webhead-search-cloud' ),
		];

		foreach ( $tests as $type => $of_type ) {
			foreach ( array_intersect_key( $labels, (array) $of_type ) as $identifier => $label ) {
				$tests[ $type ][ $identifier ]['label'] = $label;
			}
		}

		return $tests;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function connection_configured(): array {
		if ( ! $this->client->is_configured() ) {
			return Health_Result::recommended(
				test: 'webhead_search_cloud_connection_configured',
				label: __( 'webhead Search Cloud is not connected yet', 'webhead-search-cloud' ),
				badge_label: 'Search Cloud',
				description: '<p>' . esc_html__( 'Add your site ID, write key, and write secret on the Connection tab before syncing content.', 'webhead-search-cloud' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'webhead_search_cloud_connection_configured',
			label: __( 'webhead Search Cloud connection is configured', 'webhead-search-cloud' ),
			badge_label: 'Search Cloud',
			description: '<p>' . esc_html__( 'Connection credentials are saved.', 'webhead-search-cloud' ) . '</p>'
		)->to_wordpress_result();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function connection_reachable(): array {
		if ( ! $this->client->is_configured() ) {
			return Health_Result::recommended(
				test: 'webhead_search_cloud_connection_reachable',
				label: __( 'webhead Search Cloud is not connected yet', 'webhead-search-cloud' ),
				badge_label: 'Search Cloud',
				description: '<p>' . esc_html__( 'Connect the plugin on the Connection tab, then re-run this check.', 'webhead-search-cloud' ) . '</p>'
			)->to_wordpress_result();
		}

		$response = $this->client->health();

		if ( $response->transport_error || ! $response->ok() ) {
			return Health_Result::critical(
				test: 'webhead_search_cloud_connection_reachable',
				label: __( 'webhead Search Cloud could not be reached', 'webhead-search-cloud' ),
				badge_label: 'Search Cloud',
				description: '<p>' . esc_html__( 'The health check to Search Cloud failed. Check the Connection tab and verify your credentials.', 'webhead-search-cloud' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'webhead_search_cloud_connection_reachable',
			label: __( 'webhead Search Cloud is reachable', 'webhead-search-cloud' ),
			badge_label: 'Search Cloud',
			description: '<p>' . esc_html__( 'The last health check succeeded.', 'webhead-search-cloud' ) . '</p>'
		)->to_wordpress_result();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function indexing_configured(): array {
		$indexable = $this->index_config->indexable_post_types();

		if ( [] === $indexable ) {
			return Health_Result::recommended(
				test: 'webhead_search_cloud_indexing_configured',
				label: __( 'No content types are enabled for indexing', 'webhead-search-cloud' ),
				badge_label: 'Search Cloud',
				description: '<p>' . esc_html__( 'Enable at least one post type or WooCommerce products on the Indexing tab so sync has something to send.', 'webhead-search-cloud' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'webhead_search_cloud_indexing_configured',
			label: __( 'Content types are enabled for indexing', 'webhead-search-cloud' ),
			badge_label: 'Search Cloud',
			description: sprintf(
				/* translators: %d: number of enabled content types. */
				'<p>' . esc_html__( '%d content type(s) are enabled for indexing.', 'webhead-search-cloud' ) . '</p>',
				count( $indexable )
			)
		)->to_wordpress_result();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function language_coverage(): array {
		$history = $this->sync_state->history(
			[ 'per_page' => 1, 'order_by' => 'id', 'order' => 'desc' ]
		);
		$skipped = (int) ( $history['items'][0]['language_skipped'] ?? 0 );

		if ( $skipped > 0 ) {
			return Health_Result::recommended(
				test: 'webhead_search_cloud_language_coverage',
				label: sprintf(
					/* translators: %d: number of posts skipped. */
					__( '%d post(s) were skipped from the last sync due to language', 'webhead-search-cloud' ),
					$skipped
				),
				badge_label: 'Search Cloud',
				description: '<p>' . esc_html__( "These posts are in a language that isn't enabled on the Search Config tab. Enable their language there, or leave them out of search intentionally.", 'webhead-search-cloud' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'webhead_search_cloud_language_coverage',
			label: __( 'No content was skipped due to language', 'webhead-search-cloud' ),
			badge_label: 'Search Cloud',
			description: '<p>' . esc_html__( 'Every indexable post is in an enabled language, or the site has not restricted languages.', 'webhead-search-cloud' ) . '</p>'
		)->to_wordpress_result();
	}
}
