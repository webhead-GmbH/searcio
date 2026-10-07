import { formatNumber } from './number';

const setPageLanguage = ( lang ) => {
	document.documentElement.lang = lang;
};

// The language of whatever runs this, which is the one a bare
// `toLocaleString()` follows.
const inTheBrowsersLanguage = ( number ) =>
	new Intl.NumberFormat( undefined, { numberingSystem: 'latn' } ).format( number );

describe( 'formatNumber', () => {
	afterEach( () => {
		document.documentElement.removeAttribute( 'lang' );
	} );

	it( 'groups a number as the language of the page does, whatever the browser is set to', () => {
		// Two languages that disagree on the separator, so at most one of them
		// is the language of the machine running this.
		setPageLanguage( 'en-US' );
		expect( formatNumber( 270000 ) ).toBe( '270,000' );

		setPageLanguage( 'de-DE' );
		expect( formatNumber( 270000 ) ).toBe( '270.000' );
	} );

	it( 'keeps the digits WordPress writes, in a language that has digits of its own', () => {
		setPageLanguage( 'fa-IR' );
		expect( formatNumber( 270000 ) ).toBe( '270,000' );

		setPageLanguage( 'ar-EG' );
		expect( formatNumber( 270000 ) ).toBe( '270,000' );
	} );

	it( 'takes a number that arrived as a string', () => {
		setPageLanguage( 'en-US' );

		expect( formatNumber( '2700' ) ).toBe( '2,700' );
	} );

	it( 'follows the browser when the page names no language', () => {
		expect( formatNumber( 270000 ) ).toBe( inTheBrowsersLanguage( 270000 ) );
	} );

	it( 'reads a locale code that is not a language tag by the part that is one', () => {
		// What WordPress writes for `pt_PT_ao90` when its language pack names no
		// tag. `Intl` throws a RangeError on it.
		setPageLanguage( 'pt-PT-ao90' );

		expect( formatNumber( 2700000 ) ).toBe( new Intl.NumberFormat( 'pt-PT' ).format( 2700000 ) );
		expect( formatNumber( 2700000 ) ).not.toBe( '2,700,000' );
	} );

	it( 'follows the browser when nothing in the tag is a language', () => {
		setPageLanguage( '!!' );

		expect( formatNumber( 270000 ) ).toBe( inTheBrowsersLanguage( 270000 ) );
	} );

	it( 'returns an empty string for what is not a number', () => {
		setPageLanguage( 'en-US' );

		expect( formatNumber( 'not-a-number' ) ).toBe( '' );
		expect( formatNumber( undefined ) ).toBe( '' );
		expect( formatNumber( Infinity ) ).toBe( '' );
	} );
} );
