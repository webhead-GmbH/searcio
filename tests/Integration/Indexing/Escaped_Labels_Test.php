<?php
/**
 * WordPress keeps many of the names a person typed HTML-escaped: a post type's
 * label as the plugin that registered it gave it, a term, a site title, a
 * display name, a WooCommerce attribute or setting, a custom field saved by a
 * user without `unfiltered_html`. The plugin prints these as text, in React
 * and in the index, so it hands them on decoded: "Fisch&amp;Me(hr)" is shown
 * as "Fisch&Me(hr)", where the search window's type filter showed the entity.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use Webhead\WP\SearchCloud\Indexing\Field_Source_Resolver;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Escaped_Labels_Test extends Integration_Test_Case {
	public function tear_down(): void {
		unregister_taxonomy( 'sorte' );
		unregister_post_type( 'fisch' );

		parent::tear_down();
	}

	public function test_a_post_type_and_its_taxonomy_are_named_as_they_read(): void {
		register_post_type( 'fisch', [ 'public' => true, 'labels' => [ 'name' => 'Fisch&amp;Me(hr)' ] ] );
		register_taxonomy( 'sorte', 'fisch', [ 'public' => true, 'labels' => [ 'name' => 'Sorte &amp; Art' ] ] );
		$this->config()->save( [ 'fisch' => array_merge( $this->config()->defaults_for( 'fisch' ), [ 'enabled' => true ] ) ] );

		// The search window's type filter, the Placement tab and the block editor.
		$this->assertSame( 'Fisch&Me(hr)', $this->config()->indexable_post_type_labels()['fisch'] );
		$this->assertSame( 'Fisch&Me(hr)', $this->service( 'frontend_config' )->to_array()['typeLabels']['fisch'] );

		// The Indexing and Search Config tabs.
		$entry = current( array_filter( $this->config()->catalog()['post_types'], static fn ( array $type ): bool => 'fisch' === $type['slug'] ) );
		$this->assertSame( 'Fisch&Me(hr)', $entry['label'] );
		$this->assertContains( [ 'slug' => 'sorte', 'label' => 'Sorte & Art' ], $entry['taxonomies'] );
	}

	public function test_a_woocommerce_attribute_is_named_as_it_reads(): void {
		if ( ! function_exists( 'wc_create_attribute' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		// WooCommerce's wc_clean() writes a "<" with no ">" after it, and the "&" behind it, as entities.
		wc_create_attribute( [ 'name' => 'Länge <1 m &amp; mehr', 'slug' => 'laenge' ] );

		$attribute = current( array_filter( $this->service( 'woo' )->attributes(), static fn ( array $one ): bool => 'pa_laenge' === $one['slug'] ) );

		$this->assertSame( 'Länge <1 m & mehr', $attribute['label'] );
	}

	public function test_a_custom_field_is_indexed_as_it_was_typed(): void {
		$post = self::factory()->post->create_and_get();
		update_post_meta( $post->ID, 'material', 'Baumwolle &amp; Leinen' );
		update_post_meta( $post->ID, 'farben', [ 'Rot &amp; Weiß', 'Blau', 3 ] );
		update_post_meta( $post->ID, 'lagen', 2 );

		$resolver = new Field_Source_Resolver();

		$this->assertSame( 'Baumwolle & Leinen', $resolver->resolve( 'meta:material', $post ) );
		$this->assertSame( [ 'Rot & Weiß', 'Blau', 3 ], $resolver->resolve( 'meta:farben', $post ) );
		$this->assertSame( '2', $resolver->resolve( 'meta:lagen', $post ) );
	}

	public function test_prices_and_popular_searches_reach_the_search_window_as_text(): void {
		if ( ! function_exists( 'get_woocommerce_currency_symbol' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		// A space cannot be saved as a separator, so a shop types the entity.
		update_option( 'woocommerce_price_thousand_sep', '&nbsp;' );
		update_option( 'woocommerce_price_display_suffix', 'inkl. MwSt. &amp; <b>Versand</b>' );
		// Saved before the setting decoded what it keeps.
		update_option( 'searcio_popular_searches', [ 'Kabel &lt;2m', 'Fisch & Chips' ] );

		$config = $this->service( 'frontend_config' )->to_array();

		$this->assertSame( "\u{00A0}", $config['currency']['thousandSep'] );
		$this->assertSame( 'inkl. MwSt. & Versand', $config['currency']['suffix'] );
		$this->assertSame( [ 'Kabel <2m', 'Fisch & Chips' ], $config['popularSearches'] );
		$this->assertSame( [ 'A <b' ], Plugin_Settings::plain_text_list( [ 'A &lt;b', [ 'not text' ] ] ) );
	}

	private function config(): Index_Config {
		return $this->service( 'index_config' );
	}
}
