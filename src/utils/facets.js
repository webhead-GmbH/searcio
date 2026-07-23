/**
 * Pure helpers for the search modal's type and field facet chips. Kept side-
 * effect free so they're unit-testable without a DOM or a mocked `fetch`.
 */

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
		if ( 'types' !== field && Array.isArray( values ) ) {
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
 * "review_count" -> "Review count". Field facets carry no separate
 * human-readable label from the API, so the field name itself is the only
 * thing available for a chip group's heading.
 */
export const humanizeFieldLabel = ( field ) => {
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
