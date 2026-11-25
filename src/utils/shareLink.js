/**
 * A search as an address: what the search window shows, kept in the part of
 * the address behind the `#`, so that copying the address from the browser
 * shares the search.
 *
 *   https://shop.example/#searcio?q=steppjacke&type=product&f.farbe=rot&f.farbe=blau&r.price=20,100
 *
 * - `q` the words searched for, `type` the one type of result shown,
 * - `f.<field>` one picked value of a filter (repeated for more of them),
 * - `r.<field>` the bounds of a number filter as `min,max`, either side empty.
 *
 * The part behind the `#` never reaches a server: it is in no log, no cache key
 * and no `Referer` of a link the visitor follows from the page, which is why a
 * visitor's search words may live there. What it holds is the format of a link
 * somebody has already shared, so a key is only ever added to it, and a key this
 * file does not know is ignored.
 *
 * An address is an input anybody can write, so reading one is strict: only the
 * keys above, a fixed length and number of everything, a filter only of a field
 * the site has set up, a bound only a number. What does not pass is left out,
 * and a link of which nothing passes is no link.
 */

/** What an address of ours starts with. A plain `#searcio` (a link that opens the window) is not one. */
export const SHARE_PREFIX = '#searcio?';

/** How much of each a link may hold; one beyond it is not read. */
export const SHARE_LIMITS = {
	hash: 2000,
	query: 200,
	type: 40,
	field: 64,
	fields: 12,
	values: 30,
	value: 120,
	ranges: 6,
	bound: 24,
};

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/; // eslint-disable-line no-control-regex -- what the check is for.
const FIELD_NAME = /^[A-Za-z0-9_.-]+$/;
const TYPE_NAME = /^[A-Za-z0-9_-]+$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Whether an address is one of a shared search, whether it reads well or not.
 *
 * @param {string} hash `window.location.hash`.
 * @return {boolean} Whether it starts as one.
 */
export const isShareHash = ( hash ) => 'string' === typeof hash && hash.startsWith( SHARE_PREFIX );

/**
 * The fields of the site a link may name: the filters Search Config lists
 * (`facets` of the storefront config), by how each is drawn.
 *
 * @param {Object} [config] The storefront config.
 * @return {{facetFields: string[], rangeFields: string[]}} Both empty where nothing is set up: the filters the search answers with are then the site's, and a link may name any of a safe name.
 */
export const shareFields = ( config ) => {
	const facets = ( Array.isArray( config?.facets ) ? config.facets : [] ).filter( ( facet ) => 'string' === typeof facet?.field );

	return {
		facetFields: facets.filter( ( facet ) => 'range' !== facet.display ).map( ( facet ) => facet.field ),
		rangeFields: facets.filter( ( facet ) => 'range' === facet.display ).map( ( facet ) => facet.field ),
	};
};

/**
 * The address of a search, empty when there is nothing to share.
 *
 * @param {Object}                                       [state]
 * @param {string}                                       [state.query]  The words searched for.
 * @param {string[]}                                     [state.types]  The type shown: its first is written.
 * @param {Object<string,string[]>}                      [state.facets] The values picked, by field.
 * @param {Object<string,{min?: string, max?: string}>}  [state.ranges] The bounds set, by field.
 * @return {string} `#searcio?…`, or an empty string.
 */
export const buildShareHash = ( { query = '', types = [], facets = {}, ranges = {} } = {} ) => {
	const params = new URLSearchParams();
	const words = String( query ?? '' ).trim();
	const type = ( types || [] ).find( ( value ) => 'string' === typeof value && '' !== value );

	if ( '' !== words ) {
		params.set( 'q', words );
	}

	if ( type ) {
		params.set( 'type', type );
	}

	Object.entries( facets || {} ).forEach( ( [ field, values ] ) => {
		[ ...new Set( Array.isArray( values ) ? values.map( String ) : [] ) ].forEach( ( value ) => {
			if ( '' !== value ) {
				params.append( `f.${ field }`, value );
			}
		} );
	} );

	Object.entries( ranges || {} ).forEach( ( [ field, bound ] ) => {
		const min = String( bound?.min ?? '' ).trim();
		const max = String( bound?.max ?? '' ).trim();

		if ( '' !== min || '' !== max ) {
			params.set( `r.${ field }`, `${ min },${ max }` );
		}
	} );

	const text = params.toString();

	// A search too long for an address is shared as no search, not as another one.
	return '' === text || SHARE_PREFIX.length + text.length > SHARE_LIMITS.hash ? '' : SHARE_PREFIX + text;
};

/** A text of the link as the field holds it: trimmed, and null where it is not one to take. */
const clean = ( value, limit ) => {
	const text = String( value ?? '' ).trim();

	return '' === text || text.length > limit || CONTROL_CHARACTERS.test( text ) ? null : text;
};

