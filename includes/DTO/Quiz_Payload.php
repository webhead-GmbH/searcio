<?php
/**
 * A quiz as the Product finder tab sends it, cleaned for Searcio.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\DTO;

use Webhead\WP\SearchCloud\Enums\Quiz_Status;

defined( 'ABSPATH' ) || exit;

/**
 * The keys of a quiz the editor sent, each cleaned by what it is: `name`,
 * `lang`, `status` and the question graph (`docs/api/quiz.md`). A key the
 * editor did not send stays out, so an update changes only what it names.
 *
 * Searcio checks the graph itself (ids, links, cycles, limits) and says what
 * is wrong; this only makes sure that what reaches it is plain text, numbers,
 * a web address and the graph's own shape.
 *
 * @since 1.4.0
 */
final class Quiz_Payload {
	/** A language code such as `de`, `en` or `pt-BR`. */
	private const LANGUAGE = '/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/';

	/**
	 * @param  array<string,mixed>  $values  The cleaned keys.
	 */
	private function __construct( public readonly array $values ) {}

	/**
	 * @param  array<string,mixed>  $raw  The request body.
	 */
	public static function from_array( array $raw ): self {
		$values = [];

		if ( array_key_exists( 'name', $raw ) ) {
			$values['name'] = mb_substr( sanitize_text_field( (string) $raw['name'] ), 0, 255 );
		}

		if ( array_key_exists( 'lang', $raw ) ) {
			$lang           = is_string( $raw['lang'] ) ? trim( $raw['lang'] ) : '';
			$values['lang'] = 1 === preg_match( self::LANGUAGE, $lang ) ? $lang : null;
		}

		$status = is_string( $raw['status'] ?? null ) ? Quiz_Status::tryFrom( $raw['status'] ) : null;

		if ( null !== $status ) {
			$values['status'] = $status->value;
		}

		if ( array_key_exists( 'questions', $raw ) && is_array( $raw['questions'] ) ) {
			$values['questions'] = array_map( [ self::class, 'question' ], array_values( array_filter( $raw['questions'], 'is_array' ) ) );
		}

		return new self( $values );
	}

	/**
	 * @param  array<string,mixed>  $question
	 * @return array<string,mixed>
	 */
	private static function question( array $question ): array {
		$image   = is_string( $question['image'] ?? null ) ? esc_url_raw( trim( $question['image'] ), [ 'https' ] ) : '';
		$options = is_array( $question['options'] ?? null ) ? array_values( array_filter( $question['options'], 'is_array' ) ) : [];

		return array_filter(
			[
				'id'      => self::text( $question['id'] ?? '' ),
				'text'    => self::text( $question['text'] ?? '' ),
				'image'   => '' === $image ? null : $image,
				'options' => array_map( [ self::class, 'option' ], $options ),
			],
			static fn ( mixed $value ): bool => null !== $value
		);
	}

	/**
	 * @param  array<string,mixed>  $option
	 * @return array<string,mixed>
	 */
	private static function option( array $option ): array {
		$next     = $option['next_question_id'] ?? null;
		$keywords = self::text( $option['keywords'] ?? '' );
		$tags     = is_array( $option['tags_matched'] ?? null ) ? array_values( array_filter( $option['tags_matched'], 'is_array' ) ) : [];
		$ranges   = is_array( $option['ranges_matched'] ?? null ) ? array_values( array_filter( $option['ranges_matched'], 'is_array' ) ) : [];

		return array_filter(
			[
				'id'               => self::text( $option['id'] ?? '' ),
				'label'            => self::text( $option['label'] ?? '' ),
				'next_question_id' => is_scalar( $next ) && '' !== (string) $next ? self::text( $next ) : null,
				'tags_matched'     => array_map(
					static fn ( array $tag ): array => [
						'field' => self::text( $tag['field'] ?? '' ),
						'value' => self::text( $tag['value'] ?? '' ),
					],
					$tags
				),
				'keywords'         => '' === $keywords ? false : mb_substr( $keywords, 0, 255 ),
				'ranges_matched'   => [] === $ranges ? false : array_map(
					static fn ( array $range ): array => [
						'field' => self::text( $range['field'] ?? '' ),
						'min'   => self::bound( $range['min'] ?? null ),
						'max'   => self::bound( $range['max'] ?? null ),
					],
					$ranges
				),
			],
			// `next_question_id` is kept as null, which ends the quiz; an
			// option without words or ranges leaves those keys out.
			static fn ( mixed $value ): bool => false !== $value
		);
	}

	private static function text( mixed $value ): string {
		return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
	}

	private static function bound( mixed $value ): float|int|null {
		if ( ! is_numeric( $value ) ) {
			return null;
		}

		$number = 0 + $value;

		return is_finite( (float) $number ) ? $number : null;
	}
}
