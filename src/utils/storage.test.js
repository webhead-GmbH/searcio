import {
	getRecentSearches,
	addRecentSearch,
	removeRecentSearch,
	clearRecentSearches,
} from './storage';

beforeEach( () => {
	window.localStorage.clear();
} );

describe( 'getRecentSearches', () => {
	it( 'returns an empty list when nothing is stored', () => {
		expect( getRecentSearches() ).toEqual( [] );
	} );

	it( 'ignores corrupted JSON and non-array values', () => {
		window.localStorage.setItem( 'webheadSearchCloud.recentSearches', 'not json' );
		expect( getRecentSearches() ).toEqual( [] );

		window.localStorage.setItem( 'webheadSearchCloud.recentSearches', JSON.stringify( { not: 'an array' } ) );
		expect( getRecentSearches() ).toEqual( [] );
	} );

	it( 'filters out any non-string entries from a corrupted list', () => {
		window.localStorage.setItem( 'webheadSearchCloud.recentSearches', JSON.stringify( [ 'shirt', 42, null, 'cap' ] ) );

		expect( getRecentSearches() ).toEqual( [ 'shirt', 'cap' ] );
	} );
} );

describe( 'addRecentSearch', () => {
	it( 'adds a query to the front of the list', () => {
		addRecentSearch( 'shirt' );
		const result = addRecentSearch( 'cap' );

		expect( result ).toEqual( [ 'cap', 'shirt' ] );
	} );

	it( 'trims whitespace before storing', () => {
		const result = addRecentSearch( '  shirt  ' );

		expect( result ).toEqual( [ 'shirt' ] );
	} );

	it( 'ignores an empty or whitespace-only query and returns the list unchanged', () => {
		addRecentSearch( 'shirt' );

		expect( addRecentSearch( '' ) ).toEqual( [ 'shirt' ] );
		expect( addRecentSearch( '   ' ) ).toEqual( [ 'shirt' ] );
	} );

	it( 'de-duplicates case-insensitively, moving the existing entry to the front', () => {
		addRecentSearch( 'Shirt' );
		addRecentSearch( 'cap' );
		const result = addRecentSearch( 'SHIRT' );

		expect( result ).toEqual( [ 'SHIRT', 'cap' ] );
	} );

	it( 'caps the list at 8 items, dropping the oldest', () => {
		for ( let i = 1; i <= 9; i++ ) {
			addRecentSearch( `query-${ i }` );
		}

		const result = getRecentSearches();

		expect( result ).toHaveLength( 8 );
		expect( result[ 0 ] ).toBe( 'query-9' );
		expect( result ).not.toContain( 'query-1' );
	} );

	it( 'persists across calls to getRecentSearches', () => {
		addRecentSearch( 'shirt' );

		expect( getRecentSearches() ).toEqual( [ 'shirt' ] );
	} );
} );

describe( 'removeRecentSearch', () => {
	it( 'removes a matching entry case-insensitively', () => {
		addRecentSearch( 'shirt' );
		addRecentSearch( 'cap' );

		const result = removeRecentSearch( 'SHIRT' );

		expect( result ).toEqual( [ 'cap' ] );
		expect( getRecentSearches() ).toEqual( [ 'cap' ] );
	} );

	it( 'is a no-op when the query is not in the list', () => {
		addRecentSearch( 'shirt' );

		expect( removeRecentSearch( 'missing' ) ).toEqual( [ 'shirt' ] );
	} );
} );

describe( 'clearRecentSearches', () => {
	it( 'empties the list', () => {
		addRecentSearch( 'shirt' );

		expect( clearRecentSearches() ).toEqual( [] );
		expect( getRecentSearches() ).toEqual( [] );
	} );
} );
