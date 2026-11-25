import {
	SHARE_LIMITS,
	SHARE_PREFIX,
	buildShareHash,
	isShareHash,
	isWrittenShareHash,
	parseShareHash,
	restoreShareHash,
	shareFields,
	writeShareHash,
} from './shareLink';

const fields = { facetFields: [ 'farbe', 'brand' ], rangeFields: [ 'price' ] };

describe( 'buildShareHash', () => {
	it( 'writes nothing for a window with nothing in it', () => {
		expect( buildShareHash() ).toBe( '' );
		expect( buildShareHash( { query: '   ', types: [], facets: {}, ranges: {} } ) ).toBe( '' );
		expect( buildShareHash( { facets: { farbe: [] }, ranges: { price: { min: '', max: '' } } } ) ).toBe( '' );
	} );

	it( 'writes the words, the type, every value and the bounds in the documented form', () => {
		expect(
			buildShareHash( {
				query: ' steppjacke ',
				types: [ 'product' ],
				facets: { farbe: [ 'rot', 'blau' ] },
				ranges: { price: { min: '20', max: '100' } },
			} )
		).toBe( '#searcio?q=steppjacke&type=product&f.farbe=rot&f.farbe=blau&r.price=20%2C100' );
	} );

	it( 'writes the first type only, and one side of a bound', () => {
		expect( buildShareHash( { types: [ 'post', 'page' ] } ) ).toBe( '#searcio?type=post' );
		expect( buildShareHash( { ranges: { price: { min: '', max: '50' } } } ) ).toBe( '#searcio?r.price=%2C50' );
	} );

	it( 'writes a value once', () => {
		expect( buildShareHash( { facets: { farbe: [ 'rot', 'rot' ] } } ) ).toBe( '#searcio?f.farbe=rot' );
	} );

	it( 'shares a search too long for an address as none', () => {
		expect( buildShareHash( { query: 'x'.repeat( SHARE_LIMITS.hash ) } ) ).toBe( '' );
	} );
} );

