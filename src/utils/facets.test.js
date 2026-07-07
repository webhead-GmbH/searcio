import {
	buildFilterParams,
	buildTypeParam,
	extractFieldFacets,
	humanizeFieldLabel,
	mergeFieldFacets,
	toggleSelection,
} from './facets';

describe( 'toggleSelection', () => {
	it( 'appends a value that is not yet selected', () => {
		expect( toggleSelection( [ 'red' ], 'blue' ) ).toEqual( [ 'red', 'blue' ] );
	} );

	it( 'removes a value that is already selected', () => {
		expect( toggleSelection( [ 'red', 'blue' ], 'red' ) ).toEqual( [ 'blue' ] );
	} );

	it( 'does not mutate the input list', () => {
		const list = [ 'red' ];

		toggleSelection( list, 'blue' );

		expect( list ).toEqual( [ 'red' ] );
	} );
} );

describe( 'buildTypeParam', () => {
	it( 'a scope-locked instance always wins over active multi-select types', () => {
		expect( buildTypeParam( 'product', [ 'post', 'page' ] ) ).toBe( 'product' );
	} );

	it( 'joins multiple active types with a comma when unscoped', () => {
		expect( buildTypeParam( '', [ 'product', 'post' ] ) ).toBe( 'product,post' );
	} );

	it( 'is empty when unscoped with nothing selected ("All")', () => {
		expect( buildTypeParam( '', [] ) ).toBe( '' );
	} );
} );

describe( 'extractFieldFacets', () => {
	it( 'keeps every facet key except the built-in "types"', () => {
		const facets = {
			types: [ { value: 'product', count: 10 } ],
			brand: [ { value: 'Acme', count: 7 } ],
			color: [ { value: 'red', count: 3 } ],
		};

		expect( extractFieldFacets( facets ) ).toEqual( {
			brand: [ { value: 'Acme', count: 7 } ],
			color: [ { value: 'red', count: 3 } ],
		} );
	} );

	it( 'returns an empty object for a missing/malformed facets payload', () => {
		expect( extractFieldFacets( undefined ) ).toEqual( {} );
		expect( extractFieldFacets( { brand: 'not-an-array' } ) ).toEqual( {} );
	} );
} );

describe( 'buildFilterParams', () => {
	it( 'joins multi-select values per field with a comma', () => {
		expect( buildFilterParams( { brand: [ 'Acme', 'Duff' ] } ) ).toEqual( { brand: 'Acme,Duff' } );
	} );

	it( 'omits fields with no active selection', () => {
		expect( buildFilterParams( { brand: [] } ) ).toEqual( {} );
	} );

	it( 'merges in forced extra filters, which win over an active selection for the same field', () => {
		expect(
			buildFilterParams( { featured: [ 'false' ] }, { featured: 'true' } )
		).toEqual( { featured: 'true' } );
	} );
} );

describe( 'mergeFieldFacets', () => {
	it( 'keeps the frozen option list for a field with its own active filter', () => {
		const current = { color: [ { value: 'red', count: 3 }, { value: 'blue', count: 2 } ] };
		// The server response has already collapsed to just the selected value.
		const incoming = { color: [ { value: 'red', count: 3 } ] };

		expect( mergeFieldFacets( current, incoming, { color: [ 'red' ] } ) ).toEqual( current );
	} );

	it( 'takes the fresh list for a field with no active filter of its own', () => {
		const current = { brand: [ { value: 'Acme', count: 7 } ] };
		const incoming = { brand: [ { value: 'Acme', count: 5 }, { value: 'Duff', count: 2 } ] };

		expect( mergeFieldFacets( current, incoming, {} ) ).toEqual( incoming );
	} );

	it( 'adds a field that has not been seen before', () => {
		expect( mergeFieldFacets( {}, { brand: [ { value: 'Acme', count: 7 } ] }, {} ) ).toEqual( {
			brand: [ { value: 'Acme', count: 7 } ],
		} );
	} );
} );

describe( 'humanizeFieldLabel', () => {
	it( 'replaces underscores/hyphens with spaces and capitalizes the first letter', () => {
		expect( humanizeFieldLabel( 'review_count' ) ).toBe( 'Review count' );
		expect( humanizeFieldLabel( 'stock-status' ) ).toBe( 'Stock status' );
	} );

	it( 'returns an empty string for an empty field name', () => {
		expect( humanizeFieldLabel( '' ) ).toBe( '' );
	} );
} );
