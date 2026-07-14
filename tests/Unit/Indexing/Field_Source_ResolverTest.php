<?php
/**
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Unit\Indexing;

use PHPUnit\Framework\TestCase;
use WP_Post;
use Webhead\WP\SearchCloud\Indexing\Field_Source_Resolver;
use Webhead\WP\SearchCloud\Tests\Unit\Resets_Wp_Test_State;

final class Field_Source_ResolverTest extends TestCase {
	use Resets_Wp_Test_State;

	private Field_Source_Resolver $resolver;

	protected function setUp(): void {
		parent::setUp();

		$this->resolver = new Field_Source_Resolver();
	}

	public function test_resolves_a_public_meta_value(): void {
		$post = new WP_Post( [ 'ID' => 7 ] );
		update_post_meta( 7, 'subtitle', 'A public subtitle' );

		$this->assertSame( 'A public subtitle', $this->resolver->resolve( 'meta:subtitle', $post ) );
	}

	public function test_skips_a_protected_underscore_prefixed_meta_key(): void {
		$post = new WP_Post( [ 'ID' => 7 ] );
		update_post_meta( 7, '_internal_secret', 'do-not-expose' );

		$this->assertNull( $this->resolver->resolve( 'meta:_internal_secret', $post ) );
	}

	public function test_protected_meta_can_be_allowed_through_the_filter(): void {
		$post = new WP_Post( [ 'ID' => 7 ] );
		update_post_meta( 7, '_opt_in_field', 'now-visible' );

		add_filter( 'webhead_search_cloud/index/allow_protected_meta', static fn (): bool => true );

		$this->assertSame( 'now-visible', $this->resolver->resolve( 'meta:_opt_in_field', $post ) );
	}

	public function test_returns_null_for_a_missing_public_meta_key(): void {
		$post = new WP_Post( [ 'ID' => 7 ] );

		$this->assertNull( $this->resolver->resolve( 'meta:nonexistent', $post ) );
	}

	public function test_returns_null_for_an_unknown_scheme(): void {
		$post = new WP_Post( [ 'ID' => 7 ] );

		$this->assertNull( $this->resolver->resolve( 'bogus:whatever', $post ) );
	}
}