/**
 * What an address of a shared search holds, as far as this site can use it.
 *
 * @param {string}   hash                  `window.location.hash`.
 * @param {Object}   [fields]              What the site has set up, from {@see shareFields}.
 * @param {string[]} [fields.facetFields]  The filters of values.
 * @param {string[]} [fields.rangeFields]  The filters of numbers. With both empty, nothing is set up and any field of a safe name is taken.
 * @return {?{query: string, types: string[], facets: Object<string,string[]>, ranges: Object<string,{min: string, max: string}>}} Null when it is not one, or nothing in it can be used.
 */
export const parseShareHash = ( hash, { facetFields = [], rangeFields = [] } = {} ) => {
	if ( ! isShareHash( hash ) || hash.length > SHARE_LIMITS.hash ) {
		return null;
	}

	const params = new URLSearchParams( hash.slice( SHARE_PREFIX.length ) );
	const query = clean( params.get( 'q' ), SHARE_LIMITS.query ) ?? '';
	const type = clean( params.get( 'type' ), SHARE_LIMITS.type );
	const facets = {};
	const ranges = {};
	const unset = 0 === facetFields.length && 0 === rangeFields.length;

	new Set( params.keys() ).forEach( ( key ) => {
		const field = key.slice( 2 );

		if ( 'f.' === key.slice( 0, 2 ) ) {
			const allowed = FIELD_NAME.test( field ) && field.length <= SHARE_LIMITS.field && ! rangeFields.includes( field ) && ( unset || facetFields.includes( field ) );
			const values = [ ...new Set( params.getAll( key ).map( ( value ) => clean( value, SHARE_LIMITS.value ) ).filter( Boolean ) ) ].slice( 0, SHARE_LIMITS.values );

			if ( allowed && values.length > 0 && Object.keys( facets ).length < SHARE_LIMITS.fields ) {
				facets[ field ] = values;
			}

			return;
		}

		if ( 'r.' === key.slice( 0, 2 ) && FIELD_NAME.test( field ) && ( unset || rangeFields.includes( field ) ) && Object.keys( ranges ).length < SHARE_LIMITS.ranges ) {
			const bounds = String( params.get( key ) ?? '' ).split( ',' );

			if ( 2 !== bounds.length ) {
				return;
			}

			const [ min, max ] = bounds.map( ( bound ) => bound.trim() );
			const fits = ( bound ) => '' === bound || ( bound.length <= SHARE_LIMITS.bound && NUMBER.test( bound ) );

			if ( fits( min ) && fits( max ) && ( '' !== min || '' !== max ) ) {
				ranges[ field ] = { min, max };
			}
		}
	} );

	const types = type && TYPE_NAME.test( type ) ? [ type ] : [];

	return '' === query && 0 === types.length && 0 === Object.keys( facets ).length && 0 === Object.keys( ranges ).length
		? null
		: { query, types, facets, ranges };
};

/*
 * The window writes the search it shows into the address as it changes, with
 * `replaceState`: no entry is added to the history, so the visitor's Back still
 * leaves the page, and a Back to the page from a product lands on the address
 * of the search, which opens the window as it was.
 */

/** The address the page had before the window wrote its own: its own anchor, or none. Null while the window has written nothing. */
let original = null;

/** What the window wrote last, to tell its own address from a link somebody pasted. */
let written = '';

const replace = ( hash ) => {
	const { pathname, search } = window.location;

	try {
		window.history.replaceState( window.history.state, '', `${ pathname }${ search }${ hash }` );
	} catch ( error ) {
		// A frame the browser does not let change its address: the window works without it.
	}
};

/**
 * Show a search in the address; an empty one takes it out again.
 *
 * @param {string} hash From {@see buildShareHash}.
 */
export const writeShareHash = ( hash ) => {
	if ( '' === hash ) {
		restoreShareHash();

		return;
	}

	if ( null === original ) {
		original = isShareHash( window.location.hash ) ? '' : window.location.hash;
	}

	if ( window.location.hash !== hash ) {
		replace( hash );
	}

	written = hash;
};

/**
 * Give the address back as the page had it, when the window closes or has no
 * search to show. An address that is no longer one of ours is left alone: the
 * visitor, or the page, has moved it since.
 */
export const restoreShareHash = () => {
	if ( isShareHash( window.location.hash ) ) {
		replace( original ?? '' );
	}

	original = null;
	written = '';
};

/**
 * Whether an address is the one the window wrote itself. A `hashchange` for
 * one is no news: a pasted link is.
 *
 * @param {string} hash
 * @return {boolean} Whether the window wrote it last.
 */
export const isWrittenShareHash = ( hash ) => '' !== written && hash === written;
