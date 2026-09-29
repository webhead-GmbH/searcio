/**
 * Pure helpers for the search modal's type and field facet chips. Kept side-
 * effect free so they're unit-testable without a DOM or a mocked `fetch`.
 */

import { __ } from '@wordpress/i18n';

/** Toggle `value` in `list`: drop it if present, otherwise append it. */
export const toggleSelection = ( list, value ) =>
	list.includes( value ) ? list.filter( ( item ) => item !== value ) : [ ...list, value ];

/**
 * The `type` query param for `/search`: a scope-locked instance always wins
 * (§3.2 "scope-locked instances are unaffected"); otherwise the active
 * multi-select types are joined for the API's comma-separated OR.
 */
export const buildTypeParam = ( scopeType, activeTypes ) =>
	scopeType || ( ( activeTypes || [] ).length > 0 ? activeTypes.join( ',' ) : '' );

/** Every facet key in a `/search` response other than the built-in `types`, which type-filter chips already render separately. */
export const extractFieldFacets = ( facets ) => {
	const out = {};

	Object.entries( facets || {} ).forEach( ( [ field, values ] ) => {
		// An empty list is a configured facet with nothing to aggregate - a
		// numeric field, which has no `.keyword` to bucket on. Keeping it here
		// would render a group heading with no chips beneath it; those fields
		// are picked up as range controls instead.
		if ( 'types' !== field && Array.isArray( values ) && values.length > 0 ) {
			out[ field ] = values;
		}
	} );

	return out;
};

/**
 * `filter[field]=v1,v2` values from the active per-field selections, with any
 * forced extra filters (e.g. `{featured: 'true'}` for curated highlights,
 * §3.3) merged in on top — a forced value always wins over an active
 * selection for the same field.
 */
export const buildFilterParams = ( activeFacets, extra = {} ) => {
	const params = {};

	Object.entries( activeFacets || {} ).forEach( ( [ field, values ] ) => {
		if ( Array.isArray( values ) && values.length > 0 ) {
			params[ field ] = values.join( ',' );
		}
	} );

	return { ...params, ...extra };
};

/**
 * The fields this plugin's own indexer writes, named in the shop's language.
 * Humanized from the key they read as English on a German storefront - the
 * quiz's answer chips, the facet headings and the compare table all said
 * "Categories" and "Stock status". A merchant's own attribute or custom field
 * has no name here and is humanized from its key.
 */
const KNOWN_FIELD_LABELS = () => ( {
	categories: __( 'Categories', 'webhead-search-cloud' ),
	product_tags: __( 'Tags', 'webhead-search-cloud' ),
	stock_status: __( 'Stock status', 'webhead-search-cloud' ),
	in_stock: __( 'In stock', 'webhead-search-cloud' ),
	on_sale: __( 'On sale', 'webhead-search-cloud' ),
	featured: __( 'Featured', 'webhead-search-cloud' ),
	sku: __( 'SKU', 'webhead-search-cloud' ),
	skus: __( 'SKUs', 'webhead-search-cloud' ),
	price: __( 'Price', 'webhead-search-cloud' ),
	price_min: __( 'Lowest price', 'webhead-search-cloud' ),
	price_max: __( 'Highest price', 'webhead-search-cloud' ),
	product_type: __( 'Product type', 'webhead-search-cloud' ),
} );

/**
 * "review_count" -> "Review count". Field facets carry no separate
 * human-readable label from the API, so the field name itself is the only
 * thing available for a chip group's heading - unless it is one of the
 * plugin's own fields, which have translated names.
 */
