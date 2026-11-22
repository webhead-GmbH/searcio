<?php
/**
 * Tells Searcio the names the shop gives its fields.
 *
 * The dashboard lists a site's fields in the field menu of its profit
 * ranking rules and in the quiz builder's pickers, and can only make a name
 * from the key (`attr_farbe` is "Farbe", `categories` stays "Categories").
 * The shop knows what its admin calls them, so it says so: one label per
 * field, in the language the shop is set to.
 *
 * Sent on its own, never with another setting: a label Searcio refuses must
 * not take the save it came with along, and a Searcio from before the key
 * is left alone. Only when what it holds differs from what the shop says.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Sync;

use Webhead\WP\SearchCloud\Connection\Search_Cloud_Client;
use Webhead\WP\SearchCloud\Indexing\Index_Config;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.4.1
 */
final class Field_Label_Sync {
	/** What Searcio takes: up to this many fields, each label up to this many characters. */
	private const MAX_FIELDS = 100;

	private const MAX_LABEL = 100;

	public function __construct(
		private Search_Cloud_Client $client,
		private Index_Config $config
	) {}

	/**
	 * Field => name, for the fields the site's documents carry and a name
	 * exists for, in the language the shop is set to: the admin reading
	 * wp-admin in another one must not rename every field of a German shop.
	 *
	 * @return array<string,string>
	 */
	public function labels(): array {
		$switched = function_exists( 'switch_to_locale' ) && switch_to_locale( get_locale() );

		try {
			$named = $this->config->field_labels();
		} finally {
			if ( $switched ) {
				restore_previous_locale();
			}
		}

		$indexed = array_flip( $this->config->indexed_fields() );
		$labels  = [];

		foreach ( $named as $field => $label ) {
			$field = (string) $field;
			$label = trim( wp_strip_all_tags( (string) $label ) );

			// Searcio refuses a name that is not a document field, and with it
			// every label of the request.
			if ( '' === $label || ! isset( $indexed[ $field ] ) || 1 !== preg_match( '/^[A-Za-z0-9_.-]{1,255}$/', $field ) ) {
				continue;
			}

			$labels[ $field ] = mb_substr( $label, 0, self::MAX_LABEL );
		}

		ksort( $labels );

		return array_slice( $labels, 0, self::MAX_FIELDS, true );
	}

	/**
	 * Sends the labels when Searcio reports the key and holds others.
	 *
	 * @return bool Whether labels were sent and taken.
	 */
	public function push(): bool {
		if ( ! $this->client->is_configured() ) {
			return false;
		}

		$read = $this->client->get_search_config();
		$held = $read->ok() ? $read->body() : [];

		// A Searcio from before the key would drop it, and is not asked.
		if ( ! array_key_exists( 'field_labels', $held ) ) {
			return false;
		}

		$stored = is_array( $held['field_labels'] ) ? $held['field_labels'] : [];
		$labels = $this->labels();

		ksort( $stored );

		if ( $stored === $labels ) {
			return false;
		}

		return $this->client->update_search_config( [ 'field_labels' => $labels ] )->ok();
	}
}
