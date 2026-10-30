/**
 * The Placement tab's logic that does not draw: the settings as the tab keeps
 * them, the shortcodes it writes, the selectors it checks and the address of
 * its preview.
 */
import { addQueryArgs } from '@wordpress/url';

/** The search's defaults as the plugin has them before an admin sets any (`Search_Placement`). */
export const SEARCH_DEFAULTS = {
	mode: 'icon',
	placeholder: '',
	voice: false,
	trigger: 'submit',
	count: true,
	type: '',
	highlights: 'newest',
	filters: 5,
	animation: 'fade',
	cards: 'plugin',
	width: 0,
	align: 'start',
	accent: '',
	background: '',
	text: '',
	icon_color: '',
	radius: null,
};

/** The product row's defaults (`Products_Placement`). */
export const PRODUCTS_DEFAULTS = {
	source: 'similar',
	layout: 'carousel',
	limit: null,
	banner: true,
	heading: '',
	cards: 'plugin',
};

export const FLOATING_DEFAULTS = {
	enabled: false,
	position: 'end',
	devices: 'phones',
	style: 'icon',
	offset: 24,
};

/**
 * The settings as the endpoint sent them, with every key there: a key the
 * endpoint left out is the plugin's default.
 *
 * @param {Object} [data]
 * @return {Object} The settings.
 */
export const normalizePlacement = ( data = {} ) => ( {
	takeover: Boolean( data.takeover ),
	openers: Boolean( data.openers ),
	selectors: Array.isArray( data.selectors ) ? data.selectors.filter( ( s ) => 'string' === typeof s ) : [],
	shortcut: Boolean( data.shortcut ),
	floating: { ...FLOATING_DEFAULTS, ...( data.floating || {} ) },
	search: { ...SEARCH_DEFAULTS, ...( data.search || {} ) },
	products: { ...PRODUCTS_DEFAULTS, ...( data.products || {} ) },
} );

/** One selector per line, as the field holds them. */
export const selectorsToText = ( selectors ) => ( Array.isArray( selectors ) ? selectors.join( '\n' ) : '' );

export const textToSelectors = ( text ) =>
	text
		.split( '\n' )
		.map( ( line ) => line.trim() )
		.filter( ( line ) => '' !== line );

/**
 * The selectors the browser cannot read, which the storefront skips.
 *
 * @param {string[]} selectors
 * @param {Document} [doc]
 * @return {string[]} The ones it cannot read.
 */
export const invalidSelectors = ( selectors, doc = document ) =>
	selectors.filter( ( selector ) => {
		try {
			doc.createDocumentFragment().querySelector( selector );

			return false;
		} catch {
			return true;
		}
	} );

/**
 * The suggested selectors the list does not hold yet, added at its end.
 *
 * @param {string[]} selectors
 * @param {string[]} suggestion
 * @return {string[]} The list with them.
 */
export const withSuggestion = ( selectors, suggestion ) => [
	...selectors,
	...suggestion.filter( ( selector ) => ! selectors.includes( selector ) ),
];

/**
 * An attribute's value as a shortcode can hold it. WordPress reads a value
 * up to the next quote of the kind it opened with and ends the shortcode at
 * `]`, so brackets go, and a value with a double quote in it is written in
 * single quotes; one with both loses its double quotes.
 *
 * @param {string} value
 * @return {string} `"value"` or `'value'`.
 */
const quote = ( value ) => {
	const clean = String( value ).replace( /[\[\]]/g, '' );

	if ( ! clean.includes( '"' ) ) {
		return `"${ clean }"`;
	}

	return clean.includes( "'" ) ? `"${ clean.replace( /"/g, '' ) }"` : `'${ clean }'`;
};

const asAttribute = ( value ) => {
	if ( true === value ) {
		return 'yes';
	}

	if ( false === value ) {
		return 'no';
	}

	return null === value || undefined === value ? '' : String( value );
};

/**
 * The shortcode that draws `values`, with only the attributes that differ
 * from `defaults`: what the site's defaults already say is left out, so a
 * change to the defaults later reaches it too.
 *
 * @param {string}   tag
 * @param {Object}   values   The attributes wanted, by shortcode attribute name.
 * @param {Object}   defaults The Placement tab's defaults.
 * @param {string[]} [order]  The order to write them in; the keys of `values` otherwise.
 * @return {string} E.g. `[searcio mode="box" width="320"]`.
 */
export const buildShortcode = ( tag, values, defaults = {}, order = Object.keys( values ) ) => {
	const parts = order
		.filter( ( key ) => key in values )
		.filter( ( key ) => asAttribute( values[ key ] ) !== asAttribute( defaults[ key ] ) )
		.map( ( key ) => `${ key }=${ quote( asAttribute( values[ key ] ) ) }` );

	return `[${ [ tag, ...parts ].join( ' ' ) }]`;
};

/**
 * The address of the preview page, drawn from settings that are not saved.
 *
 * @param {{url: string, nonce: string}} preview   From the endpoint.
 * @param {string}                       view      `trigger`, `modal` or `floating`.
 * @param {Object}                       placement The settings to draw.
 * @return {string} The address, or '' when the endpoint gave none.
 */
export const previewUrl = ( preview, view, placement ) => {
	if ( ! preview?.url ) {
		return '';
	}

	return addQueryArgs( preview.url, {
		_wpnonce: preview.nonce,
		view,
		placement: JSON.stringify( placement ),
	} );
};
