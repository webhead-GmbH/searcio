<?php
/**
 * The swatches of each plugin and theme, as each keeps them in its own
 * source. The plugins themselves are not loaded: their data is written the
 * way they write it.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Tests\Integration\Indexing;

use Webhead\WP\SearchCloud\DTO\Attribute_Swatches;
use Webhead\WP\SearchCloud\Indexing\Swatch_Reader;
use Webhead\WP\SearchCloud\Tests\Integration\Integration_Test_Case;

final class Swatch_Reader_Test extends Integration_Test_Case {
	private const SLUG = 'whsc_finish';

	private const TAXONOMY = 'pa_' . self::SLUG;

	private int $attribute_id = 0;

	public function tear_down(): void {
		remove_all_filters( 'product_attributes_type_selector' );
		remove_all_filters( 'template' );
		delete_option( 'kt_woo_extras_tax_swatch_type' );

		if ( taxonomy_exists( self::TAXONOMY ) ) {
			unregister_taxonomy( self::TAXONOMY );
		}

		if ( $this->attribute_id > 0 && function_exists( 'wc_delete_attribute' ) ) {
			wc_delete_attribute( $this->attribute_id );
		}

		unset( $GLOBALS['wc_product_attributes'][ self::TAXONOMY ] );

		parent::tear_down();
	}

	public function test_flatsome_colours_of_one_or_two_and_its_images_and_labels(): void {
		$this->attribute( 'ux_color' );
		update_term_meta( $this->term( 'Zebra' ), 'ux_color', '#000000,#ffffff' );
		update_term_meta( $this->term( 'Oliv' ), 'ux_color', '#6f7a3a' );
		$this->term( 'Sand' );

		$swatches = $this->read();

		$this->assertSame( 'color', $swatches->display->value, 'The shop asked for colours, so a value without one does not undo them.' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a', 'Zebra' => '#000000' ], $this->sorted( $swatches->colors ) );
		$this->assertSame( [ 'Zebra' => '#ffffff' ], $swatches->second_colors );
	}

	public function test_flatsome_images_and_labels(): void {
		$this->attribute( 'ux_image' );
		$attachment = $this->attachment();
		update_term_meta( $this->term( 'Leinen' ), 'ux_image', (string) $attachment );

		$this->assertSame( [ 'Leinen' => wp_get_attachment_image_url( $attachment, 'thumbnail' ) ], $this->read()->images );

		$this->reset();
		$this->attribute( 'ux_label' );
		update_term_meta( $this->term( 'Extra Large' ), 'ux_label', 'XL' );

		$swatches = $this->read();

		$this->assertSame( 'tiles', $swatches->display->value );
		$this->assertSame( [ 'Extra Large' => 'XL' ], $swatches->labels );
	}

	/** WoodMart gives an attribute no type of its own, and keeps an image as an array. */
	public function test_woodmart_while_it_is_the_theme(): void {
		$this->attribute( 'select' );
		$attachment = $this->attachment();
		$olive      = $this->term( 'Oliv' );
		update_term_meta( $olive, 'color', '#6f7a3a' );

		$this->assertSame( [], $this->read()->colors, 'Term meta named `color` could be anybody\'s.' );

		add_filter( 'template', static fn (): string => 'woodmart' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $this->read()->colors );

		delete_term_meta( $olive, 'color' );
		update_term_meta( $olive, 'image', [ 'id' => $attachment, 'url' => 'https://shop.test/x.jpg' ] );

		$this->assertSame( [ 'Oliv' => wp_get_attachment_image_url( $attachment, 'thumbnail' ) ], $this->read()->images );
	}

	public function test_porto_by_the_type_it_gave(): void {
		$this->attribute( 'color' );
		update_term_meta( $this->term( 'Oliv' ), 'color_value', '#6f7a3a' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $this->read()->colors );

		$this->reset();
		$this->attribute( 'label' );
		update_term_meta( $this->term( 'Extra Large' ), 'label_value', 'XL' );

		$this->assertSame( [ 'Extra Large' => 'XL' ], $this->read()->labels );
	}

	/** Keys named after the taxonomy, and a type of the term's own. */
	public function test_variation_swatches_and_photos(): void {
		$this->attribute( 'select' );
		$attachment = $this->attachment();
		$olive      = $this->term( 'Oliv' );
		$linen      = $this->term( 'Leinen' );

		update_term_meta( $olive, self::TAXONOMY . '_swatches_id_type', 'color' );
		update_term_meta( $olive, self::TAXONOMY . '_swatches_id_color', '#6f7a3a' );
		update_term_meta( $linen, self::TAXONOMY . '_swatches_id_type', 'photo' );
		update_term_meta( $linen, self::TAXONOMY . '_swatches_id_photo', (string) $attachment );
		update_term_meta( $linen, self::TAXONOMY . '_swatches_id_color', '#ffffff' );

		$swatches = $this->read();

		$this->assertSame( 'color', $swatches->display->value, 'Each term says it is a swatch.' );
		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $swatches->colors, 'A term of the photo type is not a colour.' );
		$this->assertSame( [], $swatches->images, 'Colours win where an attribute has both and no type says.' );
	}

	public function test_kadence_shop_kit_in_term_meta_and_in_the_option_before_it(): void {
		$this->attribute( 'select' );
		$olive = $this->term( 'Oliv' );
		$sand  = $this->term( 'Sand' );

		update_term_meta( $olive, '_kt_woo_extras_swatch_type', 'color' );
		update_term_meta( $olive, '_kt_woo_extras_swatch_color', '#6f7a3a' );
		update_option( 'kt_woo_extras_tax_swatch_type', [ $sand => [ 'kt_woo_extras_swatch_type' => 'color', 'kt_woo_extras_swatch_color' => '#c2b280' ] ] );

		$this->assertSame( [ 'Oliv' => '#6f7a3a', 'Sand' => '#c2b280' ], $this->sorted( $this->read()->colors ) );
	}

	public function test_kadence_shop_kit_images(): void {
		$this->attribute( 'select' );
		$attachment = $this->attachment();
		$linen      = $this->term( 'Leinen' );

		update_term_meta( $linen, '_kt_woo_extras_swatch_type', 'image' );
		update_term_meta( $linen, '_kt_woo_extras_swatch_image', [ $attachment ] );

		$this->assertSame( [ 'Leinen' => wp_get_attachment_image_url( $attachment, 'thumbnail' ) ], $this->read()->images );
	}

	public function test_choosly_keeps_a_type_and_a_list_of_colours(): void {
		$this->attribute( 'select' );
		update_term_meta( $this->term( 'Zebra' ), 'vi_wpvs_terms_params', [ 'type' => 'color', 'color' => [ '#000000', '#ffffff' ], 'color_separator' => '1' ] );

		$swatches = $this->read();

		$this->assertSame( [ 'Zebra' => '#000000' ], $swatches->colors );
		$this->assertSame( [ 'Zebra' => '#ffffff' ], $swatches->second_colors );
	}

	public function test_wcboost_colours_images_and_labels(): void {
		$this->attribute( 'color' );
		update_term_meta( $this->term( 'Oliv' ), 'swatches_color', '#6f7a3a' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $this->read()->colors );

		$this->reset();
		$this->attribute( 'image' );
		$attachment = $this->attachment();
		update_term_meta( $this->term( 'Leinen' ), 'swatches_image', (string) $attachment );

		$this->assertSame( [ 'Leinen' => wp_get_attachment_image_url( $attachment, 'thumbnail' ) ], $this->read()->images );

		$this->reset();
		$this->attribute( 'label' );
		update_term_meta( $this->term( 'Extra Large' ), 'swatches_label', 'XL' );

		$this->assertSame( [ 'Extra Large' => 'XL' ], $this->read()->labels );
	}

	/** A label is text: what a swatches screen saved escaped is shown as it was typed. */
	public function test_a_label_saved_escaped_reads_as_it_was_typed(): void {
		$this->attribute( 'label' );
		update_term_meta( $this->term( 'Kurz' ), 'swatches_label', '&lt;1 m &amp; <b>mehr</b>' );

		$this->assertSame( [ 'Kurz' => '<1 m & mehr' ], $this->read()->labels );
	}

	/** ThemeHigh keeps one value whose meaning is the attribute's type. */
	public function test_themehigh_by_the_type_of_the_attribute(): void {
		$this->attribute( 'color' );
		update_term_meta( $this->term( 'Oliv' ), 'product_' . self::TAXONOMY, '#6f7a3a' );

		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $this->read()->colors );

		$this->reset();
		$this->attribute( 'label' );
		update_term_meta( $this->term( 'Extra Large' ), 'product_' . self::TAXONOMY, 'XL' );

		$this->assertSame( [ 'Extra Large' => 'XL' ], $this->read()->labels );
	}

	public function test_wpc_colours_images_and_buttons(): void {
		$this->attribute( 'button' );
		$attachment = $this->attachment();
		$olive      = $this->term( 'Oliv' );
		update_term_meta( $olive, 'wpcvs_button', 'OL' );
		update_term_meta( $olive, 'wpcvs_color', '#6f7a3a' );
		update_term_meta( $this->term( 'Leinen' ), 'wpcvs_image', (string) $attachment );

		$swatches = $this->read();

		$this->assertSame( 'tiles', $swatches->display->value );
		$this->assertSame( [ 'Oliv' => 'OL' ], $swatches->labels );
		$this->assertSame( [ 'Oliv' => '#6f7a3a' ], $swatches->colors );
	}

	public function test_a_second_colour_never_goes_with_another_plugins_colour(): void {
		$this->attribute( 'color' );
		$zebra = $this->term( 'Zebra' );
		update_term_meta( $zebra, 'product_attribute_color', '#111111' );
		update_term_meta( $zebra, 'ux_color', '#000000,#ffffff' );

		$swatches = $this->read();

		$this->assertSame( [ 'Zebra' => '#111111' ], $swatches->colors );
		$this->assertSame( [], $swatches->second_colors );
	}

	private function read(): Attribute_Swatches {
		/** @var Swatch_Reader $reader */
		$reader = $this->service( 'swatch_reader' );

		return $reader->read( self::TAXONOMY );
	}

	/**
	 * @param  array<string,string>  $map
	 * @return array<string,string>
	 */
	private function sorted( array $map ): array {
		ksort( $map );

		return $map;
	}

	private function attachment(): int {
		return (int) self::factory()->attachment->create_upload_object( DIR_TESTDATA . '/images/canola.jpg' );
	}

	private function term( string $name ): int {
		$term = wp_insert_term( $name, self::TAXONOMY );

		$this->assertIsArray( $term );

		// Only a term in use is one the storefront can show.
		$product = self::factory()->post->create( [ 'post_type' => 'product' ] );
		wp_set_object_terms( $product, [ (int) $term['term_id'] ], self::TAXONOMY, true );

		return (int) $term['term_id'];
	}

	private function reset(): void {
		$this->tear_down();
		$this->attribute_id = 0;
	}

	/**
	 * A global attribute in WooCommerce's own table, of a type a swatches
	 * plugin or a theme adds, registered as WooCommerce registers it on `init`.
	 */
	private function attribute( string $type ): void {
		if ( ! class_exists( \WooCommerce::class ) || ! function_exists( 'wc_create_attribute' ) ) {
			$this->markTestSkipped( 'WooCommerce is not loaded in this environment.' );
		}

		if ( 'select' !== $type ) {
			add_filter( 'product_attributes_type_selector', static fn ( array $types ): array => $types + [ $type => $type ] );
		}

		$id = wc_create_attribute(
			[
				'name' => 'Ausführung',
				'slug' => self::SLUG,
				'type' => $type,
			]
		);

		$this->assertIsInt( $id );
		$this->attribute_id = $id;

		register_taxonomy( self::TAXONOMY, 'product' );
		$GLOBALS['wc_product_attributes'][ self::TAXONOMY ] = wc_get_attribute( $id );
	}
}
