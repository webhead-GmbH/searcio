<?php
/**
 * Reads and writes the Placement tab's settings, and hands the storefront
 * the texts an admin typed there in the language of the page.
 *
 * The settings are one object option owned by
 * {@see \Webhead\WP\SearchCloud\Settings\Plugin_Settings::PLACEMENT}, read and
 * written through the framework's Settings_Manager and cleaned by
 * {@see Placement_Options} on the way in.
 *
 * The placeholder and the product row's heading are registered as strings of
 * Polylang or WPML, so a bilingual shop translates them where it translates
 * its other strings (Languages > Translations, or WPML > String Translation).
 * Polylang is asked first: it answers to WPML's filters as well, and a
 * WPML-first check would take a Polylang site for a WPML one.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\DTO\Placement_Options;
use Webhead\WP\SearchCloud\DTO\Products_Placement;
use Webhead\WP\SearchCloud\DTO\Search_Placement;
use Webhead\WP\SearchCloud\Indexing\Index_Config;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Compatibility\Compatibility_Manager;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Placement_Config {
	/** The group the strings are listed under in Polylang and WPML. */
	public const STRING_CONTEXT = 'Searcio';

	public const PLACEHOLDER_STRING = 'Search placeholder';

	public const HEADING_STRING = 'Products heading';

	public function __construct(
		private Settings_Manager $settings,
		private Compatibility_Manager $compatibility,
		private Index_Config $index_config
	) {}

	/**
	 * Read from the option each time, which WordPress keeps in its cache: a
	 * copy kept here would outlive a save in a long WP-CLI run.
	 */
	public function options(): Placement_Options {
		$stored = $this->settings->get( Plugin_Settings::PLACEMENT );

		return Placement_Options::from_array( is_array( $stored ) ? $stored : [] );
	}

	/**
	 * Cleans and stores what the Placement tab sent, and registers its texts
	 * with WPML, which keeps what it was given (Polylang is told on every
	 * admin request instead, see {@see self::register_strings()}).
	 *
	 * @param  array<string,mixed>  $data
	 */
	public function save( array $data ): Placement_Options {
		$options = Placement_Options::from_array( $data );

		$this->settings->set( Plugin_Settings::PLACEMENT, $options->to_array() );

		$this->register_strings();

		return $options;
	}

	/** The search's defaults, with the placeholder in the page's language. */
	public function search(): Search_Placement {
		$search = $this->options()->search;

		return '' === $search->placeholder
			? $search
			: $search->with_placeholder( $this->translate( self::PLACEHOLDER_STRING, $search->placeholder ) );
	}

	/** The product row's defaults, with the heading in the page's language. */
	public function products(): Products_Placement {
		$products = $this->options()->products;

		return '' === $products->heading
			? $products
			: $products->with_heading( $this->translate( self::HEADING_STRING, $products->heading ) );
	}

	/**
	 * Tells Polylang or WPML about the texts. Polylang keeps a string only for
	 * the request it was registered in, so it is told on every admin request;
	 * WPML stores it, so it is told when the texts are saved.
	 */
	public function register_strings(): void {
		$options = $this->options();
		$strings = [
			self::PLACEHOLDER_STRING => $options->search->placeholder,
			self::HEADING_STRING     => $options->products->heading,
		];

		foreach ( $strings as $name => $value ) {
			if ( '' === $value ) {
				continue;
			}

			if ( $this->compatibility->get_polylang()->is_active() ) {
				$this->compatibility->get_polylang()->register_string( $name, $value, self::STRING_CONTEXT );
			} elseif ( $this->compatibility->get_wpml()->is_active() ) {
				$this->compatibility->get_wpml()->register_string( self::STRING_CONTEXT, $name, $value );
			}
		}
	}

	public function uses_polylang(): bool {
		return $this->compatibility->get_polylang()->is_active();
	}

	/**
	 * What the Placement tab needs besides the settings: the theme and the
	 * selectors suggested for it, the content types a search can be held to,
	 * the site's address and how its texts are translated.
	 *
	 * @return array<string,mixed>
	 */
	public function catalog(): array {
		$theme    = wp_get_theme();
		$builders = [];

		if ( defined( 'ELEMENTOR_PRO_VERSION' ) ) {
			$builders[] = Theme_Presets::for_builder( 'elementor-pro' );
		}

		return [
			'placement'    => $this->options()->to_array(),
			'theme'        => [
				'name'       => (string) $theme->get( 'Name' ),
				'suggestion' => Theme_Presets::for_theme( get_template(), get_stylesheet() ),
				'builders'   => array_values( array_filter( $builders ) ),
			],
			'types'        => $this->index_config->indexable_post_type_labels(),
			'home'         => home_url( '/' ),
			'preview'      => Placement_Preview::url_base(),
			'multilingual' => $this->multilingual_provider(),
		];
	}

	private function translate( string $name, string $value ): string {
		if ( $this->compatibility->get_polylang()->is_active() ) {
			return $this->compatibility->get_polylang()->translate_string( $value );
		}

		if ( $this->compatibility->get_wpml()->is_active() ) {
			return $this->compatibility->get_wpml()->translate_string( $value, self::STRING_CONTEXT, $name );
		}

		return $value;
	}

	private function multilingual_provider(): ?string {
		if ( $this->compatibility->get_polylang()->is_active() ) {
			return 'polylang';
		}

		return $this->compatibility->get_wpml()->is_active() ? 'wpml' : null;
	}
}
