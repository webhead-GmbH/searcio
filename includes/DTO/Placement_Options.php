<?php
/**
 * Everything the Placement tab stores: the site-wide ways to open the search,
 * the floating button, and the defaults of every search and product row
 * placed by a shortcode, a classic widget or a site-wide way.
 *
 * Every site-wide way is off until an admin turns it on, so a site that
 * updates looks and loads as it did.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Frontend\Attribute_Value as Value;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Placement_Options {
	/** More than a theme ever needs; a longer list is a mistake, not a theme. */
	public const SELECTORS_MAX = 20;

	public const SELECTOR_LENGTH = 200;

	/**
	 * @param  bool      $takeover   Whether the site's own search forms are drawn as Searcio.
	 * @param  bool      $openers    Whether elements the selectors match open the search.
	 * @param  string[]  $selectors  CSS selectors of the theme's own search icon or field.
	 * @param  bool      $shortcut   Whether Ctrl/Cmd+K and "/" open the search.
	 */
	public function __construct(
		public readonly bool $takeover = false,
		public readonly bool $openers = false,
		public readonly array $selectors = [],
		public readonly bool $shortcut = false,
		public readonly Floating_Button $floating = new Floating_Button(),
		public readonly Search_Placement $search = new Search_Placement(),
		public readonly Products_Placement $products = new Products_Placement()
	) {}

	/**
	 * @param  array<string,mixed>  $data
	 */
	public static function from_array( array $data ): self {
		return new self(
			takeover: Value::flag( $data['takeover'] ?? null, false ),
			openers: Value::flag( $data['openers'] ?? null, false ),
			selectors: self::clean_selectors( $data['selectors'] ?? [] ),
			shortcut: Value::flag( $data['shortcut'] ?? null, false ),
			floating: Floating_Button::from_array( is_array( $data['floating'] ?? null ) ? $data['floating'] : [] ),
			search: Search_Placement::from_array( is_array( $data['search'] ?? null ) ? $data['search'] : [] ),
			products: Products_Placement::from_array( is_array( $data['products'] ?? null ) ? $data['products'] : [] )
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public function to_array(): array {
		return [
			'takeover'  => $this->takeover,
			'openers'   => $this->openers,
			'selectors' => $this->selectors,
			'shortcut'  => $this->shortcut,
			'floating'  => $this->floating->to_array(),
			'search'    => $this->search->to_array(),
			'products'  => $this->products->to_array(),
		];
	}

	/**
	 * Whether the search has to be on every page, whether or not the page
	 * holds a block, a widget or a shortcode. A form Searcio takes over loads
	 * the search where it is drawn, so it is not one of these.
	 */
	public function needs_every_page(): bool {
		return ( $this->openers && [] !== $this->selectors ) || $this->shortcut || $this->floating->enabled;
	}

	/**
	 * One selector per line or per list item, as the admin typed them. Markup,
	 * `<`, a rule's braces, a `;` and a backslash are taken out, which leaves
	 * nothing that could end the selector or the script it is printed in; `>`,
	 * quotes and brackets stay, for `#menu-item-search > a` and
	 * `a[href="?s="]`. One the browser cannot read is skipped there, so a
	 * typing mistake turns one selector off and not the others.
	 *
	 * @return string[]
	 */
	public static function clean_selectors( mixed $value ): array {
		if ( is_string( $value ) ) {
			$value = preg_split( '/\R/', $value ) ?: [];
		}

		if ( ! is_array( $value ) ) {
			return [];
		}

		$selectors = [];

		foreach ( $value as $selector ) {
			if ( ! is_string( $selector ) ) {
				continue;
			}

			$selector = trim( (string) preg_replace( '/[{};<\\\\]|\s+/', ' ', strip_tags( $selector ) ) );
			$selector = trim( (string) preg_replace( '/\s{2,}/', ' ', $selector ), " \t," );

			if ( '' === $selector || strlen( $selector ) > self::SELECTOR_LENGTH ) {
				continue;
			}

			$selectors[ $selector ] = $selector;
		}

		return array_slice( array_values( $selectors ), 0, self::SELECTORS_MAX );
	}
}