export const humanizeFieldLabel = ( field ) => {
	const known = KNOWN_FIELD_LABELS()[ String( field || '' ) ];

	if ( known ) {
		return known;
	}

	// WooCommerce product attributes reach the index prefixed (`attr_color`,
	// `pa_size`). The prefix is an indexing detail, not something to show a
	// shopper — "Attr color" is not a label anyone would write.
	const text = String( field || '' )
		.replace( /^(attr|pa|meta|tax)[_-]+/i, '' )
		.replace( /[_-]+/g, ' ' )
		.trim();

	const label = text.charAt( 0 ).toUpperCase() + text.slice( 1 );

	// Acronyms a shopper reads as words, not as sentence-cased text ("Sku").
	// Whole words only, so "Idea" or "Urlaub" are never mangled into "IDea".
	return label.replace(
		/(^|\s)(sku|id|url|upc|ean|isbn|gtin)(?=\s|$)/gi,
		( match, before, word ) => before + word.toUpperCase()
	);
};

/**
 * Merge a fresh field-facets response into the currently shown groups.
 *
 * The API's facet aggregations reflect the filtered result set *including*
 * a field's own applied filter (confirmed live: selecting one type value
 * collapses `facets.types` down to just that value), so blindly overwriting
 * a chip group's option list on every response would make multi-select
 * impossible — picking one value would hide every other value you could
 * still add. A field with its own active filter keeps whatever option list
 * it last showed (frozen from the last response where that field was
 * unfiltered); every other field always takes the fresh list, since it's
 * only being narrowed by *other* filters, which is normal, desired faceting.
 */
export const mergeFieldFacets = ( current, incoming, activeFacets ) => {
	const merged = { ...incoming };

	Object.keys( current || {} ).forEach( ( field ) => {
		const hasOwnFilter = ( activeFacets?.[ field ] || [] ).length > 0;

		if ( hasOwnFilter ) {
			merged[ field ] = current[ field ];
		}
	} );

	return merged;
};

/**
 * Numeric facet fields, and the span the loaded hits cover.
 *
 * A numeric field (price, rating, review count) is indexed as a number, so it
 * has no `.keyword` sub-field and its terms aggregation always comes back
 * empty - the field shows up in `facets` as a key with no values. That is why
 * these fields could never be filtered on: there were no chips to click, and
 * chips would be the wrong control anyway (nobody filters on exactly 19.99).
 *
 * So the key says the field is filterable - the API only accepts `range[]` for
 * a configured facet field - and the hits say it is numeric. A field is only
 * treated as numeric when every hit carrying it carries a real number, so a
 * text field never turns into a range control because one product happens to
 * be called "2024".
 *
 * The span is what the loaded hits happen to cover, not the catalogue's true
 * min/max, which the API does not expose. It is offered as a hint, never as a
 * limit on what can be typed.
 *
 * @param {Object} facets
 * @param {Array<{source?: Object}>} hits
 * @return {Object<string,{min: number, max: number}>}
 */
export const extractRangeFields = ( facets, hits ) => {
	const out = {};

	Object.keys( facets || {} ).forEach( ( field ) => {
		if ( 'types' === field ) {
			return;
		}

		let min = Infinity;
		let max = -Infinity;
		let seen = 0;
		let rejected = false;

		( hits || [] ).forEach( ( hit ) => {
			const value = hit?.source?.[ field ];

			if ( undefined === value || null === value || '' === value ) {
				return;
			}

			if ( 'number' !== typeof value || ! Number.isFinite( value ) ) {
				rejected = true;

				return;
			}

			seen += 1;
			min = Math.min( min, value );
			max = Math.max( max, value );
		} );

		// One value, or the same value throughout, is a label rather than a
		// range - there is nothing for a bound to narrow.
		if ( rejected || seen < 2 || min === max ) {
			return;
		}

		out[ field ] = { min: Math.floor( min ), max: Math.ceil( max ) };
	} );

	return out;
};

/**
 * Merge fresh numeric spans into the ones on screen, freezing any field that
 * currently has a bound applied.
 *
 * Same reason as {@see mergeFieldFacets}: narrowing to "under 50" leaves only
 * hits under 50, so the observed span would collapse to the filter itself and
 * the hint would keep shrinking as you use it.
 *
 * @param {Object} current
 * @param {Object} incoming
 * @param {Object<string,{min?: string, max?: string}>} activeRanges
 */
