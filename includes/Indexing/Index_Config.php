<?php
/**
 * Indexing configuration model.
 *
 * Single owner of the `webhead_search_cloud_index_config` option (stored through
 * the framework Settings_Manager, the single source of truth). One block per post
 * type describes which fields are pushed to Search Cloud. A global
 * `config_version` integer is bumped on every save so the sync engine can detect
 * mapping changes and re-push affected documents.
 *
 * @author    Mir Mohammad Hosseini <mh@webhead.dev>
 * @copyright 2026 webhead GmbH
 */

declare( strict_types=1 );

namespace Webhead\WP\SearchCloud\Indexing;

use Webhead\WP\SearchCloud\Compatibility\Multilingual_Support;
use Webhead\WP\SearchCloud\Settings\Plugin_Settings;
use Webhead\WP\SearchCloud\Dependencies\Webhead\WP\Framework\Settings\Settings_Manager;

defined( 'ABSPATH' ) || exit;

/**
 * @since 1.0.0
 */
final class Index_Config {
	public function __construct(
		private Settings_Manager $settings,
		private Woo $woo,
		private Multilingual_Support $multilingual
	) {}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	public function all(): array {
		$stored = $this->settings->get( Plugin_Settings::INDEX_CONFIG );
		$stored = is_array( $stored ) ? $stored : [];
		$out    = [];

		foreach ( $stored as $post_type => $block ) {
			$post_type = (string) $post_type;

			if ( ! is_array( $block ) || ! post_type_exists( $post_type ) ) {
				continue;
			}

			$out[ $post_type ] = $this->normalize_block( $post_type, $block );
		}

		return $out;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public function block_for( string $post_type ): ?array {
		$all = $this->all();

		if ( ! isset( $all[ $post_type ] ) || empty( $all[ $post_type ]['enabled'] ) ) {
			return null;
		}

		return $all[ $post_type ];
	}

	/**
	 * @return array<int,string>
	 */
	public function indexable_post_types(): array {
		$types = [];

		foreach ( $this->all() as $post_type => $block ) {
			if ( ! empty( $block['enabled'] ) ) {
				$types[] = $post_type;
			}
		}

		return $types;
	}

	/**
	 * Slug => plural label, so front-ends (the search modal's type filters) can
	 * show a human-readable name instead of the raw slug the Search Cloud API's
	 * facets return.
	 *
	 * @return array<string,string>
	 */
	public function indexable_post_type_labels(): array {
		$enabled = $this->indexable_post_types();
		$labels  = [];

		foreach ( $this->candidate_post_types() as $object ) {
			if ( in_array( $object->name, $enabled, true ) ) {
				$labels[ $object->name ] = $this->post_type_label( $object );
			}
		}

		return $labels;
	}

	/**
	 * Every field a document of an enabled post type can carry under the saved
	 * mapping - what Search Config offers as searchable, facet and suggest
	 * fields. A field missing from this list is one no document from this site
	 * has, so a facet on it is always empty.
	 *
	 * @return array<int,string>
	 */
	public function indexed_fields(): array {
		$fields = [];

		foreach ( $this->all() as $post_type => $block ) {
			if ( ! empty( $block['enabled'] ) ) {
				array_push( $fields, ...$this->document_fields( $post_type, $block ) );
			}
		}

		return array_values( array_unique( $fields ) );
	}

	public function config_version(): int {
		return (int) $this->settings->get( Plugin_Settings::CONFIG_VERSION );
	}

	/**
	 * Bumps `config_version` only when the stored mapping actually changes.
	 *
	 * @param  array<string,mixed>  $config
	 */
	public function save( array $config ): int {
		$normalized = [];

		foreach ( $config as $post_type => $block ) {
			$post_type = (string) $post_type;

			if ( ! is_array( $block ) || ! post_type_exists( $post_type ) ) {
				continue;
			}

			$normalized[ $post_type ] = $this->normalize_block( $post_type, $block );
		}

		$previous = $this->settings->get( Plugin_Settings::INDEX_CONFIG );
		$previous = is_array( $previous ) ? $previous : [];

		$this->settings->set( Plugin_Settings::INDEX_CONFIG, $normalized );

		$version = $this->config_version();

		if ( wp_json_encode( $previous ) !== wp_json_encode( $normalized ) ) {
			$version = max( 1, $version ) + 1;
			$this->settings->set( Plugin_Settings::CONFIG_VERSION, $version );
		}

		return $version;
	}

	/**
	 * Default block for a post type (used by the UI when nothing is stored yet).
	 *
	 * @return array<string,mixed>
	 */
	public function defaults_for( string $post_type ): array {
		$block = [
			'enabled'         => false,
			'type'            => $post_type,
			'title_source'    => 'property:title',
			'content_source'  => 'property:content',
			'url_source'      => 'property:permalink',
			'image_source'    => 'property:thumbnail',
			'include_excerpt' => true,
			'include_private' => false,
			'fields'          => [],
		];

		if ( Woo::POST_TYPE === $post_type ) {
			$block['woo'] = $this->default_woo();
		}

		return $block;
	}

	/**
	 * Catalog of indexable post types plus the data the mapping UI needs:
	 * available taxonomies per type, current config, WooCommerce availability and
	 * store attributes.
	 *
	 * @return array<string,mixed>
	 */
	public function catalog(): array {
		$all        = $this->all();
		$post_types = [];

		foreach ( $this->candidate_post_types() as $object ) {
			$slug = $object->name;

			$post_types[] = [
				'slug'       => $slug,
				'label'      => $this->post_type_label( $object ),
				'is_product' => Woo::POST_TYPE === $slug,
				'taxonomies' => $this->taxonomies_for( $slug ),
				'config'     => $all[ $slug ] ?? $this->defaults_for( $slug ),
			];
		}

		return [
			'post_types'    => $post_types,
			'sources'       => $this->source_catalog(),
			'woo'           => [
				'active'         => $this->woo->is_active(),
				'meets_minimum'  => $this->woo->meets_minimum(),
				'version'        => $this->woo->version(),
				'minimum'        => Woo::MIN_VERSION,
				'attributes'     => $this->woo->attributes(),
				'toggles'        => array_keys( Woo::TOGGLE_FIELDS ),
			],
			// Which languages WPML/Polylang has configured locally, not the plan
			// entitlement (that comes from `/health` via Connection_Endpoint).
			'languages'     => [
				'active'    => $this->multilingual->is_active(),
				'available' => $this->multilingual->active_languages(),
			],
			'indexed_fields' => $this->indexed_fields(),
			'config_version' => $this->config_version(),
		];
	}

	/**
	 * @return array<int,\WP_Post_Type>
	 */
	private function candidate_post_types(): array {
		$objects = get_post_types( [ 'public' => true ], 'objects' );

		unset( $objects['attachment'] );

		// Products are public only when WooCommerce is active; surface the section
		// regardless so the UI can explain the soft dependency.
		if ( $this->woo->is_active() && ! isset( $objects[ Woo::POST_TYPE ] ) ) {
			$product = get_post_type_object( Woo::POST_TYPE );

			if ( null !== $product ) {
				$objects[ Woo::POST_TYPE ] = $product;
			}
		}

		return array_values( $objects );
	}

	private function post_type_label( \WP_Post_Type $object ): string {
		if ( isset( $object->labels->name ) && '' !== $object->labels->name ) {
			return (string) $object->labels->name;
		}

		return $object->name;
	}

	/**
	 * @return array<int,array{slug:string,label:string}>
	 */
	private function taxonomies_for( string $post_type ): array {
		$out = [];

		foreach ( get_object_taxonomies( $post_type, 'objects' ) as $taxonomy ) {
			if ( empty( $taxonomy->public ) && empty( $taxonomy->show_ui ) ) {
				continue;
			}

			$out[] = [
				'slug'  => $taxonomy->name,
				'label' => isset( $taxonomy->labels->name ) && '' !== $taxonomy->labels->name
					? (string) $taxonomy->labels->name
					: $taxonomy->name,
			];
		}

		return $out;
	}

	/**
	 * @return array<int,array{value:string,label:string}>
	 */
	private function source_catalog(): array {
		return [
			[
				'value' => 'property:title',
				'label' => __( 'Post title', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:content',
				'label' => __( 'Post content', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:excerpt',
				'label' => __( 'Excerpt', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:permalink',
				'label' => __( 'Permalink (URL)', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:thumbnail',
				'label' => __( 'Featured image', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:date',
				'label' => __( 'Published date', 'webhead-search-cloud' ),
			],
			[
				'value' => 'property:author',
				'label' => __( 'Author', 'webhead-search-cloud' ),
			],
		];
	}

	/**
	 * @param  array<string,mixed>  $block
	 * @return array<string,mixed>
	 */
	private function normalize_block( string $post_type, array $block ): array {
		$defaults = $this->defaults_for( $post_type );

		$normalized = [
			'enabled'         => ! empty( $block['enabled'] ),
			'type'            => $this->clean_type( $block['type'] ?? $defaults['type'], $defaults['type'] ),
			'title_source'    => $this->clean_source( $block['title_source'] ?? '', $defaults['title_source'] ),
			'content_source'  => $this->clean_source( $block['content_source'] ?? '', $defaults['content_source'], true ),
			'url_source'      => $this->clean_source( $block['url_source'] ?? '', $defaults['url_source'], true ),
			'image_source'    => $this->clean_source( $block['image_source'] ?? '', $defaults['image_source'], true ),
			'include_excerpt' => ! empty( $block['include_excerpt'] ),
			'include_private' => ! empty( $block['include_private'] ),
			'fields'          => $this->normalize_fields( $block['fields'] ?? [] ),
		];

		if ( Woo::POST_TYPE === $post_type ) {
			$normalized['woo'] = $this->normalize_woo( $block['woo'] ?? [] );
		}

		return $normalized;
	}

	private function clean_type( mixed $value, string $fallback ): string {
		$value = is_string( $value ) ? trim( $value ) : '';

		return '' === $value ? $fallback : sanitize_key( $value );
	}

	/**
	 * Sanitize a source string. `title` cannot be empty (it is required); other
	 * recognised fields may be cleared (empty string = "do not push").
	 */
	private function clean_source( mixed $value, string $fallback, bool $allow_empty = false ): string {
		$value = is_string( $value ) ? trim( $value ) : '';

		if ( '' === $value ) {
			return $allow_empty ? '' : $fallback;
		}

		if ( ! str_contains( $value, ':' ) ) {
			return $allow_empty ? '' : $fallback;
		}

		return $value;
	}

	/**
	 * @param  mixed  $fields
	 * @return array<int,array{as:string,source:string}>
	 */
	private function normalize_fields( mixed $fields ): array {
		if ( ! is_array( $fields ) ) {
			return [];
		}

		$out  = [];
		$seen = [];

		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}

			$as     = sanitize_key( (string) ( $field['as'] ?? '' ) );
			$source = is_string( $field['source'] ?? null ) ? trim( $field['source'] ) : '';

			if ( '' === $as || '' === $source || ! str_contains( $source, ':' ) ) {
				continue;
			}

			if ( isset( $seen[ $as ] ) || $this->is_reserved_field( $as ) ) {
				continue;
			}

			$seen[ $as ] = true;
			$out[]       = [
				'as'     => $as,
				'source' => $source,
			];
		}

		return $out;
	}

	private function is_reserved_field( string $as ): bool {
		return in_array( $as, [ 'id', 'type', 'title', 'content', 'url', 'image', 'indexed_at' ], true );
	}

	/**
	 * The fields {@see Document_Builder::build()} can write for one post type's
	 * block, the ones a merchant most often picks first. `id` is left out: it
	 * is the document's key, not a field anyone searches or filters by.
	 *
	 * @param  array<string,mixed>  $block  A normalized block.
	 * @return array<int,string>
	 */
	private function document_fields( string $post_type, array $block ): array {
		$fields = [ 'title' ];

		if ( '' !== $block['content_source'] ) {
			$fields[] = 'content';
		}

		if ( ! empty( $block['include_excerpt'] ) ) {
			$fields[] = 'excerpt';
		}

		$fields[] = 'type';

		if ( '' !== $block['url_source'] ) {
			$fields[] = 'url';
		}

		if ( '' !== $block['image_source'] ) {
			$fields[] = 'image';
		}

		if ( $this->multilingual->is_active() ) {
			$fields[] = 'lang';
		}

		foreach ( $block['fields'] as $field ) {
			$fields[] = (string) $field['as'];
		}

		if ( Woo::POST_TYPE === $post_type ) {
			array_push( $fields, ...$this->woo->field_names( $block['woo'] ?? [] ) );
		}

		return $fields;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function default_woo(): array {
		$woo = [ 'only_visible' => true ];

		foreach ( array_keys( Woo::TOGGLE_FIELDS ) as $toggle ) {
			$woo[ $toggle ] = in_array( $toggle, [ 'price', 'sku', 'stock_status', 'categories' ], true );
		}

		$woo['attributes'] = [];

		return $woo;
	}

	/**
	 * @param  mixed  $woo
	 * @return array<string,mixed>
	 */
	private function normalize_woo( mixed $woo ): array {
		$woo        = is_array( $woo ) ? $woo : [];
		$normalized = [ 'only_visible' => ! isset( $woo['only_visible'] ) || ! empty( $woo['only_visible'] ) ];

		foreach ( array_keys( Woo::TOGGLE_FIELDS ) as $toggle ) {
			$normalized[ $toggle ] = ! empty( $woo[ $toggle ] );
		}

		$attributes = isset( $woo['attributes'] ) && is_array( $woo['attributes'] ) ? $woo['attributes'] : [];
		$normalized['attributes'] = array_values(
			array_unique(
				array_filter(
					array_map(
						static fn( $value ): string => is_string( $value ) ? trim( $value ) : '',
						$attributes
					),
					static fn( string $value ): bool => '' !== $value
				)
			)
		);

		return $normalized;
	}
}
