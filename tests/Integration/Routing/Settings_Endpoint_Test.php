<?php
/**
 * Settings REST endpoint integration tests.
 *
 * The write credentials are the reason this file exists. They are REST-exposed
 * so a pasted key can be saved through this route, and `masked: true` does not
 * keep them out of a response - the settings export never consults it - so a
 * user with only the view capability was being sent the stored write key and
 * secret. Encrypted, but still the only copy of the secret outside the
 * database, in the hands of someone with no use for it.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Routing;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use Webhead\WP\SearchCloud\Capabilities\Plugin_Capabilities;
use Webhead\WP\SearchCloud\Routing\Settings_Endpoint;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Settings_Endpoint_Test extends Integration_Test_Case {
	private const ROUTE = '/webhead-search-cloud/v1/settings';

	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		do_action( 'rest_api_init' );

		$this->connect_client();
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	public function test_route_is_registered(): void {
		$this->assertArrayHasKey( self::ROUTE, $this->server->get_routes() );
	}

	/**
	 * The screen only asks whether a credential is saved, so that is all it is
	 * told: not the key, and not the ciphertext either.
	 */
	public function test_reading_reports_a_stored_credential_without_sending_it(): void {
		$this->as_admin();

		$settings = $this->read()->get_data()['settings'];

		$this->assertSame( Settings_Endpoint::STORED, $settings[ Plugin_Settings::WRITE_KEY ] );
		$this->assertSame( Settings_Endpoint::STORED, $settings[ Plugin_Settings::WRITE_SECRET ] );
		$this->assertCredentialsAbsent( $this->read() );
	}

	/** An unconnected site reads as empty, so the screen can still tell the two apart. */
	public function test_reading_reports_an_empty_credential_as_empty(): void {
		$this->settings()->set( Plugin_Settings::WRITE_KEY, '' );
		$this->settings()->set( Plugin_Settings::WRITE_SECRET, '' );
		$this->as_admin();

		$settings = $this->read()->get_data()['settings'];

		$this->assertSame( '', $settings[ Plugin_Settings::WRITE_KEY ] );
		$this->assertSame( '', $settings[ Plugin_Settings::WRITE_SECRET ] );
	}

	/**
	 * The route is gated by the view capability, not by the one that manages
	 * settings. That is the user this was actually leaking to.
	 */
	public function test_a_view_only_user_is_not_sent_the_credentials(): void {
		$user = self::factory()->user->create_and_get( [ 'role' => 'subscriber' ] );
		$user->add_cap( Plugin_Capabilities::VIEW );
		wp_set_current_user( $user->ID );

		$response = $this->read();

		$this->assertSame( 200, $response->get_status() );
		$this->assertCredentialsAbsent( $response );
	}

	/**
	 * The screen saves every setting at once, so a credential it did not touch
	 * comes back as the marker. Saving that must not replace the real key.
	 */
	public function test_saving_the_marker_back_keeps_the_stored_credential(): void {
		$this->as_admin();
		$before = $this->stored();

		$response = $this->save(
			[
				Plugin_Settings::WRITE_KEY    => Settings_Endpoint::STORED,
				Plugin_Settings::WRITE_SECRET => Settings_Endpoint::STORED,
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( $before, $this->stored() );
		$this->assertSame( 'test-write-key', Plugin_Settings::decrypt_secret( $this->stored()[0] ) );
	}

	/** "Leave blank to keep it": typing a character and deleting it again must not erase the key. */
	public function test_saving_an_empty_credential_keeps_the_stored_one(): void {
		$this->as_admin();
		$before = $this->stored();

		$this->save(
			[
				Plugin_Settings::WRITE_KEY    => '',
				Plugin_Settings::WRITE_SECRET => '   ',
			]
		);

		$this->assertSame( $before, $this->stored() );
	}

	/** A pasted key is still saved - encrypted - and the answer describes it the same way a read does. */
	public function test_saving_a_new_credential_stores_it_and_does_not_echo_it(): void {
		$this->as_admin();

		$response = $this->save(
			[
				Plugin_Settings::WRITE_KEY    => 'wk_rotated',
				Plugin_Settings::WRITE_SECRET => 'ws_rotated',
			]
		);

		[ $key, $secret ] = $this->stored();

		$this->assertSame( 'wk_rotated', Plugin_Settings::decrypt_secret( $key ) );
		$this->assertSame( 'ws_rotated', Plugin_Settings::decrypt_secret( $secret ) );
		$this->assertStringNotContainsString( 'wk_rotated', (string) wp_json_encode( $response->get_data() ) );
		$this->assertSame( Settings_Endpoint::STORED, $response->get_data()['settings'][ Plugin_Settings::WRITE_KEY ] );
	}

	/** Other settings on the same save still go through; only the credentials are guarded. */
	public function test_saving_other_settings_alongside_the_marker_still_saves_them(): void {
		$this->as_admin();

		$this->save(
			[
				Plugin_Settings::WRITE_KEY => Settings_Endpoint::STORED,
				Plugin_Settings::SEARCH_KEY => 'sk_public_key',
			]
		);

		$this->assertSame( 'sk_public_key', $this->settings()->get( Plugin_Settings::SEARCH_KEY ) );
		$this->assertSame( 'test-write-key', Plugin_Settings::decrypt_secret( $this->stored()[0] ) );
	}

	/**
	 * The settings of the default section name their tab, and the framework
	 * names it in English. The screen showed "General" in every language.
	 */
	public function test_the_tab_of_the_default_section_is_named_in_the_language_of_the_screen(): void {
		$this->as_admin();

		$polish = static fn ( string $translation, string $text ): string => 'General' === $text ? 'Ogólne' : $translation;
		add_filter( 'gettext_searcio', $polish, 10, 2 );

		try {
			$schema = $this->read()->get_data()['schema'];
		} finally {
			remove_filter( 'gettext_searcio', $polish, 10 );
		}

		$this->assertSame( 'general', $schema[ Plugin_Settings::SYNC_RETENTION_DAYS ]['section'] );
		$this->assertSame( 'Ogólne', $schema[ Plugin_Settings::SYNC_RETENTION_DAYS ]['section_label'] );
		$this->assertSame( 'Ogólne', $schema[ Plugin_Settings::SUPPORT_SEARCIO ]['section_label'] );
	}

	private function read(): WP_REST_Response {
		return $this->server->dispatch( new WP_REST_Request( 'GET', self::ROUTE ) );
	}

	/**
	 * @param  array<string,mixed>  $settings
	 */
	private function save( array $settings ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', self::ROUTE );
		$request->set_body_params( [ 'settings' => $settings ] );

		return $this->server->dispatch( $request );
	}

	/**
	 * @return array{0:string,1:string}
	 */
	private function stored(): array {
		return [
			(string) $this->settings()->get( Plugin_Settings::WRITE_KEY ),
			(string) $this->settings()->get( Plugin_Settings::WRITE_SECRET ),
		];
	}

	/** Neither the key nor anything carrying its encryption prefix appears anywhere in the body. */
	private function assertCredentialsAbsent( WP_REST_Response $response ): void {
		$body = (string) wp_json_encode( $response->get_data() );

		$this->assertStringNotContainsString( 'test-write-key', $body );
		$this->assertStringNotContainsString( 'test-write-secret', $body );
		$this->assertStringNotContainsString( 'whsc1:', $body );
	}

	private function as_admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}
}