export const mergeRangeFields = ( current, incoming, activeRanges ) => {
	const merged = { ...incoming };

	Object.keys( current || {} ).forEach( ( field ) => {
		const bound = activeRanges?.[ field ];
		const hasOwnBound = '' !== String( bound?.min ?? '' ).trim() || '' !== String( bound?.max ?? '' ).trim();

		if ( hasOwnBound ) {
			merged[ field ] = current[ field ];
		}
	} );

	return merged;
};

/**
 * `range[field]=min:max` values from the active bounds. Either side may be
 * omitted - `50:` is "at least 50", `:100` is "at most 100" - and a bound with
 * neither side set is left out rather than sent as a bare colon.
 *
 * @param {Object<string,{min?: number|string, max?: number|string}>} ranges
 * @return {Object<string,string>}
 */
export const buildRangeParams = ( ranges ) => {
	const params = {};

	Object.entries( ranges || {} ).forEach( ( [ field, bound ] ) => {
		const min = '' === String( bound?.min ?? '' ).trim() ? '' : String( bound.min ).trim();
		const max = '' === String( bound?.max ?? '' ).trim() ? '' : String( bound.max ).trim();

		if ( '' !== min || '' !== max ) {
			params[ field ] = `${ min }:${ max }`;
		}
	} );

	return params;
};

/**
 * Append a page of hits to the ones already on screen, keeping the first
 * occurrence of any id that appears twice.
 *
 * Nothing should return the same document on two pages, but a card rendered
 * twice under the same React key is a crash rather than a cosmetic problem,
 * and the index shifting between two requests is exactly the kind of thing
 * that happens while a sync is running.
 *
 * @param {Array<{id: string}>} current
 * @param {Array<{id: string}>} incoming
 * @return {Array<{id: string}>}
 */
export const appendHits = ( current, incoming ) => {
	const seen = new Set( ( current || [] ).map( ( hit ) => hit?.id ) );

	return [ ...( current || [] ), ...( incoming || [] ).filter( ( hit ) => ! seen.has( hit?.id ) ) ];
};

/**
 * Whether `total` from a `/search` response is a count of matches.
 *
 * Only on the lexical path. A semantic (hybrid) query retrieves `from + size`
 * candidates per side and fuses them, so its reported total is the size of
 * that window, not of the match set - measured against the service it climbs
 * 23 → 40 → 60 → 80 as you page, on a query that matches the same documents
 * throughout. Reporting it as "23 results" would be wrong, and treating
 * `total === loaded` as "that is everything" would hide four fifths of the
 * catalogue behind a button that had disappeared.
 *
 * The service takes the lexical path whenever the site has no semantic search,
 * and always for an empty query however the site is configured.
 *
 * @param {boolean} semanticEnabled  `capabilities.semantic_search`.
 * @param {string}  term             The query the results came from.
 * @return {boolean}
 */
export const totalIsExact = ( semanticEnabled, term ) => ! semanticEnabled || '' === String( term || '' ).trim();

/**
 * Whether to offer another page.
 *
 * With an exact total, when fewer results are loaded than were matched. Without
 * one, when the last page came back full: a short page is the end of the list,
 * and a full one means there is probably more. That can offer one page too
 * many - the button then loads nothing and goes away - which is the harmless
 * direction to be wrong in.
 *
 * @param {{total?: number, per_page?: number, pageCount?: number}} results
 * @param {number}  loaded           Hits currently on screen.
 * @param {boolean} exactTotal       See {@see totalIsExact}.
 * @return {boolean}
 */
export const hasMorePages = ( results, loaded, exactTotal ) => {
	if ( ! results || loaded < 1 ) {
		return false;
	}

	if ( exactTotal ) {
		return Number( results.total ) > loaded;
	}

	const perPage = Number( results.per_page ) || 20;
	const lastPage = undefined === results.pageCount ? loaded : Number( results.pageCount );

	return lastPage >= perPage;
};