describe( 'parseShareHash', () => {
	it( 'is not a link without the prefix, with nothing behind it, or beyond the length', () => {
		expect( parseShareHash( '' ) ).toBeNull();
		expect( parseShareHash( '#searcio' ) ).toBeNull();
		expect( parseShareHash( '#pricing' ) ).toBeNull();
		expect( parseShareHash( '#searcio?' ) ).toBeNull();
		expect( parseShareHash( `${ SHARE_PREFIX }q=${ 'a'.repeat( SHARE_LIMITS.hash ) }` ) ).toBeNull();
		expect( parseShareHash( null ) ).toBeNull();
		expect( parseShareHash( undefined ) ).toBeNull();
	} );

	it( 'reads what buildShareHash wrote, for words with umlauts, spaces and signs of an address', () => {
		const state = {
			query: 'Größe & Maß = 50% "Jacke" #1',
			types: [ 'product' ],
			facets: { farbe: [ 'Rot / Weiß', 'Blau' ], brand: [ 'Müller+Söhne' ] },
			ranges: { price: { min: '19.5', max: '' } },
		};

		expect( parseShareHash( buildShareHash( state ), fields ) ).toEqual( {
			query: state.query,
			types: [ 'product' ],
			facets: state.facets,
			ranges: { price: { min: '19.5', max: '' } },
		} );
	} );

	it( 'reads a link as it is typed by hand', () => {
		expect( parseShareHash( '#searcio?q=jacke&type=post&f.farbe=rot&r.price=,99', fields ) ).toEqual( {
			query: 'jacke',
			types: [ 'post' ],
			facets: { farbe: [ 'rot' ] },
			ranges: { price: { min: '', max: '99' } },
		} );
	} );

	it( 'ignores a key it does not know, so a later version can add one', () => {
		expect( parseShareHash( '#searcio?q=jacke&sort=price&tab=assistant&autorun=1&v=2', fields ) ).toEqual( {
			query: 'jacke',
			types: [],
			facets: {},
			ranges: {},
		} );
	} );

	it( 'is no link when nothing in it can be used', () => {
		expect( parseShareHash( '#searcio?sort=price&tab=assistant', fields ) ).toBeNull();
		expect( parseShareHash( '#searcio?f.unknown=x&r.farbe=1,2', fields ) ).toBeNull();
	} );

	it( 'takes a filter only of a field the site has set up', () => {
		expect( parseShareHash( '#searcio?f.farbe=rot&f.secret=1&f.price=5', fields ).facets ).toEqual( { farbe: [ 'rot' ] } );
	} );

	it( 'takes a filter of any field of a safe name where the site has set up none', () => {
		expect( parseShareHash( '#searcio?f.brand=Acme&f.a b=1&f.<x>=2' ).facets ).toEqual( { brand: [ 'Acme' ] } );
		expect( parseShareHash( '#searcio?f.brand=Acme', { facetFields: [], rangeFields: [] } ).facets ).toEqual( { brand: [ 'Acme' ] } );
	} );

	it( 'takes a bound only for a number field, of two numbers', () => {
		expect( parseShareHash( '#searcio?q=a&r.price=1,2&r.farbe=1,2', fields ).ranges ).toEqual( { price: { min: '1', max: '2' } } );
		expect( parseShareHash( '#searcio?q=a&r.price=abc,2', fields ).ranges ).toEqual( {} );
		expect( parseShareHash( '#searcio?q=a&r.price=1,2,3', fields ).ranges ).toEqual( {} );
		expect( parseShareHash( '#searcio?q=a&r.price=5', fields ).ranges ).toEqual( {} );
		expect( parseShareHash( '#searcio?q=a&r.price=,', fields ).ranges ).toEqual( {} );
		expect( parseShareHash( '#searcio?q=a&r.price=1e9,2', fields ).ranges ).toEqual( {} );
		// A site with filters, none of them a number: no bound is a bound of its.
		expect( parseShareHash( '#searcio?q=a&r.price=1,2', { facetFields: [ 'farbe' ], rangeFields: [] } ).ranges ).toEqual( {} );
		// A site with none set up takes the bound of a field of a safe name.
		expect( parseShareHash( '#searcio?q=a&r.price=1,2&r.a b=1,2' ).ranges ).toEqual( { price: { min: '1', max: '2' } } );
	} );

	it( 'takes one type, of a safe name', () => {
		expect( parseShareHash( '#searcio?type=post&type=page' ).types ).toEqual( [ 'post' ] );
		expect( parseShareHash( '#searcio?q=a&type=po%20st' ).types ).toEqual( [] );
		expect( parseShareHash( '#searcio?q=a&type=<script>' ).types ).toEqual( [] );
		expect( parseShareHash( `#searcio?q=a&type=${ 'x'.repeat( SHARE_LIMITS.type + 1 ) }` ).types ).toEqual( [] );
	} );

	it( 'leaves out control characters and words beyond the length', () => {
		expect( parseShareHash( '#searcio?q=a%00b', fields ) ).toBeNull();
		expect( parseShareHash( '#searcio?q=a%0Ab', fields ) ).toBeNull();
		expect( parseShareHash( `#searcio?q=${ 'a'.repeat( SHARE_LIMITS.query + 1 ) }`, fields ) ).toBeNull();
		expect( parseShareHash( `#searcio?q=${ 'a'.repeat( SHARE_LIMITS.query ) }`, fields ).query ).toHaveLength( SHARE_LIMITS.query );
		expect( parseShareHash( '#searcio?q=a&f.farbe=a%07b&f.farbe=rot', fields ).facets ).toEqual( { farbe: [ 'rot' ] } );
	} );

	it( 'holds a link to the number of fields, values and bounds', () => {
		const fieldNames = Array.from( { length: SHARE_LIMITS.fields + 5 }, ( _, index ) => `f${ index }` );
		const manyFields = fieldNames.map( ( name ) => `f.${ name }=1` ).join( '&' );
		const manyValues = Array.from( { length: SHARE_LIMITS.values + 10 }, ( _, index ) => `f.farbe=v${ index }` ).join( '&' );
		const manyBounds = fieldNames.map( ( name ) => `r.${ name }=1,2` ).join( '&' );

		expect( Object.keys( parseShareHash( `#searcio?${ manyFields }` ).facets ) ).toHaveLength( SHARE_LIMITS.fields );
		expect( parseShareHash( `#searcio?${ manyValues }`, fields ).facets.farbe ).toHaveLength( SHARE_LIMITS.values );
		expect( Object.keys( parseShareHash( `#searcio?${ manyBounds }`, { facetFields: [], rangeFields: fieldNames } ).ranges ) ).toHaveLength( SHARE_LIMITS.ranges );
	} );

	it( 'never turns words into markup: they come back as the text they are', () => {
		expect( parseShareHash( '#searcio?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', fields ).query ).toBe( '<img src=x onerror=alert(1)>' );
	} );
} );

