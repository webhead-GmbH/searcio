<?php
/**
 * Indexing configuration model.
 *
 * Single owner of the `searcio_index_config` option (stored through
 * the framework Settings_Manager, the single source of truth). One block per post
 * type describes which fields are pushed to Searcio. A global
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
	/** Where Elementor keeps its templates, floating elements, code snippets, fonts and icon sets. */
	private const BUILDER_POST_TYPES = [ 'elementor_library', 'e-floating-buttons', 'elementor_snippet', 'elementor_font', 'elementor_icons' ];

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
	 * Slug => plural label, for the places an admin picks a post type: the
	 * Placement tab's "Content to search".
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
	 * Post type => the type its documents carry, which the Indexing tab lets an
	 * admin name: "artikel" for posts. A block, a shortcode, a widget and a
	 * placement name a post type, and the index knows only this, so a search
	 * restricted to posts asked for `type=post` and found nothing once posts
	 * were "artikel".
	 *
	 * @return array<string,string>
	 */
	public function document_types(): array {
		$types = [];

		foreach ( $this->all() as $post_type => $block ) {
			if ( ! empty( $block['enabled'] ) ) {
				$type                         = trim( (string) ( $block['type'] ?? '' ) );
				$types[ (string) $post_type ] = '' !== $type ? $type : (string) $post_type;
			}
		}

		return $types;
	}

	/**
	 * Document type => the plural label of its post type, so the search
	 * window's type buttons name what the Searcio API's facets return: a
	 * renamed type showed as "artikel" beside "Seiten".
	 *
	 * @return array<string,string>
	 */
	public function document_type_labels(): array {
		$types  = $this->document_types();
		$labels = [];

		foreach ( $this->indexable_post_type_labels() as $post_type => $label ) {
			$labels[ $types[ $post_type ] ?? $post_type ] ??= $label;
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

	/**
	 * Field => the name the site gives what it holds, in the language of the
	 * current request, for the fields a storefront would otherwise have to name
	 * from their key: a WooCommerce attribute ("Farbe" for `attr_color`) and a
	 * field mapped from a taxonomy ("Marke" for a `brand` field read from
	 * `product_brand`). A field read from post meta or a post property has no
	 * name anywhere but its key, and is left out.
	 *
	 * A field the WooCommerce mapping writes keeps the name the storefront
	 * gives it, whatever a post type maps under the same name: one index holds
	 * every type's documents, so the demo shop's `categories` facet lists
	 * product categories and the journal's categories together, and a product's
	 * own field overwrites a mapped one in its document (see
	 * {@see Document_Builder::build()}).
	 *
	 * @return array<string,string>
	 */
	public function field_labels(): array {
		$blocks = array_filter( $this->all(), static fn ( array $block ): bool => ! empty( $block['enabled'] ) );
		$woo    = $blocks[ Woo::POST_TYPE ]['woo'] ?? null;
		$taken  = null === $woo ? [] : $this->woo->field_names( $woo );
		$labels = [];

		foreach ( $blocks as $block ) {
			foreach ( $block['fields'] as $field ) {
				$as = (string) $field['as'];

				if ( isset( $labels[ $as ] ) || in_array( $as, $taken, true ) ) {
					continue;
				}

				$label = $this->source_label( (string) $field['source'] );

				if ( '' !== $label ) {
					$labels[ $as ] = $label;
				}
			}
		}

		return null === $woo ? $labels : array_merge( $labels, $this->woo->attribute_labels( $woo ) );
	}

	private function is_protected_meta_source( string $source ): bool {
		$source = trim( $source );

		if ( ! str_starts_with( strtolower( $source ), 'meta:' ) ) {
			return false;
		}

		$key = trim( substr( $source, strlen( 'meta:' ) ) );

		return '' !== $key && Field_Source_Resolver::is_protected_meta_key( $key );
	}

	/**
	 * The hierarchical taxonomy a block maps to the `categories` field, or ''
	 * when it maps none. A post's categories share that field with the
	 * products' (see {@see self::field_labels()}), so a post written with them
	 * carries their paths for the category filter's tree, as a product does
	 * (see {@see Term_Paths}).
	 *
	 * @param  array<string,mixed>  $block  A normalized block.
	 */
	public function category_paths_taxonomy( array $block ): string {
		foreach ( is_array( $block['fields'] ?? null ) ? $block['fields'] : [] as $field ) {
			$source = trim( (string) ( $field['source'] ?? '' ) );

			if ( Facet_Config::CATEGORY_FIELD !== (string) ( $field['as'] ?? '' ) || ! str_starts_with( strtolower( $source ), 'taxonomy:' ) ) {
				continue;
			}

			$taxonomy = trim( substr( $source, strlen( 'taxonomy:' ) ) );

			if ( '' !== $taxonomy && taxonomy_exists( $taxonomy ) && is_taxonomy_hierarchical( $taxonomy ) ) {
				return $taxonomy;
			}
		}

		return '';
	}

	/**
	 * Field => category taxonomies, for the fields the category filter is: the
	 * plugin's own `categories` and any field an enabled mapping writes from
	 * the product or the post categories. A site that maps its post
	 * categories as "kategorien" set "Main categories only" and still saw
	 * every subcategory: only the field named `categories` got a tree.
	 *
	 * @return array<string,array<int,string>>
	 */
	public function category_fields(): array {
		$fields = [ Facet_Config::CATEGORY_FIELD => [ Woo::CATEGORY_TAXONOMY, 'category' ] ];

		foreach ( $this->all() as $block ) {
			if ( empty( $block['enabled'] ) ) {
				continue;
			}

			foreach ( $block['fields'] as $field ) {
				$source = trim( (string) $field['source'] );
				$as     = (string) $field['as'];

				if ( ! str_starts_with( strtolower( $source ), 'taxonomy:' ) || isset( $fields[ $as ] ) ) {
					continue;
				}

				$taxonomy = trim( substr( $source, strlen( 'taxonomy:' ) ) );

				if ( in_array( $taxonomy, [ Woo::CATEGORY_TAXONOMY, 'category' ], true ) ) {
					$fields[ $as ] = [ $taxonomy ];
				}
			}
		}

		return $fields;
	}

	/**
	 * Field => attribute taxonomy, for the WooCommerce attributes the product
	 * mapping writes (`attr_color` => `pa_color`). Empty when products are not
	 * indexed.
	 *
	 * @return array<string,string>
	 */
	public function attribute_taxonomies(): array {
		$block = $this->block_for( Woo::POST_TYPE );
		$woo   = is_array( $block['woo'] ?? null ) ? $block['woo'] : null;

		return null === $woo ? [] : $this->woo->attribute_taxonomies( $woo );
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
				'toggles'        => $this->woo->toggles(),
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
		$config  = $this->all();

		unset( $objects['attachment'] );

		// A page builder's parts are public, so WordPress lists them, but no
		// visitor reads one: Elementor's templates and floating elements were
		// offered as content to search. So is a type the site keeps out of its
		// own search. One that is indexed already stays.
		foreach ( $objects as $name => $object ) {
			$builder = in_array( $name, self::BUILDER_POST_TYPES, true );

			if ( ( $builder || ! empty( $object->exclude_from_search ) ) && empty( $config[ $name ]['enabled'] ) ) {
				unset( $objects[ $name ] );
			}
		}

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

	/**
	 * A post type's name as a person reads it. The code that registers a type
	 * may hand its label over HTML-escaped, so "Fisch&Me(hr)" arrived as
	 * "Fisch&amp;Me(hr)": wp-admin prints a label as HTML and shows the "&",
	 * while the search window, the block editor and the settings screens print
	 * it as text and showed the entity.
	 */
	private function post_type_label( \WP_Post_Type $object ): string {
		$label = trim( Term_Names::decode( (string) ( $object->labels->name ?? '' ) ) );

		return '' !== $label ? $label : $object->name;
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

			// Escaped as a post type's label may be ({@see self::post_type_label()}).
			$label = trim( Term_Names::decode( (string) ( $taxonomy->labels->name ?? '' ) ) );

			$out[] = [
				'slug'  => $taxonomy->name,
				'label' => '' !== $label ? $label : $taxonomy->name,
			];
		}

		return $out;
	}

	/**
	 * The name of what a `taxonomy:` source reads, for {@see self::field_labels()}:
	 * the attribute's name for a WooCommerce attribute, otherwise the
	 * taxonomy's singular name, which a heading over a list of its terms reads
	 * as ("Marke", where the plural is "Produktmarken"). Empty for any other
	 * source, and for a taxonomy with no name of its own.
	 */
	private function source_label( string $source ): string {
		[ $scheme, $taxonomy ] = array_pad( explode( ':', $source, 2 ), 2, '' );
		$object                = get_taxonomy( trim( $taxonomy ) );

		if ( 'taxonomy' !== strtolower( trim( $scheme ) ) || ! $object instanceof \WP_Taxonomy ) {
			return '';
		}

		$label = $this->woo->attribute_label( $object->name );

		if ( '' !== $label ) {
			return $label;
		}

		if ( $this->is_unnamed_taxonomy( $object ) ) {
			return '';
		}

		$label = (string) ( $object->labels->singular_name ?? '' );

		if ( '' === $label ) {
			$label = (string) ( $object->labels->name ?? '' );
		}

		return trim( Term_Names::decode( $label ) );
	}

	/**
	 * Whether a taxonomy was registered without a name of its own. WordPress
	 * then names it "Tags" or "Categories", after its own two, which says
	 * nothing about what it holds - the field's key says more. Those two are
	 * named by them.
	 */
	private function is_unnamed_taxonomy( \WP_Taxonomy $object ): bool {
		if ( in_array( $object->name, [ 'category', 'post_tag' ], true ) ) {
			return false;
		}

		$defaults = \WP_Taxonomy::get_default_labels();
		$kind     = $object->hierarchical ? 1 : 0;

		return ( $defaults['name'][ $kind ] ?? null ) === ( $object->labels->name ?? null )
			&& ( $defaults['singular_name'][ $kind ] ?? null ) === ( $object->labels->singular_name ?? null );
	}

	/**
	 * @return array<int,array{value:string,label:string}>
	 */
	private function source_catalog(): array {
		return [
			[
				'value' => 'property:title',
				'label' => __( 'Post title', 'searcio' ),
			],
			[
				'value' => 'property:content',
				'label' => __( 'Post content', 'searcio' ),
			],
			[
				'value' => 'property:excerpt',
				'label' => __( 'Excerpt', 'searcio' ),
			],
			[
				'value' => 'property:permalink',
				'label' => __( 'Permalink (URL)', 'searcio' ),
			],
			[
				'value' => 'property:thumbnail',
				'label' => __( 'Featured image', 'searcio' ),
			],
			[
				'value' => 'property:date',
				'label' => __( 'Published date', 'searcio' ),
			],
			[
				'value' => 'property:author',
				'label' => __( 'Author', 'searcio' ),
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
			// A protected key is never sent, so no document has the field: the
			// tester's "interne_notiz" was offered as a filter and flagged as
			// nothing.
			if ( ! $this->is_protected_meta_source( (string) $field['source'] ) ) {
				$fields[] = (string) $field['as'];
			}
		}

		if ( '' !== $this->category_paths_taxonomy( $block ) ) {
			$fields[] = Facet_Config::CATEGORY_PATHS_FIELD;
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
			$woo[ $toggle ] = in_array( $toggle, [ 'price', 'sku', 'stock_status', 'categories', 'brands' ], true );
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
