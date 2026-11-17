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
use Webhead\WP\SearchCloud\Enums\Account_Refusal;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Routing\Connection_Endpoint;
use Webhead\WP\SearchCloud\Sync\Sync_Keys;
use Webhead\WP\SearchCloud\Sync\Sync_State;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Attributes\Filter;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Health_Result;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Health\Site_Health_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.1.0
 */
final class Health_Tests {
	/** How late a task may be before Site Health calls it overdue: WP-Cron is allowed its minute or two. */
	private const TASK_OVERDUE_AFTER = 900;

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
			'searcio_connection_configured',
			'Searcio connection',
			$this->connection_configured( ... )
		);

		$this->site_health_manager->register_async_rest_test(
			'searcio_connection_reachable',
			'Searcio reachability',
			$this->connection_reachable( ... )
		);

		$this->site_health_manager->register_direct_test(
			'searcio_indexing_configured',
			'Searcio indexing',
			$this->indexing_configured( ... )
		);

		// The syncs run through WP-Cron, which runs only while the site is
		// visited, or from a cron job of the server.
		$this->site_health_manager->register_direct_test(
			'searcio_background_tasks',
			'Searcio background tasks',
			$this->background_tasks( ... )
		);

		// Surface content left out of the index by language restriction instead
		// of letting it go silently missing.
		$this->site_health_manager->register_direct_test(
			'searcio_language_coverage',
			'Searcio language coverage',
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
			'searcio_connection_configured' => __( 'Searcio connection', 'searcio' ),
			'searcio_connection_reachable'  => __( 'Searcio reachability', 'searcio' ),
			'searcio_indexing_configured'   => __( 'Searcio indexing', 'searcio' ),
			'searcio_language_coverage'     => __( 'Searcio language coverage', 'searcio' ),
			'searcio_background_tasks'      => __( 'Searcio background tasks', 'searcio' ),
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
				test: 'searcio_connection_configured',
				label: __( 'Searcio is not connected yet', 'searcio' ),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( 'Add your site ID, write key, and write secret on the Connection tab before syncing content.', 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'searcio_connection_configured',
			label: __( 'Searcio connection is configured', 'searcio' ),
			badge_label: 'Searcio',
			description: '<p>' . esc_html__( 'Connection credentials are saved.', 'searcio' ) . '</p>'
		)->to_wordpress_result();
	}

	/**
	 * @return array<string,mixed>
	 */
	private function connection_reachable(): array {
		if ( ! $this->client->is_configured() ) {
			return Health_Result::recommended(
				test: 'searcio_connection_reachable',
				label: __( 'Searcio is not connected yet', 'searcio' ),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( 'Connect the plugin on the Connection tab, then re-run this check.', 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		// Site Health reports the connection as it is now, not as it was kept.
		$response = $this->client->health( true );

		if ( $response->transport_error || ! $response->ok() ) {
			return Health_Result::critical(
				test: 'searcio_connection_reachable',
				label: __( 'Searcio could not be reached', 'searcio' ),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( 'The health check to Searcio failed. Check the Connection tab and verify your credentials.', 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		// Searcio answers the health check whatever the account's state, so a
		// reachable service can still be refusing every search and sync.
		$refusal = Account_Refusal::from_health( $response->body() );

		if ( null !== $refusal ) {
			return Health_Result::critical(
				test: 'searcio_connection_reachable',
				label: $refusal->label(),
				badge_label: 'Searcio',
				description: '<p>' . esc_html( $refusal->message() ) . '</p>',
				actions: $this->refusal_action( $refusal, $response->body() )
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'searcio_connection_reachable',
			label: __( 'Searcio is reachable', 'searcio' ),
			badge_label: 'Searcio',
			description: '<p>' . esc_html__( 'The last health check succeeded.', 'searcio' ) . '</p>'
		)->to_wordpress_result();
	}

	/**
	 * The way back from a refusal: the plan the account is missing, the
	 * billing page an overdue payment is settled on (the plan's upgrade link
	 * leads there), or support, which only the platform can lift a suspension
	 * through.
	 *
	 * @param  array<string,mixed>  $health  The `/health` body.
	 */
	private function refusal_action( Account_Refusal $refusal, array $health ): string {
		$plan_url = $health['plan']['upgrade_url'] ?? null;
		$plan_url = is_string( $plan_url ) ? esc_url_raw( $plan_url, [ 'https', 'http' ] ) : '';

		[ $url, $text ] = match ( $refusal ) {
			Account_Refusal::NoActivePlan   => [ $plan_url, __( 'Choose a plan', 'searcio' ) ],
			Account_Refusal::PaymentOverdue => [ $plan_url, __( 'Go to billing', 'searcio' ) ],
			Account_Refusal::Suspended      => [ Connection_Endpoint::support_url( $health['account']['support_url'] ?? null ), __( 'Contact Searcio support', 'searcio' ) ],
		};

		if ( '' === $url ) {
			return '';
		}

		return sprintf(
			'<p><a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a></p>',
			esc_url( $url ),
			esc_html( $text )
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private function indexing_configured(): array {
		$indexable = $this->index_config->indexable_post_types();

		if ( [] === $indexable ) {
			return Health_Result::recommended(
				test: 'searcio_indexing_configured',
				label: __( 'No content types are enabled for indexing', 'searcio' ),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( 'Enable at least one post type or WooCommerce products on the Indexing tab so sync has something to send.', 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'searcio_indexing_configured',
			label: __( 'Content types are enabled for indexing', 'searcio' ),
			badge_label: 'Searcio',
			description: sprintf(
				/* translators: %d: number of enabled content types. */
				'<p>' . esc_html__( '%d content type(s) are enabled for indexing.', 'searcio' ) . '</p>',
				count( $indexable )
			)
		)->to_wordpress_result();
	}

	/**
	 * Whether WP-Cron starts the plugin's tasks when they are due: the
	 * scheduled sync, the sync's next step and the changes waiting to be sent.
	 * A site nobody visits, or one whose host blocks the request WordPress
	 * makes to itself, runs none of them: a sync stood at 0 of 539 for twenty
	 * minutes, and the nightly one did not run, with nothing said.
	 *
	 * @return array<string,mixed>
	 */
	private function background_tasks(): array {
		$now     = time();
		$overdue = [];

		foreach ( [ Sync_Keys::HOOK_TICK, Sync_Keys::HOOK_DRAIN, Sync_Keys::HOOK_SCHEDULED ] as $hook ) {
			$next = wp_next_scheduled( $hook );

			if ( false !== $next && $next < $now - self::TASK_OVERDUE_AFTER ) {
				$overdue[] = $now - (int) $next;
			}
		}

		if ( [] === $overdue ) {
			return Health_Result::good(
				test: 'searcio_background_tasks',
				label: __( 'Searcio background tasks run on time', 'searcio' ),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( 'Nothing the plugin schedules, such as the sync of your changes, is overdue.', 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::recommended(
			test: 'searcio_background_tasks',
			label: __( 'Searcio background tasks are overdue', 'searcio' ),
			badge_label: 'Searcio',
			description: '<p>' . esc_html(
				sprintf(
					/* translators: %d: how many minutes the longest overdue task is late. */
					__( 'A task of the plugin, such as the sync of your changes, has been due for %d minutes. WordPress starts such tasks through WP-Cron, which only runs while the site is visited, and not at all where the host blocks the request WordPress makes to itself or WP-Cron is switched off.', 'searcio' ),
					(int) floor( max( $overdue ) / MINUTE_IN_SECONDS )
				)
			) . '</p><p>' . esc_html__( 'Ask your host to call WP-Cron from the server every minute, for example with this command, and turn off the one WordPress starts itself with DISABLE_WP_CRON if it is not off already:', 'searcio' ) . '</p><p><code>wp cron event run --due-now</code></p>'
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
				test: 'searcio_language_coverage',
				label: sprintf(
					/* translators: %d: number of posts skipped. */
					__( '%d post(s) were skipped from the last sync due to language', 'searcio' ),
					$skipped
				),
				badge_label: 'Searcio',
				description: '<p>' . esc_html__( "These posts are in a language that isn't enabled on the Search Config tab. Enable their language there, or leave them out of search intentionally.", 'searcio' ) . '</p>'
			)->to_wordpress_result();
		}

		return Health_Result::good(
			test: 'searcio_language_coverage',
			label: __( 'No content was skipped due to language', 'searcio' ),
			badge_label: 'Searcio',
			description: '<p>' . esc_html__( 'Every indexable post is in an enabled language, or the site has not restricted languages.', 'searcio' ) . '</p>'
		)->to_wordpress_result();
	}
}
