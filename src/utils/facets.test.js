import {
	appendHits,
	buildFilterParams,
	buildRangeParams,
	buildTypeParam,
	extractFieldFacets,
	extractRangeFields,
	hasMorePages,
	humanizeFieldLabel,
	mergeFieldFacets,
	mergeRangeFields,
	toggleSelection,
	totalIsExact,
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

	it( 'drops a configured facet with no buckets, which would render a heading over nothing', () => {
		expect( extractFieldFacets( { brand: [ { value: 'Acme', count: 7 } ], price: [] } ) ).toEqual( {
			brand: [ { value: 'Acme', count: 7 } ],
		} );
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

describe( 'humanizeFieldLabel for the plugin\'s own fields', () => {
	/**
	 * These go through the translation functions; under Jest that returns the
	 * English source. Humanized from the key instead they read as English on a
	 * German storefront - "Categories" on the quiz's answer chips.
	 */
	it( 'names the fields the indexer writes', () => {
		expect( humanizeFieldLabel( 'categories' ) ).toBe( 'Categories' );
		expect( humanizeFieldLabel( 'product_tags' ) ).toBe( 'Tags' );
		expect( humanizeFieldLabel( 'skus' ) ).toBe( 'SKUs' );
		expect( humanizeFieldLabel( 'price_min' ) ).toBe( 'Lowest price' );
	} );

	it( 'still humanizes a merchant field it has no name for', () => {
		expect( humanizeFieldLabel( 'attr_material' ) ).toBe( 'Material' );
	} );
} );

describe( 'humanizeFieldLabel prefixes', () => {
	/**
	 * WooCommerce attributes reach the index prefixed. Showing "Attr color" as a
	 * comparison-table row label is how this surfaced.
	 */
	it( 'strips the indexer prefixes off an attribute field', () => {
		expect( humanizeFieldLabel( 'attr_color' ) ).toBe( 'Color' );
		expect( humanizeFieldLabel( 'pa_size' ) ).toBe( 'Size' );
		expect( humanizeFieldLabel( 'meta_brand' ) ).toBe( 'Brand' );
	} );

	it( 'leaves a plain field alone', () => {
		expect( humanizeFieldLabel( 'stock_status' ) ).toBe( 'Stock status' );
		expect( humanizeFieldLabel( 'brand' ) ).toBe( 'Brand' );
	} );

	/** A shopper reads these as acronyms, not as sentence-cased words. */
	it( 'uppercases a whole-word acronym', () => {
		expect( humanizeFieldLabel( 'sku' ) ).toBe( 'SKU' );
		expect( humanizeFieldLabel( 'product_id' ) ).toBe( 'Product ID' );
	} );

	it( 'leaves a word that merely contains an acronym alone', () => {
		expect( humanizeFieldLabel( 'idea' ) ).toBe( 'Idea' );
		expect( humanizeFieldLabel( 'skudo_rating' ) ).toBe( 'Skudo rating' );
	} );

	/** Only a real prefix is stripped — not a word that merely starts with it. */
	it( 'does not eat a field whose name begins with the prefix letters', () => {
		expect( humanizeFieldLabel( 'attributes' ) ).toBe( 'Attributes' );
		expect( humanizeFieldLabel( 'package_size' ) ).toBe( 'Package size' );
	} );
} );

describe( 'extractRangeFields', () => {
	const facets = { types: [ { value: 'product', count: 3 } ], price: [], brand: [ { value: 'Acme', count: 2 } ] };

	it( 'reads the span from the hits, since a numeric field aggregates to nothing', () => {
		const hits = [
			{ source: { price: 19.5, brand: 'Acme' } },
			{ source: { price: 240.25, brand: 'Acme' } },
			{ source: { price: 80, brand: 'Zed' } },
		];

		expect( extractRangeFields( facets, hits ) ).toEqual( { price: { min: 19, max: 241 } } );
	} );

	it( 'never treats a text field as a range, even when one value happens to be a number', () => {
		const hits = [
			{ source: { brand: '2024' } },
			{ source: { brand: 'Acme' } },
		];

		expect( extractRangeFields( { brand: [] }, hits ) ).toEqual( {} );
	} );

	it( 'ignores a field only one hit carries, or one whose values never differ', () => {
		expect( extractRangeFields( { price: [] }, [ { source: { price: 10 } } ] ) ).toEqual( {} );
		expect( extractRangeFields( { price: [] }, [ { source: { price: 10 } }, { source: { price: 10 } } ] ) ).toEqual( {} );
	} );

	it( 'only offers fields the API would accept a range for', () => {
		// `weight` is numeric on the documents but is not a configured facet,
		// so `range[weight]` would be a 422.
		const hits = [ { source: { weight: 1 } }, { source: { weight: 9 } } ];

		expect( extractRangeFields( { brand: [] }, hits ) ).toEqual( {} );
	} );

	it( 'survives a missing hits list', () => {
		expect( extractRangeFields( facets, undefined ) ).toEqual( {} );
	} );
} );

describe( 'mergeRangeFields', () => {
	it( 'freezes the span of a field that has a bound applied', () => {
		const current = { price: { min: 5, max: 500 } };
		const incoming = { price: { min: 5, max: 48 } };

		expect( mergeRangeFields( current, incoming, { price: { min: '', max: '50' } } ) ).toEqual( {
			price: { min: 5, max: 500 },
		} );
	} );

	it( 'takes the fresh span for a field with no bound of its own', () => {
		const current = { price: { min: 5, max: 500 } };
		const incoming = { price: { min: 12, max: 90 } };

		expect( mergeRangeFields( current, incoming, { brand: { min: '1', max: '' } } ) ).toEqual( {
			price: { min: 12, max: 90 },
		} );
	} );
} );

describe( 'buildRangeParams', () => {
	it( 'joins both bounds', () => {
		expect( buildRangeParams( { price: { min: '10', max: '50' } } ) ).toEqual( { price: '10:50' } );
	} );

	it( 'leaves an open side empty', () => {
		expect( buildRangeParams( { price: { min: '10', max: '' } } ) ).toEqual( { price: '10:' } );
		expect( buildRangeParams( { rating: { min: '', max: 4 } } ) ).toEqual( { rating: ':4' } );
	} );

	it( 'drops a field with neither bound rather than sending a bare colon', () => {
		expect( buildRangeParams( { price: { min: '', max: '' }, rating: {} } ) ).toEqual( {} );
		expect( buildRangeParams( undefined ) ).toEqual( {} );
	} );
} );

describe( 'appendHits', () => {
	it( 'adds the new page after the old one', () => {
		expect( appendHits( [ { id: 'a' } ], [ { id: 'b' } ] ) ).toEqual( [ { id: 'a' }, { id: 'b' } ] );
	} );

	it( 'keeps the first copy of an id that comes back on two pages', () => {
		// Two cards under one React key is a crash, and an index being written
		// to while it is being paged is exactly when this happens.
		expect( appendHits( [ { id: 'a' }, { id: 'b' } ], [ { id: 'b' }, { id: 'c' } ] ) ).toEqual( [
			{ id: 'a' },
			{ id: 'b' },
			{ id: 'c' },
		] );
	} );

	it( 'survives either side being missing', () => {
		expect( appendHits( undefined, [ { id: 'a' } ] ) ).toEqual( [ { id: 'a' } ] );
		expect( appendHits( [ { id: 'a' } ], undefined ) ).toEqual( [ { id: 'a' } ] );
	} );
} );

describe( 'totalIsExact', () => {
	it( 'trusts the total when the site has no semantic search', () => {
		expect( totalIsExact( false, 'shirt' ) ).toBe( true );
	} );

	it( 'trusts it for an empty query even on a semantic site: that query is lexical too', () => {
		expect( totalIsExact( true, '' ) ).toBe( true );
		expect( totalIsExact( true, '   ' ) ).toBe( true );
	} );

	it( 'does not trust it for a semantic query, where it counts the window and not the matches', () => {
		expect( totalIsExact( true, 'shirt' ) ).toBe( false );
	} );
} );

describe( 'hasMorePages', () => {
	it( 'offers more while an exact total exceeds what is loaded', () => {
		expect( hasMorePages( { total: 45 }, 20, true ) ).toBe( true );
		expect( hasMorePages( { total: 45 }, 45, true ) ).toBe( false );
	} );

	it( 'goes by a full page when the total cannot be trusted', () => {
		// Measured against the service: a semantic query reports total 23 on
		// page one and 40 on page two, of 96 documents. Trusting it would have
		// stopped at 40.
		expect( hasMorePages( { total: 23, per_page: 20, pageCount: 20 }, 20, false ) ).toBe( true );
		expect( hasMorePages( { total: 40, per_page: 20, pageCount: 20 }, 40, false ) ).toBe( true );
		expect( hasMorePages( { total: 96, per_page: 20, pageCount: 16 }, 96, false ) ).toBe( false );
	} );

	it( 'offers nothing when there are no results at all', () => {
		expect( hasMorePages( { total: 0, per_page: 20, pageCount: 0 }, 0, false ) ).toBe( false );
		expect( hasMorePages( null, 0, true ) ).toBe( false );
	} );
} );
