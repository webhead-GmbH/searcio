<?php
/**
 * Lists every language configured in WPML/Polylang and resolves a specific
 * post's language - gaps the framework's `Language` facade doesn't cover (it
 * only exposes the current request's language and the site default).
 *
 * Deliberately does not use `Compatibility_Manager::get_multilingual_provider()`
 * to pick which plugin's API to call: Polylang registers WPML's own
 * compatibility filters (`wpml_current_language`, etc.), so a WPML-first check
 * reports `'wpml'` even on a Polylang-only site. `wpml_active_languages` still
 * resolves through Polylang's emulation layer, but `wpml_element_language_details`
 * does not - so this class resolves the provider itself, Polylang-first.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Compatibility;

use Webhead\WP\SearchCloud\Indexing\Term_Names;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Compatibility_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Multilingual_Support {
	public function __construct( private Compatibility_Manager $compatibility ) {}

	public function is_active(): bool {
		return $this->compatibility->has_multilingual_plugin();
	}

	/**
	 * Empty when neither plugin is active.
	 *
	 * @return array<int,array{code:string,name:string}>
	 */
	public function active_languages(): array {
		return match ( $this->provider() ) {
			'wpml'     => $this->wpml_active_languages(),
			'polylang' => $this->polylang_active_languages(),
			default    => [],
		};
	}

	/** Null when it can't be resolved (neither plugin active, or the post has no language assigned). */
	public function post_language( int $post_id ): ?string {
		return match ( $this->provider() ) {
			'wpml'     => $this->wpml_post_language( $post_id ),
			'polylang' => $this->polylang_post_language( $post_id ),
			default    => null,
		};
	}

	/**
	 * The post and each of its translations; the post alone without a
	 * multilingual plugin, or when it has none.
	 *
	 * @return array<int,int>
	 */
	public function post_translations( int $post_id ): array {
		$ids = match ( $this->provider() ) {
			'wpml'     => $this->wpml_post_translations( $post_id ),
			'polylang' => function_exists( 'pll_get_post_translations' ) ? (array) pll_get_post_translations( $post_id ) : [],
			default    => [],
		};

		return array_values( array_unique( array_filter( array_map( 'intval', [ $post_id, ...array_values( $ids ) ] ), static fn ( int $id ): bool => $id > 0 ) ) );
	}

	/**
	 * The front page of the language the request is in, as the multilingual
	 * plugin links it (`/en/`, or `?lang=en`), so a search handed to WordPress
	 * stays in that language; the site's own without a multilingual plugin.
	 */
	public function home_url(): string {
		$home = home_url( '/' );
		$url  = match ( $this->provider() ) {
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's own filter, asked as WPML documents it.
			'wpml'     => apply_filters( 'wpml_home_url', $home ),
			'polylang' => function_exists( 'pll_home_url' ) ? pll_home_url() : $home,
			default    => $home,
		};

		return is_string( $url ) && '' !== $url ? $url : $home;
	}

	/** Polylang first - see the class docblock for why this can't be `Compatibility_Manager::get_multilingual_provider()`. */
	private function provider(): ?string {
		if ( $this->compatibility->get_polylang()->is_active() ) {
			return 'polylang';
		}

		if ( $this->compatibility->get_wpml()->is_active() ) {
			return 'wpml';
		}

		return null;
	}

	/**
	 * @return array<int,array{code:string,name:string}>
	 */
	private function wpml_active_languages(): array {
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's own filter, asked as WPML documents it.
		$languages = apply_filters( 'wpml_active_languages', null, [ 'skip_missing' => 0 ] );

		if ( ! is_array( $languages ) ) {
			return [];
		}

		return array_values(
			array_map(
				static fn( array $language ): array => [
					'code' => (string) ( $language['language_code'] ?? '' ),
					'name' => Term_Names::decode( (string) ( $language['native_name'] ?? $language['translated_name'] ?? $language['language_code'] ?? '' ) ),
				],
				array_filter( $languages, 'is_array' )
			)
		);
	}

	/**
	 * @return array<int,int>
	 */
	private function wpml_post_translations( int $post_id ): array {
		$post_type = get_post_type( $post_id );
		$ids       = [];

		if ( false === $post_type ) {
			return [];
		}

		foreach ( $this->wpml_active_languages() as $language ) {
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's own filter, asked as WPML documents it.
			$id = apply_filters( 'wpml_object_id', $post_id, $post_type, false, $language['code'] );

			if ( is_numeric( $id ) ) {
				$ids[] = (int) $id;
			}
		}

		return $ids;
	}

	private function wpml_post_language( int $post_id ): ?string {
		$post_type = get_post_type( $post_id );

		$args = [
			'element_id'   => $post_id,
			'element_type' => false !== $post_type ? 'post_' . $post_type : 'post',
		];

		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's own filter, asked as WPML documents it.
		$details = apply_filters( 'wpml_element_language_details', null, $args );

		$code = is_object( $details ) ? ( $details->language_code ?? null ) : null;

		return is_string( $code ) && '' !== $code ? $code : null;
	}

	/**
	 * @return array<int,array{code:string,name:string}>
	 */
	private function polylang_active_languages(): array {
		if ( ! function_exists( 'pll_languages_list' ) ) {
			return [];
		}

		$languages = pll_languages_list( [ 'fields' => '' ] );

		if ( ! is_array( $languages ) ) {
			return [];
		}

		return array_values(
			array_map(
				static fn( $language ): array => [
					'code' => (string) ( $language->slug ?? '' ),
					// A Polylang language is a term, and its name is stored escaped.
					'name' => Term_Names::decode( (string) ( $language->name ?? $language->slug ?? '' ) ),
				],
				$languages
			)
		);
	}

	private function polylang_post_language( int $post_id ): ?string {
		if ( ! function_exists( 'pll_get_post_language' ) ) {
			return null;
		}

		$lang = pll_get_post_language( $post_id, 'slug' );

		return is_string( $lang ) && '' !== $lang ? $lang : null;
	}
}
