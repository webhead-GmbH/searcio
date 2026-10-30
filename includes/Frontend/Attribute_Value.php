<?php
/**
 * Reads one value of a placement's settings or of a shortcode's attributes.
 *
 * A setting arrives from the REST API typed, a shortcode attribute as the
 * string an editor wrote ("yes", "3", "Box"), so each reader takes both and
 * answers with the fallback for anything it cannot read.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Attribute_Value {
	/**
	 * @param  string[]  $allowed
	 */
	public static function choice( mixed $value, array $allowed, string $fallback ): string {
		$value = is_string( $value ) ? strtolower( trim( $value ) ) : '';

		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	public static function flag( mixed $value, bool $fallback ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( ! is_string( $value ) && ! is_int( $value ) ) {
			return $fallback;
		}

		return match ( strtolower( trim( (string) $value ) ) ) {
			'1', 'yes', 'true', 'on'  => true,
			'0', 'no', 'false', 'off' => false,
			default                   => $fallback,
		};
	}

	/** A whole number held between the bounds, or null for anything that is not one. */
	public static function number( mixed $value, int $min, int $max ): ?int {
		if ( is_string( $value ) ) {
			$value = trim( $value );
		}

		if ( is_int( $value ) ) {
			return max( $min, min( $max, $value ) );
		}

		if ( ! is_string( $value ) && ! is_float( $value ) ) {
			return null;
		}

		if ( 1 !== preg_match( '/^-?\d+(\.0+)?$/', (string) $value ) ) {
			return null;
		}

		return max( $min, min( $max, (int) $value ) );
	}

	/** One line of plain text, cut at `$length` characters. */
	public static function text( mixed $value, int $length = 120 ): string {
		if ( ! is_scalar( $value ) ) {
			return '';
		}

		$text = trim( (string) preg_replace( '/\s+/u', ' ', strip_tags( (string) $value ) ) );

		return mb_substr( $text, 0, $length );
	}

	/** A post type's or a field's name: lower-case letters, digits, `_` and `-`. */
	public static function slug( mixed $value, int $length = 40 ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}

		return substr( (string) preg_replace( '/[^a-z0-9_-]/', '', strtolower( trim( $value ) ) ), 0, $length );
	}

	/**
	 * The same values as `shortcode_atts()` is given them: every one a string,
	 * a switch as "yes" or "no", nothing as "".
	 *
	 * @param  array<string,mixed>  $values
	 * @return array<string,string>
	 */
	public static function to_strings( array $values ): array {
		return array_map(
			static fn ( mixed $value ): string => match ( true ) {
				is_bool( $value ) => $value ? 'yes' : 'no',
				null === $value   => '',
				default           => (string) $value,
			},
			$values
		);
	}
}
