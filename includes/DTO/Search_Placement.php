<?php
/**
 * How a search placed without a block or a widget looks and behaves: by the
 * `[searcio]` shortcode, the classic widget, a search form Searcio takes over
 * and the floating button.
 *
 * Stored on the Placement tab as the defaults of all of them. Its keys are the
 * shortcode's attribute names, so the settings and a shortcode written by hand
 * say the same thing in the same words; {@see self::to_block_attributes()}
 * turns them into the names {@see \Webhead\WP\SearchCloud\Frontend\Trigger_Markup}
 * and {@see \Webhead\WP\SearchCloud\Frontend\Style_Tokens} read.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Frontend\Attribute_Value as Value;
use Webhead\WP\SearchCloud\Frontend\Style_Tokens;
use Webhead\WP\SearchCloud\Frontend\Trigger_Markup;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.0
 */
final class Search_Placement {
	public const MODES = [ 'icon', 'box' ];

	public const TRIGGERS = [ 'submit', 'type' ];

	public const HIGHLIGHTS = [ 'newest', 'featured' ];

	public const ANIMATIONS = [ 'none', 'fade', 'slide-down', 'slide-up', 'zoom' ];

	public const CARDS = [ 'plugin', 'server' ];

	public const ALIGNMENTS = [ 'start', 'center', 'end' ];

	/** The widest a box may be asked to be; 0 lets it fill what holds it. */
	public const WIDTH_MAX = 1200;

	/** The roundest corner the window may be asked for. */
	public const RADIUS_MAX = 48;

	/** Shortcode attribute => block attribute, for the colours. */
	private const COLORS = [
		'accent'     => 'accentColor',
		'background' => 'bgColor',
		'text'       => 'textColor',
		'icon_color' => 'triggerIconColor',
	];

	/**
	 * @param  string  $mode         `icon` opens the window from a magnifier, `box` from a search field.
	 * @param  string  $placeholder  The field's hint; empty is the storefront's own.
	 * @param  bool    $voice        Whether the window offers voice input.
	 * @param  string  $trigger      `submit` searches on Enter, `type` as the visitor types.
	 * @param  bool    $count        Whether the filters show how many results each would leave.
	 * @param  string  $type         A content type the window searches alone; empty is all of them.
	 * @param  string  $highlights   What the window shows before a search: `newest` or `featured` products.
	 * @param  int     $filters      How many filter buttons the bar holds.
	 * @param  string  $animation    How the window opens.
	 * @param  string  $cards        `plugin` draws result cards in the browser, `server` takes the service's templates.
	 * @param  int     $width        The box's width in px; 0 fills what holds it.
	 * @param  string  $align        Where the trigger sits in what holds it.
	 * @param  array<string,string>  $colors  Shortcode attribute => colour, for the colours that are set.
	 * @param  ?int    $radius       The window's corner radius in px; null is the storefront's own.
	 */
	public function __construct(
		public readonly string $mode = 'icon',
		public readonly string $placeholder = '',
		public readonly bool $voice = false,
		public readonly string $trigger = 'submit',
		public readonly bool $count = true,
		public readonly string $type = '',
		public readonly string $highlights = 'newest',
		public readonly int $filters = Trigger_Markup::FACET_BAR_LIMIT,
		public readonly string $animation = 'fade',
		public readonly string $cards = 'plugin',
		public readonly int $width = 0,
		public readonly string $align = 'start',
		public readonly array $colors = [],
		public readonly ?int $radius = null
	) {}

