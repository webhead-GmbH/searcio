/**
 * The Search Config tab's field suggestions and its "not indexed" warning both
 * read the server's `indexed_fields` list. These pin that the tab neither adds
 * names of its own nor drops the ones the indexer reports.
 */

import { indexedFields, unindexedFields } from './indexedFields';

describe( 'indexedFields', () => {
	it( 'reads the list the catalog reports, in its order', () => {
		const catalog = {
			indexed_fields: [ 'title', 'content', 'type', 'categories', 'product_tags', 'in_stock', 'attr_color' ],
		};

		expect( indexedFields( catalog ) ).toEqual( [
			'title',
			'content',
			'type',
			'categories',
			'product_tags',
			'in_stock',
			'attr_color',
		] );
	} );

	/** Nothing the indexer does not write may be suggested - `tags` was. */
	it( 'adds no field names of its own', () => {
		expect( indexedFields( { indexed_fields: [ 'title' ] } ) ).toEqual( [ 'title' ] );
		expect( indexedFields( { indexed_fields: [] } ) ).toEqual( [] );
	} );

	it( 'drops duplicates, blanks and anything that is not a name', () => {
		expect( indexedFields( { indexed_fields: [ 'title', 'title', '', null, 3, 'sku' ] } ) ).toEqual( [ 'title', 'sku' ] );
	} );

	it( 'is unknown, not empty, when the catalog does not say', () => {
		expect( indexedFields( null ) ).toBeNull();
		expect( indexedFields( {} ) ).toBeNull();
		expect( indexedFields( { indexed_fields: 'title' } ) ).toBeNull();
	} );
} );

describe( 'unindexedFields', () => {
	const indexed = [ 'title', 'content', 'type', 'categories', 'product_tags', 'price' ];

	/** The dev-site failure: a facet on `category` when the indexer writes `categories`. */
	it( 'names a configured field no document has', () => {
		expect( unindexedFields( [ 'category' ], indexed ) ).toEqual( [ 'category' ] );
		expect( unindexedFields( [ 'tags', 'price' ], indexed ) ).toEqual( [ 'tags' ] );
	} );

	it( 'is empty when every configured field is indexed', () => {
		expect( unindexedFields( [ 'categories', 'product_tags', 'price' ], indexed ) ).toEqual( [] );
		expect( unindexedFields( [], indexed ) ).toEqual( [] );
	} );

	it( 'keeps the configured order and reports each name once', () => {
		expect( unindexedFields( [ 'brand', 'category', 'brand', 'title' ], indexed ) ).toEqual( [ 'brand', 'category' ] );
	} );

	it( 'ignores blank entries and compares trimmed names', () => {
		expect( unindexedFields( [ '', '  ', ' title ', ' brand ' ], indexed ) ).toEqual( [ 'brand' ] );
	} );

	/** An unreadable catalog must not flag every configured field. */
	it( 'warns about nothing while the indexed fields are unknown', () => {
		expect( unindexedFields( [ 'category' ], null ) ).toEqual( [] );
		expect( unindexedFields( undefined, indexed ) ).toEqual( [] );
	} );

	it( 'flags every configured field when nothing is indexed at all', () => {
		expect( unindexedFields( [ 'title', 'price' ], [] ) ).toEqual( [ 'title', 'price' ] );
	} );
} );
