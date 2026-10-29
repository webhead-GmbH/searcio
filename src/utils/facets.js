/**
 * Pure helpers for the search modal's type and field facet chips. Kept side-
 * effect free so they're unit-testable without a DOM or a mocked `fetch`.
 */

import { __, sprintf } from '@wordpress/i18n';

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
 * §3.3) merged in on top - a forced value always wins over an active
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
	categories: __( 'Categories', 'searcio' ),
	product_tags: __( 'Tags', 'searcio' ),
	stock_status: __( 'Stock status', 'searcio' ),
	in_stock: __( 'In stock', 'searcio' ),
	on_sale: __( 'On sale', 'searcio' ),
	featured: __( 'Featured', 'searcio' ),
	sku: __( 'SKU', 'searcio' ),
	skus: __( 'SKUs', 'searcio' ),
	price: __( 'Price', 'searcio' ),
	price_min: __( 'Lowest price', 'searcio' ),
	price_max: __( 'Highest price', 'searcio' ),
	product_type: __( 'Product type', 'searcio' ),
} );

/**
 * "review_count" -> "Review count". Field facets carry no separate
 * human-readable label from the API, so the field name itself is the only
 * thing available for a chip group's heading - unless the site names the
 * field (`labels`), or it is one of the plugin's own fields, which have
 * translated names.
 *
 * @param {string}                field
 * @param {Object<string,string>} [labels] The site's own names for its fields,
 *                                         in the page's language: `fieldLabels`
 *                                         of the storefront config, e.g.
 *                                         `{ attr_color: 'Farbe' }`.
 * @return {string}
 */
