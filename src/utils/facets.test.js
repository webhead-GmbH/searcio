import {
	activeFilterCount,
	appendHits,
	buildFilterParams,
	buildRangeParams,
	buildTypeParam,
	compareFacetValues,
	detectFacetDisplay,
	extractFieldFacets,
	extractRangeFields,
	facetCoverage,
	filterButtonLabel,
	fitFilterButtons,
	formatCount,
	freezeValueOrder,
	hasMorePages,
	humanizeFieldLabel,
	mergeFieldFacets,
	mergeRangeFields,
	orderFacetGroups,
	parseAmount,
	rangeLabel,
	summarizeSelection,
	toggleSelection,
	topValues,
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

describe( 'humanizeFieldLabel with the site\'s own names', () => {
	/**
	 * `fieldLabels` of the storefront config: the attribute's name and the
	 * mapped taxonomy's name, in the page's language. Humanized from the key, a
	 * German shop's facet headings read "Color", "Size" and "Brand".
	 */
	const labels = { attr_color: 'Farbe', 'attr_shoe-size': 'Schuhgröße', brand: 'Marke' };

	it( 'names an attribute and a mapped taxonomy as the site does', () => {
		expect( humanizeFieldLabel( 'attr_color', labels ) ).toBe( 'Farbe' );
		expect( humanizeFieldLabel( 'attr_shoe-size', labels ) ).toBe( 'Schuhgröße' );
		expect( humanizeFieldLabel( 'brand', labels ) ).toBe( 'Marke' );
	} );

	it( 'prefers the site\'s name to the plugin\'s own', () => {
		expect( humanizeFieldLabel( 'categories', { categories: 'Kategorie' } ) ).toBe( 'Kategorie' );
	} );

	it( 'falls back to the plugin\'s name and then to the key for a field the site does not name', () => {
		expect( humanizeFieldLabel( 'categories', labels ) ).toBe( 'Categories' );
		expect( humanizeFieldLabel( 'attr_material', labels ) ).toBe( 'Material' );
	} );

	it( 'ignores a name that is empty or not text', () => {
		expect( humanizeFieldLabel( 'attr_color', { attr_color: '  ' } ) ).toBe( 'Color' );
		expect( humanizeFieldLabel( 'attr_color', { attr_color: 7 } ) ).toBe( 'Color' );
	} );

	/** PHP sends an empty map as `[]`, and the config may not carry one at all. */
	it( 'takes an empty list or no names at all', () => {
		expect( humanizeFieldLabel( 'attr_color', [] ) ).toBe( 'Color' );
		expect( humanizeFieldLabel( 'attr_color', undefined ) ).toBe( 'Color' );
	} );

	it( 'does not take a name from the object prototype', () => {
		expect( humanizeFieldLabel( 'constructor', {} ) ).toBe( 'Constructor' );
		expect( humanizeFieldLabel( 'constructor' ) ).toBe( 'Constructor' );
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

	/** Only a real prefix is stripped - not a word that merely starts with it. */
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

describe( 'formatCount', () => {
	it( 'compacts thousands and millions, and leaves the rest as it is', () => {
		expect( formatCount( 7 ) ).toBe( '7' );
		expect( formatCount( 32494 ) ).toBe( '32K+' );
		expect( formatCount( 2500000 ) ).toBe( '2M+' );
		expect( formatCount( 'x' ) ).toBe( '0' );
	} );
} );

describe( 'facetCoverage', () => {
	it( 'is the share of the loaded hits that carry a field', () => {
		const hits = [
			{ source: { attr_color: [ 'Oliv' ], attr_size: [ 'M' ] } },
			{ source: { attr_color: [ 'Schwarz' ] } },
			{ source: { attr_color: [] } },
			{ source: {} },
		];

		expect( facetCoverage( { attr_color: [], attr_size: [] }, hits, 4 ) ).toEqual( { attr_color: 0.5, attr_size: 0.25 } );
	} );

	it( 'is at least what the most common value covers of the whole match set', () => {
		expect( facetCoverage( { brand: [ { value: 'Acme', count: 30 } ] }, [], 100 ) ).toEqual( { brand: 0.3 } );
	} );
} );

describe( 'orderFacetGroups', () => {
	const coverage = { categories: 1, brand: 1, attr_color: 0.9, attr_size: 0.35, attr_storage: 0.05 };

	it( 'keeps the order Search Config lists the fields in', () => {
		expect(
			orderFacetGroups( [ 'attr_size', 'brand', 'attr_color', 'categories' ], {
				configuredOrder: [ 'categories', 'brand', 'attr_color', 'attr_size' ],
				coverage,
			} )
		).toEqual( [ 'categories', 'brand', 'attr_color', 'attr_size' ] );
	} );

	it( 'moves a group that few results carry behind the rest', () => {
		expect(
			orderFacetGroups( [ 'categories', 'attr_storage', 'brand' ], {
				configuredOrder: [ 'categories', 'attr_storage', 'brand' ],
				coverage,
			} )
		).toEqual( [ 'categories', 'brand', 'attr_storage' ] );
	} );

	it( 'keeps an active group in its place, even when no result carries it', () => {
		expect(
			orderFacetGroups( [ 'categories', 'brand' ], {
				configuredOrder: [ 'categories', 'attr_storage', 'brand' ],
				coverage: { ...coverage, attr_storage: 0 },
				active: [ 'attr_storage' ],
			} )
		).toEqual( [ 'categories', 'attr_storage', 'brand' ] );
	} );

	it( 'puts a field Search Config does not list after the ones it does', () => {
		expect(
			orderFacetGroups( [ 'price', 'brand', 'categories' ], { configuredOrder: [ 'categories', 'brand' ], coverage: { ...coverage, price: 1 } } )
		).toEqual( [ 'categories', 'brand', 'price' ] );
	} );

	it( 'orders by coverage when no order is configured, keeping ties as they came', () => {
		expect(
			orderFacetGroups( [ 'attr_size', 'brand', 'attr_color', 'categories' ], { coverage } )
		).toEqual( [ 'brand', 'categories', 'attr_color', 'attr_size' ] );
	} );

	it( 'gives the same order for the same input', () => {
		const input = [ [ 'attr_size', 'brand', 'attr_storage', 'categories' ], { configuredOrder: [ 'brand' ], coverage, active: [ 'attr_size' ] } ];

		expect( orderFacetGroups( ...input ) ).toEqual( orderFacetGroups( ...input ) );
	} );
} );

describe( 'fitFilterButtons', () => {
	const widths = [ [ 'categories', 110 ], [ 'brand', 90 ], [ 'price', 80 ], [ 'attr_color', 100 ], [ 'attr_size', 70 ] ];

	it( 'takes groups in order until the room runs out', () => {
		expect( fitFilterButtons( { widths, available: 320, limit: 5, gap: 8 } ) ).toEqual( [ 'categories', 'brand', 'price' ] );
	} );

	it( 'stops at the first that does not fit, never skipping to a shorter one', () => {
		// After categories, brand and price 106px are left: attr_color (108)
		// does not fit, attr_size (78) would - and is not taken.
		expect( fitFilterButtons( { widths, available: 410, limit: 5, gap: 8 } ) ).toEqual( [ 'categories', 'brand', 'price' ] );
	} );

	it( 'always keeps a pinned group, in its place in the bar', () => {
		expect( fitFilterButtons( { widths, available: 200, pinned: [ 'attr_size' ], limit: 5, gap: 8 } ) ).toEqual( [ 'categories', 'attr_size' ] );
	} );

	it( 'shows no more than the limit', () => {
		expect( fitFilterButtons( { widths, available: 2000, limit: 2, gap: 8 } ) ).toEqual( [ 'categories', 'brand' ] );
	} );

	it( 'shows none at a limit of 0, pinned ones included', () => {
		expect( fitFilterButtons( { widths, available: 2000, pinned: [ 'brand' ], limit: 0, gap: 8 } ) ).toEqual( [] );
	} );
} );

describe( 'topValues', () => {
	const values = [ 'a', 'b', 'c', 'd', 'e' ].map( ( value ) => ( { value } ) );

	it( 'keeps the first n and any selected value further down, in order, once', () => {
		expect( topValues( values, [ 'e', 'a', 'd' ], 2 ).map( ( entry ) => entry.value ) ).toEqual( [ 'a', 'b', 'd', 'e' ] );
	} );

	it( 'keeps everything when there are no more than n', () => {
		expect( topValues( values, [], 8 ) ).toHaveLength( 5 );
	} );
} );

describe( 'compareFacetValues', () => {
	const sorted = ( list ) => [ ...list ].sort( ( a, b ) => compareFacetValues( a, b, 'de' ) );

	it( 'puts clothing sizes in their natural order', () => {
		expect( sorted( [ 'XL', 'S', 'XXL', 'M', 'XS', 'L' ] ) ).toEqual( [ 'XS', 'S', 'M', 'L', 'XL', 'XXL' ] );
	} );

	it( 'sorts numbers as numbers', () => {
		expect( sorted( [ '10', '9', '38,5', '38' ] ) ).toEqual( [ '9', '10', '38', '38,5' ] );
	} );

	it( 'sorts capacities by size', () => {
		expect( sorted( [ '2 TB', '512 GB', '256 GB', '1 TB' ] ) ).toEqual( [ '256 GB', '512 GB', '1 TB', '2 TB' ] );
	} );

	it( 'sorts words as the language does', () => {
		expect( sorted( [ 'Zebra', 'Ölzeug', 'Apfel' ] ) ).toEqual( [ 'Apfel', 'Ölzeug', 'Zebra' ] );
	} );

	it( 'puts sizes before numbers, numbers before capacities, and those before words', () => {
		expect( sorted( [ 'Beige', '1 TB', '42', 'M' ] ) ).toEqual( [ 'M', '42', '1 TB', 'Beige' ] );
	} );
} );

describe( 'freezeValueOrder', () => {
	it( 'orders by count, then by name, and keeps a selected value without a count', () => {
		expect( freezeValueOrder( [ 'Grau', 'Oliv', 'Braun' ], { Grau: 4, Oliv: 4, Braun: 9 }, [ 'Rot' ] ) ).toEqual( [ 'Braun', 'Grau', 'Oliv', 'Rot' ] );
	} );

	it( 'orders tiles naturally', () => {
		expect( freezeValueOrder( [ 'L', 'S', 'M' ], { L: 9, S: 1, M: 4 }, [], { natural: true } ) ).toEqual( [ 'S', 'M', 'L' ] );
	} );
} );

describe( 'detectFacetDisplay', () => {
	it( 'draws sizes, shoe sizes and capacities as tiles', () => {
		expect( detectFacetDisplay( 'attr_size', [ 'XS', 'S', 'M', 'L', 'XL', 'XXL' ] ) ).toBe( 'tiles' );
		expect( detectFacetDisplay( 'attr_shoe-size', [ '36', '38', '40', '42', '44', '46' ] ) ).toBe( 'tiles' );
		expect( detectFacetDisplay( 'attr_storage', [ '256 GB', '512 GB', '1 TB', '2 TB' ] ) ).toBe( 'tiles' );
	} );

	it( 'draws colours when every value has one', () => {
		expect( detectFacetDisplay( 'attr_color', [ 'Oliv', 'Schwarz' ], { colors: { Oliv: '#6f7a3a', Schwarz: '#1f1f1f' } } ) ).toBe( 'color' );
	} );

	it( 'draws a list when one value has no colour', () => {
		expect( detectFacetDisplay( 'attr_color', [ 'Oliv', 'Sand' ], { colors: { Oliv: '#6f7a3a' } } ) ).toBe( 'list' );
	} );

	it( 'draws words, and words mixed with sizes, as a list', () => {
		expect( detectFacetDisplay( 'brand', [ 'Fjellmark', 'Maison Lune' ] ) ).toBe( 'list' );
		expect( detectFacetDisplay( 'attr_size', [ 'M', 'Einheitsgröße' ] ) ).toBe( 'list' );
	} );

	it( 'follows the display the site set, but never colours without colours', () => {
		expect( detectFacetDisplay( 'attr_size', [ 'S', 'M' ], { display: 'list' } ) ).toBe( 'list' );
		expect( detectFacetDisplay( 'brand', [ 'Acme' ], { display: 'tiles' } ) ).toBe( 'tiles' );
		expect( detectFacetDisplay( 'brand', [ 'Acme' ], { display: 'color' } ) ).toBe( 'list' );
	} );
} );

describe( 'parseAmount', () => {
	it( 'reads a number the way the shop writes it', () => {
		expect( parseAmount( '1.299,50', ',' ) ).toBe( '1299.5' );
		expect( parseAmount( '1,299.50', '.' ) ).toBe( '1299.5' );
		expect( parseAmount( '1.299', ',' ) ).toBe( '1299' );
		expect( parseAmount( '100 €', ',' ) ).toBe( '100' );
	} );

	it( 'takes the other separator as a decimal point when no group of three follows it', () => {
		expect( parseAmount( '12,5', '.' ) ).toBe( '12.5' );
		expect( parseAmount( '12.5', ',' ) ).toBe( '12.5' );
	} );

	it( 'is empty for text without a number', () => {
		expect( parseAmount( '', ',' ) ).toBe( '' );
		expect( parseAmount( 'abc', ',' ) ).toBe( '' );
	} );
} );

describe( 'filterButtonLabel', () => {
	it( 'is the name alone with nothing selected', () => {
		expect( filterButtonLabel( 'Farbe', [] ) ).toEqual( { text: 'Farbe', name: 'Farbe', value: '', more: 0, hidden: '' } );
	} );

	it( 'shows the first value and counts the rest, which the name reads out', () => {
		expect( filterButtonLabel( 'Farbe', [ 'Oliv' ] ) ).toMatchObject( { text: 'Farbe: Oliv', value: 'Oliv', more: 0, hidden: '' } );
		expect( filterButtonLabel( 'Farbe', [ 'Oliv', 'Schwarz', 'Grau' ] ) ).toMatchObject( { text: 'Farbe: Oliv', more: 2, hidden: ', Schwarz, Grau' } );
	} );

	it( 'shows a bound on either side or both', () => {
		const euro = ( value ) => `${ value } €`;

		expect( filterButtonLabel( 'Preis', [], { min: '50', max: '' }, euro ).text ).toBe( 'Preis: from 50 €' );
		expect( filterButtonLabel( 'Preis', [], { min: '', max: '200' }, euro ).text ).toBe( 'Preis: up to 200 €' );
		expect( filterButtonLabel( 'Preis', [], { min: '50', max: '200' }, euro ).text ).toBe( 'Preis: 50 € - 200 €' );
	} );
} );

describe( 'summarizeSelection and rangeLabel', () => {
	it( 'lists the values, or says the bound', () => {
		expect( summarizeSelection( [ 'Oliv' ] ) ).toBe( 'Oliv' );
		expect( summarizeSelection( [ 'Oliv', 'Schwarz' ] ) ).toBe( 'Oliv, Schwarz' );
		expect( summarizeSelection( [], { min: '100', max: '' } ) ).toBe( 'from 100' );
		expect( summarizeSelection( [] ) ).toBe( '' );
	} );

	it( 'is empty for a bound with neither side', () => {
		expect( rangeLabel( { min: '', max: '' } ) ).toBe( '' );
		expect( rangeLabel( undefined ) ).toBe( '' );
	} );
} );

describe( 'activeFilterCount', () => {
	it( 'counts every selected value and every bound', () => {
		expect( activeFilterCount( { attr_color: [ 'Oliv', 'Schwarz' ], brand: [] }, { price: { min: '50', max: '' }, rating: { min: '', max: '' } } ) ).toBe( 3 );
		expect( activeFilterCount( {}, {} ) ).toBe( 0 );
	} );
} );