	/**
	 * Reads stored settings or shortcode attributes. A key that is missing or
	 * that holds what it may not is taken from `$fallback`: the plugin's own
	 * defaults when the settings are read, the settings when a shortcode is.
	 *
	 * @param  array<string,mixed>  $data
	 */
	public static function from_array( array $data, ?self $fallback = null ): self {
		$fallback ??= new self();

		$colors = $fallback->colors;

		foreach ( array_keys( self::COLORS ) as $key ) {
			if ( ! array_key_exists( $key, $data ) ) {
				continue;
			}

			$color = Style_Tokens::color( $data[ $key ] );

			if ( '' === $color ) {
				unset( $colors[ $key ] );
			} else {
				$colors[ $key ] = $color;
			}
		}

		return new self(
			mode: Value::choice( $data['mode'] ?? null, self::MODES, $fallback->mode ),
			placeholder: array_key_exists( 'placeholder', $data ) ? Value::text( $data['placeholder'] ) : $fallback->placeholder,
			voice: Value::flag( $data['voice'] ?? null, $fallback->voice ),
			trigger: Value::choice( $data['trigger'] ?? null, self::TRIGGERS, $fallback->trigger ),
			count: Value::flag( $data['count'] ?? null, $fallback->count ),
			type: array_key_exists( 'type', $data ) ? Value::slug( $data['type'], 20 ) : $fallback->type,
			highlights: Value::choice( $data['highlights'] ?? null, self::HIGHLIGHTS, $fallback->highlights ),
			filters: Value::number( $data['filters'] ?? null, 0, Trigger_Markup::FACET_BAR_LIMIT_MAX ) ?? $fallback->filters,
			animation: Value::choice( $data['animation'] ?? null, self::ANIMATIONS, $fallback->animation ),
			cards: Value::choice( $data['cards'] ?? null, self::CARDS, $fallback->cards ),
			width: Value::number( $data['width'] ?? null, 0, self::WIDTH_MAX ) ?? $fallback->width,
			align: Value::choice( $data['align'] ?? null, self::ALIGNMENTS, $fallback->align ),
			colors: $colors,
			radius: array_key_exists( 'radius', $data )
				? Value::number( $data['radius'], 0, self::RADIUS_MAX )
				: $fallback->radius
		);
	}

	/**
	 * What is stored, and what the Placement tab and the shortcode generator
	 * read: every key, a colour that is not set as an empty string.
	 *
	 * @return array<string,mixed>
	 */
	public function to_array(): array {
		$out = [
			'mode'        => $this->mode,
			'placeholder' => $this->placeholder,
			'voice'       => $this->voice,
			'trigger'     => $this->trigger,
			'count'       => $this->count,
			'type'        => $this->type,
			'highlights'  => $this->highlights,
			'filters'     => $this->filters,
			'animation'   => $this->animation,
			'cards'       => $this->cards,
			'width'       => $this->width,
			'align'       => $this->align,
		];

		foreach ( array_keys( self::COLORS ) as $key ) {
			$out[ $key ] = $this->colors[ $key ] ?? '';
		}

		$out['radius'] = $this->radius;

		return $out;
	}

	/**
	 * The same, by the names of the search block's attributes.
	 *
	 * @return array<string,mixed>
	 */
	public function to_block_attributes(): array {
		$out = [
			'mode'             => $this->mode,
			'placeholder'      => $this->placeholder,
			'enableVoice'      => $this->voice,
			'searchTrigger'    => $this->trigger,
			'showCount'        => $this->count,
			'scopeType'        => $this->type,
			'highlightsSource' => $this->highlights,
			'facetBarLimit'    => $this->filters,
			'animation'        => $this->animation,
			'cardSource'       => $this->cards,
		];

		foreach ( self::COLORS as $key => $attribute ) {
			if ( isset( $this->colors[ $key ] ) ) {
				$out[ $attribute ] = $this->colors[ $key ];
			}
		}

		if ( null !== $this->radius ) {
			$out['radiusPanel'] = $this->radius;
		}

		return $out;
	}

	public function with_placeholder( string $placeholder ): self {
		return self::from_array( [ 'placeholder' => $placeholder ], $this );
	}

	/**
	 * The shortcode attributes, all of them, as strings: what
	 * `shortcode_atts()` is given as the defaults.
	 *
	 * @return array<string,string>
	 */
	public function to_shortcode_defaults(): array {
		return Value::to_strings( $this->to_array() );
	}
}
