<?php
/**
 * The CSS of the style settings a shop gave the search on the Placement tab.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Frontend;

use Webhead\WP\SearchCloud\DTO\Look;

defined( 'ABSPATH' ) || exit;

/**
 * Writes a {@see Look} as CSS for one instance class: the custom properties
 * on the class, the typography and the border on the widget's selectors, and
 * a tablet's and a phone's values in media queries at Elementor's breakpoints
 * ({@see Look_Schema::TABLET}, {@see Look_Schema::PHONE}). A device without a
 * value of its own takes the larger one's.
 *
 * Every value it writes was cleaned by {@see Look}: colours, numbers and
 * family names only. The editor's preview asks the server for this CSS, so
 * what it shows is what the shop will get.
 *
 * @since 1.3.2
 */
final class Look_Styles {
	/**
	 * @param  string  $instance_class  The class the trigger and its window carry.
	 */
	public static function css( Look $look, string $instance_class ): string {
		$instance_class = (string) preg_replace( '/[^a-zA-Z0-9_-]/', '', $instance_class );

		if ( '' === $instance_class || $look->is_empty() ) {
			return '';
		}

		$controls = Look_Schema::controls();
		$root     = '.' . $instance_class;
		// Device => selector => declarations.
		$out = [];

		foreach ( $look->values as $id => $value ) {
			$control = $controls[ $id ] ?? null;

			if ( null === $control ) {
				continue;
			}

			foreach ( self::declarations( $control, $value ) as $device => $by_selector ) {
				foreach ( $by_selector as $selector => $declarations ) {
					$selector = '' === $selector ? $root : self::selector( $selector, $root );

					foreach ( $declarations as $declaration ) {
						$out[ $device ][ $selector ][] = $declaration;
					}
				}
			}
		}

		$css = self::block( $out['desktop'] ?? [] );

		foreach ( [ 'tablet' => Look_Schema::TABLET, 'mobile' => Look_Schema::PHONE ] as $device => $width ) {
			if ( ! empty( $out[ $device ] ) ) {
				$css .= sprintf( '@media (max-width:%dpx){%s}', $width, self::block( $out[ $device ] ) );
			}
		}

		return $css;
	}

	/**
	 * The families the look asks for that are loaded from Google Fonts, with
	 * the weights its settings name: the ones Google offers and the site does
	 * not have itself.
	 *
	 * @param  array<int, string>  $site_families
	 * @return array<string, array<int, int>>
	 */
	public static function google_families( Look $look, array $site_families ): array {
		$families = [];

		foreach ( $look->values as $value ) {
			$family = is_string( $value ) ? $value : ( is_array( $value ) && is_string( $value['family'] ?? null ) ? $value['family'] : '' );

			if ( '' === $family || ! Google_Fonts::offers( $family ) || in_array( $family, $site_families, true ) ) {
				continue;
			}

			$families[ $family ] ??= [];

			if ( is_array( $value ) && isset( $value['weight'] ) ) {
				$families[ $family ][] = (int) $value['weight'];
			}
		}

		return $families;
	}

	/**
	 * What one control writes: device => selector ('' for the instance class)
	 * => declarations.
	 *
	 * @param  array<string, mixed>  $control
	 * @return array<string, array<string, array<int, string>>>
	 */
	private static function declarations( array $control, mixed $value ): array {
		$property = $control['property'] ?? '';

		switch ( $control['type'] ) {
			case 'color':
				$also = [];

				foreach ( $control['also'] ?? [] as $other => $other_value ) {
					$also[] = $other . ':' . $other_value;
				}

				return [ 'desktop' => [ '' => array_merge( [ $property . ':' . $value ], $also ) ] ];

			case 'size':
				$unit = $control['unit'];

				return self::per_device( is_array( $value ) ? $value : [ 'desktop' => $value ], static fn ( int $one ): array => [ '' => [ $property . ':' . $one . $unit ] ] );

			case 'spacing':
				return self::per_device( $value, static fn ( array $sides ): array => [ '' => [ $property . ':' . implode( 'px ', $sides ) . 'px' ] ] );

			case 'choice':
				return [ 'desktop' => [ '' => [ $property . ':' . $value ] ] ];

			case 'toggle':
				return [ 'desktop' => [ '' => [ $property . ':' . $control['value'] ] ] ];

			case 'font':
				return [ 'desktop' => [ '' => [ $property . ':"' . $value . '"' ] ] ];

			case 'border':
				$selectors = implode( ',', $control['selectors'] );
				$lines     = [];

				if ( isset( $value['style'] ) ) {
					$lines[] = 'border-style:' . $value['style'];
				}

				if ( isset( $value['width'] ) ) {
					$lines[] = 'border-width:' . $value['width'] . 'px';
				}

				if ( isset( $value['color'] ) ) {
					$lines[] = 'border-color:' . $value['color'];
				}

				return [ 'desktop' => [ $selectors => $lines ] ];

			case 'typography':
				return self::typography( implode( ',', $control['selectors'] ), $value );
		}

		return [];
	}

	/**
	 * @param  array<string, mixed>  $value
	 * @return array<string, array<string, array<int, string>>>
	 */
	private static function typography( string $selectors, array $value ): array {
		$out   = [];
		$fixed = [
			'family'     => 'font-family',
			'weight'     => 'font-weight',
			'style'      => 'font-style',
			'transform'  => 'text-transform',
			'decoration' => 'text-decoration',
		];

		foreach ( $fixed as $key => $css ) {
			if ( isset( $value[ $key ] ) ) {
				$out['desktop'][ $selectors ][] = $css . ':' . ( 'family' === $key ? '"' . $value[ $key ] . '"' : $value[ $key ] );
			}
		}

		$scaled = [
			'size'           => [ 'font-size', 'px' ],
			'line_height'    => [ 'line-height', '' ],
			'letter_spacing' => [ 'letter-spacing', 'px' ],
		];

		foreach ( $scaled as $key => [ $css, $unit ] ) {
			foreach ( is_array( $value[ $key ] ?? null ) ? $value[ $key ] : [] as $device => $one ) {
				$out[ $device ][ $selectors ][] = $css . ':' . self::number( $one ) . $unit;
			}
		}

		return $out;
	}

	/**
	 * @param  array<string, mixed>               $values  Device => value.
	 * @param  callable(mixed): array<string, array<int, string>>  $write
	 * @return array<string, array<string, array<int, string>>>
	 */
	private static function per_device( array $values, callable $write ): array {
		$out = [];

		foreach ( Look_Schema::DEVICES as $device ) {
			if ( isset( $values[ $device ] ) ) {
				$out[ $device ] = $write( $values[ $device ] );
			}
		}

		return $out;
	}

	private static function number( int|float $value ): string {
		return rtrim( rtrim( number_format( (float) $value, 2, '.', '' ), '0' ), '.' );
	}

	/**
	 * A schema selector under this instance class, given the weight the
	 * widget gives its own.
	 */
	private static function selector( string $selectors, string $root ): string {
		return implode(
			',',
			array_map(
				static fn ( string $selector ): string => str_replace( '{instance}', $root, trim( $selector ) ) . Look_Schema::BOOST,
				explode( ',', $selectors )
			)
		);
	}

	/**
	 * @param  array<string, array<int, string>>  $rules  Selector => declarations.
	 */
	private static function block( array $rules ): string {
		$css = '';

		foreach ( $rules as $selector => $declarations ) {
			$css .= $selector . '{' . implode( ';', $declarations ) . '}';
		}

		return $css;
	}
}
