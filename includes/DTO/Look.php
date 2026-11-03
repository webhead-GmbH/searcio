<?php
/**
 * The style settings a shop gave the search on the Placement tab.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Frontend\Look_Schema;
use Webhead\WP\SearchCloud\Frontend\Style_Tokens;

defined( 'ABSPATH' ) || exit;

/**
 * Control id => value, for the controls of {@see Look_Schema} that were set.
 * Read from stored settings or from the editor, every value is cleaned by the
 * type of its control, and a value that cleans to nothing is left out: what is
 * not here is the storefront's own.
 *
 * - colour: a colour {@see Style_Tokens::color()} lets through;
 * - size: a number within the control's range, or `{ desktop, tablet, mobile }`
 *   of them for a control per device;
 * - spacing: `{ device: [ top, right, bottom, left ] }`;
 * - choice: one of the control's options; toggle: `true`; font: a family name;
 * - border: `{ style, width, color }`;
 * - typography: `{ family, weight, style, transform, decoration, size, line_height, letter_spacing }`,
 *   the last three per device.
 *
 * @since 1.3.2
 */
final class Look {
	private const WEIGHTS = [ '100', '200', '300', '400', '500', '600', '700', '800', '900' ];

	private const FONT_STYLES = [ 'normal', 'italic', 'oblique' ];

	private const TRANSFORMS = [ 'none', 'uppercase', 'lowercase', 'capitalize' ];

	private const DECORATIONS = [ 'none', 'underline', 'overline', 'line-through' ];

	private const BORDER_STYLES = [ 'none', 'solid', 'dashed', 'dotted', 'double' ];

	/** @param  array<string, mixed>  $values  Control id => cleaned value. */
	private function __construct( public readonly array $values = [] ) {}

	public static function empty(): self {
		return new self();
	}

	/**
	 * @param  mixed  $data  Control id => value, as stored or as the editor sends it.
	 */
	public static function from_array( mixed $data ): self {
		if ( ! is_array( $data ) ) {
			return new self();
		}

		$controls = Look_Schema::controls();
		$values   = [];

		foreach ( $data as $id => $value ) {
			if ( ! is_string( $id ) || ! isset( $controls[ $id ] ) ) {
				continue;
			}

			$clean = self::clean( $controls[ $id ], $value );

			if ( null !== $clean ) {
				$values[ $id ] = $clean;
			}
		}

		return new self( $values );
	}

	/** @return array<string, mixed> */
	public function to_array(): array {
		return $this->values;
	}

	public function is_empty(): bool {
		return [] === $this->values;
	}

	/**
	 * This look with some values set, or taken away where the value is null.
	 *
	 * @param  array<string, mixed>  $values
	 */
	public function with( array $values ): self {
		return self::from_array( array_filter( array_merge( $this->values, $values ), static fn ( mixed $value ): bool => null !== $value ) );
	}

	/**
	 * @param  array<string, mixed>  $control
	 */
	private static function clean( array $control, mixed $value ): mixed {
		return match ( $control['type'] ) {
			'color'      => self::nonempty( Style_Tokens::color( $value ) ),
			'size'       => $control['responsive'] ? self::devices( $value, static fn ( mixed $one ): ?int => self::number( $one, $control['min'], $control['max'] ) ) : self::number( $value, $control['min'], $control['max'] ),
			'spacing'    => self::devices( $value, static fn ( mixed $one ): ?array => self::sides( $one, $control['max'] ) ),
			'choice'     => is_string( $value ) && '' !== $value && array_key_exists( $value, $control['options'] ) ? $value : null,
			'toggle'     => true === $value || 'yes' === $value || '1' === $value || 1 === $value ? true : null,
			'font'       => self::nonempty( self::family( $value ) ),
			'border'     => self::border( $value ),
			'typography' => self::typography( $value ),
			default      => null,
		};
	}

	private static function nonempty( string $value ): ?string {
		return '' === $value ? null : $value;
	}