describe( 'isShareHash', () => {
	it( 'tells a shared search from the other anchors of a page', () => {
		expect( isShareHash( '#searcio?q=a' ) ).toBe( true );
		expect( isShareHash( '#searcio' ) ).toBe( false );
		expect( isShareHash( '#pricing' ) ).toBe( false );
		expect( isShareHash( '' ) ).toBe( false );
		expect( isShareHash( undefined ) ).toBe( false );
	} );
} );

describe( 'shareFields', () => {
	it( 'separates the filters of values from those of numbers', () => {
		expect(
			shareFields( {
				facets: [
					{ field: 'brand', display: 'chips' },
					{ field: 'price', display: 'range' },
					{ field: 'farbe' },
					{ display: 'range' },
				],
			} )
		).toEqual( { facetFields: [ 'brand', 'farbe' ], rangeFields: [ 'price' ] } );
	} );

	it( 'is empty where the site has set up nothing', () => {
		expect( shareFields( {} ) ).toEqual( { facetFields: [], rangeFields: [] } );
		expect( shareFields( undefined ) ).toEqual( { facetFields: [], rangeFields: [] } );
		expect( shareFields( { facets: 'x' } ) ).toEqual( { facetFields: [], rangeFields: [] } );
	} );
} );

describe( 'the address of the page', () => {
	const start = ( url ) => window.history.replaceState( null, '', url );

	afterEach( () => {
		restoreShareHash();
		start( '/' );
	} );

	it( 'shows a search without adding an entry to the history', () => {
		start( '/shop/?page=2' );

		const before = window.history.length;

		writeShareHash( '#searcio?q=jacke' );

		expect( window.location.pathname + window.location.search + window.location.hash ).toBe( '/shop/?page=2#searcio?q=jacke' );
		expect( window.history.length ).toBe( before );
		expect( isWrittenShareHash( '#searcio?q=jacke' ) ).toBe( true );
		expect( isWrittenShareHash( '#searcio?q=other' ) ).toBe( false );
	} );

	it( 'follows the search as it changes', () => {
		start( '/' );
		writeShareHash( '#searcio?q=ja' );
		writeShareHash( '#searcio?q=jacke&type=post' );

		expect( window.location.hash ).toBe( '#searcio?q=jacke&type=post' );
	} );

	it( 'takes the address out again when the window closes', () => {
		start( '/shop/' );
		writeShareHash( '#searcio?q=jacke' );
		restoreShareHash();

		expect( window.location.href ).toBe( 'http://localhost/shop/' );
		expect( isWrittenShareHash( '#searcio?q=jacke' ) ).toBe( false );
	} );

	it( 'takes the address out when the search is empty', () => {
		start( '/shop/' );
		writeShareHash( '#searcio?q=jacke' );
		writeShareHash( '' );

		expect( window.location.hash ).toBe( '' );
	} );

	it( 'gives the anchor the page had back', () => {
		start( '/shop/#pricing' );
		writeShareHash( '#searcio?q=jacke' );

		expect( window.location.hash ).toBe( '#searcio?q=jacke' );

		restoreShareHash();

		expect( window.location.hash ).toBe( '#pricing' );
	} );

	it( 'takes out the address of the link the page was opened with, and puts back nothing', () => {
		start( '/shop/#searcio?q=jacke' );
		writeShareHash( '#searcio?q=jacke&type=post' );
		restoreShareHash();

		expect( window.location.hash ).toBe( '' );
	} );

	it( 'leaves an address alone that is no longer its own', () => {
		start( '/shop/' );
		writeShareHash( '#searcio?q=jacke' );
		start( '/shop/#contact' );
		restoreShareHash();

		expect( window.location.hash ).toBe( '#contact' );
	} );
} );
