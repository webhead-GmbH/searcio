<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Connection;

use PHPUnit\Framework\TestCase;
use Webhead\WP\SearchCloud\Connection\Connect_Request;

final class Connect_Request_Test extends TestCase {
	public function test_to_payload_contains_the_documented_shape(): void {
		$request = Connect_Request::create(
			platform: 'wordpress',
			site_name: 'Acme Shop',
			site_url: 'https://acme.example.com',
			verify_url: 'https://acme.example.com/wp-json/search-cloud/v1/verify',
			admin_email: 'owner@acme.example.com',
			admin_name: 'Ada Owner',
			idempotency_key: '3b7e2b6e-2f7a-4e2e-9d9d-6f6e2b1a9c3f',
			terms_privacy: true,
			dpa: false
		);

		$this->assertSame(
			[
				'platform'        => 'wordpress',
				'site_name'       => 'Acme Shop',
				'site_url'        => 'https://acme.example.com',
				'admin_email'     => 'owner@acme.example.com',
				'idempotency_key' => '3b7e2b6e-2f7a-4e2e-9d9d-6f6e2b1a9c3f',
				'consents'        => [ 'terms_privacy' => true, 'dpa' => false ],
				'admin_name'      => 'Ada Owner',
				'verify_url'      => 'https://acme.example.com/wp-json/search-cloud/v1/verify',
			],
			$request->to_payload()
		);
	}

	public function test_create_trims_every_string_field(): void {
		$request = Connect_Request::create(
			platform: '  wordpress  ',
			site_name: '  Acme Shop  ',
			site_url: '  https://acme.example.com  ',
			verify_url: '  https://acme.example.com/verify  ',
			admin_email: '  owner@acme.example.com  ',
			admin_name: '  Ada Owner  ',
			idempotency_key: '  3b7e2b6e  ',
			terms_privacy: true,
			dpa: true
		);

		$this->assertSame( 'wordpress', $request->platform );
		$this->assertSame( 'Acme Shop', $request->site_name );
		$this->assertSame( 'https://acme.example.com', $request->site_url );
		$this->assertSame( 'https://acme.example.com/verify', $request->verify_url );
		$this->assertSame( 'owner@acme.example.com', $request->admin_email );
		$this->assertSame( 'Ada Owner', $request->admin_name );
		$this->assertSame( '3b7e2b6e', $request->idempotency_key );
	}

	public function test_to_payload_omits_admin_name_when_empty(): void {
		$request = Connect_Request::create(
			platform: 'woocommerce',
			site_name: 'Acme Shop',
			site_url: 'https://acme.example.com',
			verify_url: 'https://acme.example.com/verify',
			admin_email: 'owner@acme.example.com',
			admin_name: '',
			idempotency_key: 'key',
			terms_privacy: true,
			dpa: true
		);

		$this->assertArrayNotHasKey( 'admin_name', $request->to_payload() );
	}

	public function test_to_payload_omits_verify_url_when_empty(): void {
		$request = Connect_Request::create(
			platform: 'woocommerce',
			site_name: 'Acme Shop',
			site_url: 'https://acme.example.com',
			verify_url: '',
			admin_email: 'owner@acme.example.com',
			admin_name: 'Ada',
			idempotency_key: 'key',
			terms_privacy: true,
			dpa: true
		);

		$this->assertArrayNotHasKey( 'verify_url', $request->to_payload() );
	}

	public function test_to_payload_includes_verify_url_when_present(): void {
		$request = Connect_Request::create(
			platform: 'wordpress',
			site_name: 'Acme Shop',
			site_url: 'https://acme.example.com',
			verify_url: 'https://acme.example.com/wp-json/search-cloud/v1/verify',
			admin_email: 'owner@acme.example.com',
			admin_name: '',
			idempotency_key: 'key',
			terms_privacy: true,
			dpa: false
		);

		$this->assertSame(
			'https://acme.example.com/wp-json/search-cloud/v1/verify',
			$request->to_payload()['verify_url']
		);
	}

	public function test_to_payload_reflects_both_consent_flags_independently(): void {
		$neither = Connect_Request::create( 'wordpress', 'A', 'https://a.test', '', 'a@a.test', '', 'k', false, false );
		$both    = Connect_Request::create( 'wordpress', 'A', 'https://a.test', '', 'a@a.test', '', 'k', true, true );

		$this->assertSame( [ 'terms_privacy' => false, 'dpa' => false ], $neither->to_payload()['consents'] );
		$this->assertSame( [ 'terms_privacy' => true, 'dpa' => true ], $both->to_payload()['consents'] );
	}
}