	private static function number( mixed $value, int|float $min, int|float $max ): ?int {
		if ( ! is_numeric( $value ) ) {
			return null;
		}

		return (int) max( $min, min( $max, round( (float) $value ) ) );
	}

	private static function decimal( mixed $value, float $min, float $max ): ?float {
		if ( ! is_numeric( $value ) ) {
			return null;
		}

		return round( max( $min, min( $max, (float) $value ) ), 2 );
	}

	/**
	 * A value per device, the ones that clean to something.
	 *
	 * @param  callable(mixed): mixed  $clean
	 * @return array<string, mixed>|null
	 */
	private static function devices( mixed $value, callable $clean ): ?array {
		if ( ! is_array( $value ) || ( [] !== $value && array_is_list( $value ) ) ) {
			// A plain value, or the four sides of one, is the desktop's.
			$value = [ 'desktop' => $value ];
		}

		$out = [];

		foreach ( Look_Schema::DEVICES as $device ) {
			$one = array_key_exists( $device, $value ) ? $clean( $value[ $device ] ) : null;

			if ( null !== $one ) {
				$out[ $device ] = $one;
			}
		}

		return [] === $out ? null : $out;
	}

	/** @return array<int, int>|null Top, right, bottom, left. */
	private static function sides( mixed $value, int $max ): ?array {
		if ( ! is_array( $value ) || 4 !== count( $value ) ) {
			return null;
		}

		$sides = array_map( static fn ( mixed $side ): ?int => self::number( $side, 0, $max ), array_values( $value ) );

		return in_array( null, $sides, true ) ? null : $sides;
	}

	/**
	 * A font family's name: letters, digits, spaces and hyphens, as Google's
	 * and a theme's are written. Anything that could close the declaration is
	 * left out.
	 */
	public static function family( mixed $value ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}

		return trim( (string) preg_replace( '/\s+/', ' ', (string) preg_replace( '/[^\p{L}\p{N} \-]/u', '', $value ) ) );
	}

	/** @return array<string, mixed>|null */
	private static function border( mixed $value ): ?array {
		if ( ! is_array( $value ) ) {
			return null;
		}

		$out = array_filter(
			[
				'style' => in_array( $value['style'] ?? null, self::BORDER_STYLES, true ) ? $value['style'] : null,
				'width' => self::number( $value['width'] ?? null, 0, 20 ),
				'color' => self::nonempty( Style_Tokens::color( $value['color'] ?? '' ) ),
			],
			static fn ( mixed $one ): bool => null !== $one
		);

		return [] === $out ? null : $out;
	}

	/** @return array<string, mixed>|null */
	private static function typography( mixed $value ): ?array {
		if ( ! is_array( $value ) ) {
			return null;
		}

		$weight = isset( $value['weight'] ) ? (string) $value['weight'] : '';

		$out = array_filter(
			[
				'family'         => self::nonempty( self::family( $value['family'] ?? '' ) ),
				'weight'         => in_array( $weight, self::WEIGHTS, true ) ? $weight : null,
				'style'          => in_array( $value['style'] ?? null, self::FONT_STYLES, true ) ? $value['style'] : null,
				'transform'      => in_array( $value['transform'] ?? null, self::TRANSFORMS, true ) ? $value['transform'] : null,
				'decoration'     => in_array( $value['decoration'] ?? null, self::DECORATIONS, true ) ? $value['decoration'] : null,
				'size'           => self::devices( $value['size'] ?? null, static fn ( mixed $one ): ?int => self::number( $one, 6, 120 ) ),
				'line_height'    => self::devices( $value['line_height'] ?? null, static fn ( mixed $one ): ?float => self::decimal( $one, 0.5, 4 ) ),
				'letter_spacing' => self::devices( $value['letter_spacing'] ?? null, static fn ( mixed $one ): ?float => self::decimal( $one, -5, 20 ) ),
			],
			static fn ( mixed $one ): bool => null !== $one
		);

		return [] === $out ? null : $out;
	}
}
