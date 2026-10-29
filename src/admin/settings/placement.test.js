import {
	SEARCH_DEFAULTS,
	buildShortcode,
	invalidSelectors,
	normalizePlacement,
	previewUrl,
	textToSelectors,
	withSuggestion,
} from './placement';

const TAG = 'searcio';

describe( 'buildShortcode', () => {
	it( 'is the bare tag when nothing differs from the defaults', () => {
		expect( buildShortcode( TAG, { ...SEARCH_DEFAULTS }, SEARCH_DEFAULTS ) ).toBe( '[searcio]' );
	} );

	it( 'writes only what differs, in the order asked for', () => {
		expect(
			buildShortcode(
				TAG,
				{ ...SEARCH_DEFAULTS, width: 320, mode: 'box', align: 'start' },
				SEARCH_DEFAULTS,
				[ 'mode', 'placeholder', 'width', 'align' ]
			)
		).toBe( '[searcio mode="box" width="320"]' );
	} );

	it( 'writes a switch as yes or no, and nothing as an empty value', () => {
		expect( buildShortcode( 'searcio_products', { banner: false, limit: null }, { banner: true, limit: 8 } ) )
			.toBe( '[searcio_products banner="no" limit=""]' );
	} );

	it( 'keeps a value a shortcode can hold', () => {
		expect( buildShortcode( TAG, { placeholder: 'Say "hi"' }, {} ) ).toBe( "[searcio placeholder='Say \"hi\"']" );
		expect( buildShortcode( TAG, { placeholder: 'It\'s "x"' }, {} ) ).toBe( '[searcio placeholder="It\'s x"]' );
		expect( buildShortcode( TAG, { placeholder: 'a [b] c' }, {} ) ).toBe( '[searcio placeholder="a b c"]' );
	} );
} );

describe( 'selectors', () => {
	it( 'reads one per line, without blanks', () => {
		expect( textToSelectors( ' .a \n\n #b > a \n' ) ).toEqual( [ '.a', '#b > a' ] );
	} );

	it( 'finds the ones a browser cannot read', () => {
		expect( invalidSelectors( [ '.ok', 'a[href=', '#menu-item-search > a', '>>' ] ) ).toEqual( [ 'a[href=', '>>' ] );
	} );

	it( 'adds a suggestion once', () => {
		expect( withSuggestion( [ '.a' ], [ '.a', '.b' ] ) ).toEqual( [ '.a', '.b' ] );
	} );
} );

describe( 'normalizePlacement', () => {
	it( 'fills what the endpoint left out with the defaults', () => {
		const placement = normalizePlacement( { search: { mode: 'box' }, floating: { enabled: true } } );

		expect( placement.takeover ).toBe( false );
		expect( placement.selectors ).toEqual( [] );
		expect( placement.search ).toEqual( { ...SEARCH_DEFAULTS, mode: 'box' } );
		expect( placement.floating.offset ).toBe( 24 );
		expect( placement.products.layout ).toBe( 'carousel' );
	} );
} );

describe( 'previewUrl', () => {
	it( 'carries the nonce, the view and the settings on screen', () => {
		const url = new URL( previewUrl( { url: 'https://shop.test/?searcio-preview=1', nonce: 'abc' }, 'modal', { search: { mode: 'box' } } ) );

		expect( url.searchParams.get( 'searcio-preview' ) ).toBe( '1' );
		expect( url.searchParams.get( '_wpnonce' ) ).toBe( 'abc' );
		expect( url.searchParams.get( 'view' ) ).toBe( 'modal' );
		expect( JSON.parse( url.searchParams.get( 'placement' ) ) ).toEqual( { search: { mode: 'box' } } );
	} );

	it( 'is nothing without an address', () => {
		expect( previewUrl( undefined, 'trigger', {} ) ).toBe( '' );
	} );
} );