export const humanizeFieldLabel = ( field, labels ) => {
	const key = String( field || '' );

	// Own properties only: a field called "constructor" is not named by
	// `Object.prototype`.
	const named = ( names ) => {
		const name = names && Object.prototype.hasOwnProperty.call( names, key ) ? names[ key ] : '';

		return 'string' === typeof name ? name.trim() : '';
	};

	const name = named( labels ) || named( KNOWN_FIELD_LABELS() );

	if ( '' !== name ) {
		return name;
	}

	// WooCommerce product attributes reach the index prefixed (`attr_color`,
	// `pa_size`). The prefix is an indexing detail, not something to show a
	// shopper - "Attr color" is not a label anyone would write.
	const text = key
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
 * impossible - picking one value would hide every other value you could
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

/**
 * Compact a large result count so a filter stays narrow: 1000+ becomes
 * "{n}K+" (e.g. 32494 → "32K+"), millions become "{n}M+". Smaller counts are
 * shown as they are.
 *
 * @param {number} value
 * @return {string}
 */
export const formatCount = ( value ) => {
	const n = Number( value ) || 0;

	if ( n >= 1000000 ) {
		return `${ Math.floor( n / 1000000 ) }M+`;
	}

	if ( n >= 1000 ) {
		return `${ Math.floor( n / 1000 ) }K+`;
	}

	return String( n );
};

/**
 * The share of the results that carry each field, from 0 to 1.
 *
 * Read from the loaded hits, which carry their fields; a field no loaded hit
 * carries still covers at least as many results as its most common value,
 * which the counts say for the whole match set.
 *
 * @param {Object<string,Array<{value: string, count: number}>>} groups Field facets.
 * @param {Array<{source?: Object}>} hits
 * @param {number} total
 * @return {Object<string,number>}
 */
export const facetCoverage = ( groups, hits, total ) => {
	const list = Array.isArray( hits ) ? hits : [];
	const out = {};

	Object.entries( groups || {} ).forEach( ( [ field, values ] ) => {
		const carried = list.filter( ( hit ) => {
			const value = hit?.source?.[ field ];

			return undefined !== value && null !== value && '' !== value && ! ( Array.isArray( value ) && 0 === value.length );
		} ).length;
		const fromHits = list.length > 0 ? carried / list.length : 0;
		const top = Math.max( 0, ...( Array.isArray( values ) ? values : [] ).map( ( entry ) => Number( entry?.count ) || 0 ) );
		const fromCounts = Number( total ) > 0 ? Math.min( 1, top / Number( total ) ) : 0;

		out[ field ] = Math.max( fromHits, fromCounts );
	} );

	return out;
};

/**
 * The order of the filter bar for one search.
 *
 * The order Search Config lists the facet fields in comes first; a field it
 * does not list follows, in the order given. A group that fewer than
 * `minCoverage` of the results carry moves behind the rest, keeping its place
 * among them. Without a configured order the groups are ordered by how many
 * results carry them. An active group is always in the list, whatever it
 * covers. The same input always gives the same order.
 *
 * @param {string[]} fields The groups the search has.
 * @param {Object}   options
 * @param {string[]} [options.configuredOrder]
 * @param {Object<string,number>} [options.coverage]
 * @param {string[]} [options.active]
 * @param {number}   [options.minCoverage]
 * @return {string[]}
 */
export const orderFacetGroups = ( fields, { configuredOrder = [], coverage = {}, active = [], minCoverage = 0.15 } = {} ) => {
	const present = [ ...new Set( [ ...( fields || [] ), ...( active || [] ) ] ) ];
	const covered = ( field ) => Number( coverage?.[ field ] ) || 0;
	const configured = ( configuredOrder || [] ).filter( ( field ) => present.includes( field ) );
	const rest = present.filter( ( field ) => ! configured.includes( field ) );
	const ordered = configured.length > 0
		? [ ...configured, ...rest ]
		// A stable sort: equal coverage keeps the order the groups came in.
		: present.map( ( field, index ) => [ field, index ] )
			.sort( ( a, b ) => covered( b[ 0 ] ) - covered( a[ 0 ] ) || a[ 1 ] - b[ 1 ] )
			.map( ( [ field ] ) => field );
	const strong = ordered.filter( ( field ) => covered( field ) >= minCoverage || ( active || [] ).includes( field ) );

	return [ ...strong, ...ordered.filter( ( field ) => ! strong.includes( field ) ) ];
};

/**
 * Which group buttons the bar shows.
 *
 * Every pinned (active) group first, whatever room it takes; then the others
 * in order until the room or the limit runs out. It stops at the first one
 * that does not fit, so the bar never skips a group to fit a later, shorter
 * one. The result keeps the bar's order. A limit of 0 is a bar with "All
 * filters" alone, pinned groups included.
 *
 * @param {Object} options
 * @param {Array<[string, number]>} options.widths    Each group with its button's width, in bar order.
 * @param {number}                  options.available The room for group buttons.
 * @param {string[]}                [options.pinned]
 * @param {number}                  [options.limit]   How many buttons at most, pinned ones included.
 * @param {number}                  [options.gap]     Space between two buttons.
 * @return {string[]}
 */
export const fitFilterButtons = ( { widths, available, pinned = [], limit = 5, gap = 8 } ) => {
	const list = Array.isArray( widths ) ? widths : [];
	const chosen = new Set();
	let room = Number( available ) || 0;

	if ( limit <= 0 ) {
		return [];
	}

	list.forEach( ( [ field, width ] ) => {
		if ( pinned.includes( field ) ) {
			chosen.add( field );
			room -= width + gap;
		}
	} );

	for ( const [ field, width ] of list ) {
		if ( chosen.has( field ) ) {
			continue;
		}

		if ( chosen.size >= limit || width + gap > room ) {
			break;
		}

		chosen.add( field );
		room -= width + gap;
	}

	return list.map( ( [ field ] ) => field ).filter( ( field ) => chosen.has( field ) );
};

/**
 * The first `n` values, and any selected value further down, in order.
 *
 * @param {Array<{value: string}>} values Already in the panel's order.
 * @param {string[]} selected
 * @param {number}   n
 * @return {Array<{value: string}>}
 */
export const topValues = ( values, selected, n ) => {
	const list = Array.isArray( values ) ? values : [];
	const chosen = selected || [];

	return [ ...list.slice( 0, n ), ...list.slice( n ).filter( ( entry ) => chosen.includes( entry.value ) ) ];
};

const SIZE_RANK = { XXXS: 0, '3XS': 0, XXS: 1, '2XS': 1, XS: 2, S: 3, M: 4, L: 5, XL: 6, XXL: 7, '2XL': 7, XXXL: 8, '3XL': 8, '4XL': 9, '5XL': 10 };
const UNITS = { KB: 1, MB: 1e3, GB: 1e6, TB: 1e9 };
const NUMBER = /^\d+(?:[.,]\d+)?$/;
const CAPACITY = /^(\d+(?:[.,]\d+)?)\s*(KB|MB|GB|TB)$/i;

/**
 * Where a value sorts in a natural order: clothing sizes, then numbers (shoe
 * sizes, widths), then capacities by size, then words.
 *
 * @param {string} value
 * @return {Array<number|string>}
 */
const naturalKey = ( value ) => {
	const text = String( value ?? '' ).trim();
	const upper = text.toUpperCase();

	if ( undefined !== SIZE_RANK[ upper ] ) {
		return [ 0, SIZE_RANK[ upper ] ];
	}

	if ( NUMBER.test( text ) ) {
		return [ 1, parseFloat( text.replace( ',', '.' ) ) ];
	}

	const capacity = text.match( CAPACITY );

	if ( capacity ) {
		return [ 2, parseFloat( capacity[ 1 ].replace( ',', '.' ) ) * UNITS[ capacity[ 2 ].toUpperCase() ] ];
	}

	return [ 3, text ];
};

/**
 * Natural order of two values: XXS..4XL, then numbers, then KB/MB/GB/TB by
 * size, then the words as the page's language sorts them.
 *
 * @param {string} a
 * @param {string} b
 * @param {string} [locale] The page's language; the browser's when omitted.
 * @return {number}
 */
export const compareFacetValues = ( a, b, locale ) => {
	const x = naturalKey( a );
	const y = naturalKey( b );

	if ( x[ 0 ] !== y[ 0 ] ) {
		return x[ 0 ] - y[ 0 ];
	}

	if ( 3 === x[ 0 ] ) {
		return String( x[ 1 ] ).localeCompare( String( y[ 1 ] ), locale || undefined, { numeric: true, sensitivity: 'base' } );
	}

	return x[ 1 ] - y[ 1 ];
};

/**
 * The order an opened panel keeps while it is open: by count, most first,
 * then by name; or in natural order for tiles. A selected value that no
 * longer has a count stays in the list.
 *
 * @param {string[]} values
 * @param {Object<string,number>} counts
 * @param {string[]} selected
 * @param {{natural?: boolean, locale?: string}} [options]
 * @return {string[]}
 */
export const freezeValueOrder = ( values, counts, selected, { natural = false, locale } = {} ) => {
	const all = [ ...new Set( [ ...( values || [] ), ...( selected || [] ) ] ) ];
	const count = ( value ) => Number( counts?.[ value ] ) || 0;

	return natural
		? all.sort( ( a, b ) => compareFacetValues( a, b, locale ) )
		: all.sort( ( a, b ) => count( b ) - count( a ) || String( a ).localeCompare( String( b ), locale || undefined, { sensitivity: 'base' } ) );
};

/**
 * How a group's values are drawn, when the site has not said: `color` when
 * every value has a colour, `tiles` when every value is a size, a number or a
 * capacity, `list` otherwise. A display the site set wins, except `color`
 * without colours, which is a list.
 *
 * @param {string} field
 * @param {string[]} values
 * @param {{display?: string, colors?: Object<string,string>}} [config]
 * @return {string} `list`, `tiles`, `color` or `range`.
 */
export const detectFacetDisplay = ( field, values, config = {} ) => {
	const colors = config?.colors || {};
	const list = ( values || [] ).filter( ( value ) => '' !== String( value ?? '' ).trim() );
	const everyColored = list.length > 0 && list.every( ( value ) => 'string' === typeof colors[ value ] && '' !== colors[ value ] );
	const set = String( config?.display || 'auto' );

	if ( 'color' === set ) {
		return everyColored ? 'color' : 'list';
	}

	if ( [ 'list', 'tiles', 'range' ].includes( set ) ) {
		return set;
	}

	if ( everyColored ) {
		return 'color';
	}

	if ( list.length > 0 && list.every( ( value ) => naturalKey( value )[ 0 ] < 3 ) ) {
		return 'tiles';
	}

	return 'list';
};

/**
 * A number typed the way the shop writes it: "1.299,50" in a shop whose
 * decimal separator is a comma, "1,299.50" in one whose is a point. The other
 * separator is a decimal point too when it is not followed by a group of
 * three digits ("12,5" in an English shop), since that is what was meant.
 *
 * @param {string} text
 * @param {string} [decimalSep]
 * @return {string} The number with a point as decimal separator, or '' when there is none.
 */
export const parseAmount = ( text, decimalSep = '.' ) => {
	const raw = String( text ?? '' ).replace( /[^\d.,]/g, '' );

	if ( ! /\d/.test( raw ) ) {
		return '';
	}

	const last = Math.max( raw.lastIndexOf( '.' ), raw.lastIndexOf( ',' ) );
	const after = last >= 0 ? raw.slice( last + 1 ) : '';
	const isDecimal = last >= 0 && ( raw[ last ] === decimalSep || ( '' !== after && 3 !== after.length ) );
	const whole = ( isDecimal ? raw.slice( 0, last ) : raw ).replace( /[.,]/g, '' );
	const value = Number( isDecimal && '' !== after ? `${ whole || '0' }.${ after }` : whole );

	return Number.isFinite( value ) ? String( value ) : '';
};

/**
 * Whether a bound has either side set.
 *
 * @param {{min?: string, max?: string}} [range]
 * @return {boolean}
 */
export const hasBound = ( range ) =>
	'' !== String( range?.min ?? '' ).trim() || '' !== String( range?.max ?? '' ).trim();

/**
 * The words of an applied bound: "from 50 €", "up to 200 €", "50 € - 200 €".
 *
 * @param {{min?: string, max?: string}} range
 * @param {(value: string) => string} [format] Writes one bound, e.g. as a price.
 * @return {string} Empty when neither side is set.
 */
export const rangeLabel = ( range, format = ( value ) => value ) => {
	const min = String( range?.min ?? '' ).trim();
	const max = String( range?.max ?? '' ).trim();

	if ( '' !== min && '' !== max ) {
		/* translators: 1: lower bound, e.g. "50 €". 2: upper bound, e.g. "200 €". */
		return sprintf( __( '%1$s - %2$s', 'searcio' ), format( min ), format( max ) );
	}

	if ( '' !== min ) {
		/* translators: %s: lower bound of a filter, e.g. "50 €". */
		return sprintf( __( 'from %s', 'searcio' ), format( min ) );
	}

	if ( '' !== max ) {
		/* translators: %s: upper bound of a filter, e.g. "200 €". */
		return sprintf( __( 'up to %s', 'searcio' ), format( max ) );
	}

	return '';
};

/**
 * What a group's button says. With nothing selected, its name. With values,
 * the name and the first value, and how many more there are: the button
 * reads "Colour: Olive +1", and is named "Colour: Olive, Black", which starts
 * with what it shows. With a bound, the name and the bound.
 *
 * @param {string} label
 * @param {string[]} [values]
 * @param {{min?: string, max?: string}} [range]
 * @param {(value: string) => string} [format]
 * @return {{text: string, name: string, value: string, more: number, hidden: string}}
 */
export const filterButtonLabel = ( label, values = [], range, format ) => {
	const bound = rangeLabel( range, format );
	const list = ( values || [] ).filter( ( value ) => '' !== String( value ) );
	const value = '' !== bound ? bound : ( list[ 0 ] ?? '' );

	if ( '' === value ) {
		return { text: label, name: label, value: '', more: 0, hidden: '' };
	}

	const rest = '' !== bound ? [] : list.slice( 1 );

	return {
		/* translators: 1: filter name, e.g. "Colour". 2: what is selected in it, e.g. "Olive". */
		text: sprintf( __( '%1$s: %2$s', 'searcio' ), label, value ),
		name: label,
		value,
		more: rest.length,
		hidden: rest.length > 0 ? `, ${ rest.join( ', ' ) }` : '',
	};
};

/**
 * What is selected in a group, for the heading of its accordion.
 *
 * @param {string[]} values
 * @param {{min?: string, max?: string}} [range]
 * @param {(value: string) => string} [format]
 * @return {string}
 */
export const summarizeSelection = ( values, range, format ) => {
	const bound = rangeLabel( range, format );

	return '' !== bound ? bound : ( values || [] ).join( ', ' );
};

/**
 * The number on "All filters": each selected value, and each bound.
 *
 * @param {Object<string,string[]>} activeFacets
 * @param {Object<string,{min?: string, max?: string}>} activeRanges
 * @return {number}
 */
export const activeFilterCount = ( activeFacets, activeRanges ) =>
	Object.values( activeFacets || {} ).reduce( ( sum, values ) => sum + ( Array.isArray( values ) ? values.length : 0 ), 0 )
	+ Object.values( activeRanges || {} ).filter( hasBound ).length;
