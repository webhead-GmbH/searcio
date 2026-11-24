/**
 * Which rows a comparison of the assistant's products has. The Compare button
 * is offered only when there is at least one: products carrying nothing but a
 * title, link, image and price used to open a table with a header and no body.
 */
import { renderToString } from '@wordpress/element';

let mockConfig = {};

jest.mock( '../../../utils/api', () => ( { getConfig: () => mockConfig } ) );

const { default: CompareTable, comparisonRows } = require( './CompareTable' );

const product = ( id, source ) => ( { id, source: { title: `Product ${ id }`, url: `https://example.test/${ id }`, ...source } } );

beforeEach( () => {
	mockConfig = {};
} );

describe( 'comparisonRows', () => {
	it( 'has nothing to compare when products carry only what the header shows', () => {
		expect(
			comparisonRows( [
				product( 'a', { image: 'a.jpg', price: 10, type: 'product', in_stock: true } ),
				product( 'b', { image: 'b.jpg', price: 12, type: 'product', in_stock: false } ),
			] )
		).toEqual( [] );
	} );

	// "Ai tags" in English on a German shop, a second category row of paths,
	// and "Featured: Yes" were rows a shopper could make nothing of.
	it( 'leaves out the photo tags, the category paths and the featured flag', () => {
		expect(
			comparisonRows( [
				product( 'a', { ai_tags: [ 'handbag' ], category_paths: [ 'Bags' ], featured: true, material: 'Leather' } ),
				product( 'b', { ai_tags: [ 'purse' ], category_paths: [ 'Bags > Totes' ], featured: false, material: 'Canvas' } ),
			] )
		).toEqual( [ 'material' ] );
	} );

	it( 'leads with the rows that differ, then sorts by label', () => {
		expect(
			comparisonRows( [
				product( 'a', { material: 'Cotton', brand: 'Acme', color: 'Red' } ),
				product( 'b', { material: 'Cotton', brand: 'Acme', color: 'Blue' } ),
			] )
		).toEqual( [ 'color', 'brand', 'material' ] );
	} );

	it( 'shows an attribute indexed twice as one row', () => {
		expect(
			comparisonRows( [
				product( 'a', { color: 'Red', attr_color: 'Red' } ),
				product( 'b', { color: 'Blue', attr_color: 'Blue' } ),
			] )
		).toEqual( [ 'color' ] );
	} );

	it( 'does not count two spellings of the same flag as a difference', () => {
		expect(
			comparisonRows( [
				product( 'a', { virtual: '1', brand: 'Acme' } ),
				product( 'b', { virtual: true, brand: 'Other' } ),
			] )
		).toEqual( [ 'brand', 'virtual' ] );
	} );

	// The raw timestamp of the "newest" sort, and "Kategorie" beside "Kategorien".
	it( 'leaves out the publication timestamp, and a field beside its own plural', () => {
		expect(
			comparisonRows( [
				product( 'a', { published_at: '2026-11-11T11:34:17Z', category: 'Bags', categories: [ 'Bags', 'Shop' ], material: 'Leather' } ),
				product( 'b', { published_at: '2026-11-12T08:00:00Z', category: 'Totes', categories: [ 'Totes', 'Shop' ], material: 'Canvas' } ),
			] )
		).toEqual( [ 'categories', 'material' ] );
	} );

	it( 'includes a field only some of the products have', () => {
		expect(
			comparisonRows( [
				product( 'a', { size: 'M' } ),
				product( 'b', {} ),
			] )
		).toEqual( [ 'size' ] );
	} );
} );

/**
 * The site's own names for its fields (`fieldLabels` of the storefront
 * config): a German shop's rows read "Farbe" and "Marke", not "Color" and
 * "Brand".
 */
describe( 'comparison rows with the site\'s own field names', () => {
	const labels = { attr_size: 'Größe', brand: 'Marke', attr_color: 'Farbe' };

	it( 'sorts by the name the site gives a field', () => {
		expect(
			comparisonRows(
				[
					product( 'a', { attr_size: 'M', brand: 'Acme' } ),
					product( 'b', { attr_size: 'L', brand: 'Other' } ),
				],
				labels
			)
		).toEqual( [ 'attr_size', 'brand' ] );
	} );

	it( 'keeps the attribute the site names when it is indexed twice', () => {
		expect(
			comparisonRows(
				[
					product( 'a', { color: 'Red', attr_color: 'Red' } ),
					product( 'b', { color: 'Blue', attr_color: 'Blue' } ),
				],
				labels
			)
		).toEqual( [ 'attr_color' ] );
	} );

	it( 'reads the names from the storefront config by default', () => {
		mockConfig = { fieldLabels: labels };

		expect(
			comparisonRows( [
				product( 'a', { attr_size: 'M', brand: 'Acme' } ),
				product( 'b', { attr_size: 'L', brand: 'Other' } ),
			] )
		).toEqual( [ 'attr_size', 'brand' ] );
	} );

	it( 'heads each row with that name', () => {
		mockConfig = { fieldLabels: labels };

		const html = renderToString(
			<CompareTable
				products={ [
					product( 'a', { attr_color: 'Red', brand: 'Acme' } ),
					product( 'b', { attr_color: 'Blue', brand: 'Other' } ),
				] }
			/>
		);

		expect( html ).toContain( '<th scope="row" class="whsc-compare__label">Farbe</th>' );
		expect( html ).toContain( '<th scope="row" class="whsc-compare__label">Marke</th>' );
		expect( html ).not.toContain( '>Color<' );
	} );
} );

/**
 * Twelve products were twelve columns: 1692px of table in a 343px window.
 */
describe( 'a comparison of many products', () => {
	const many = Array.from( { length: 7 }, ( _, index ) => product( `p${ index + 1 }`, { brand: `Brand ${ index + 1 }` } ) );

	it( 'compares the first four, and says so', () => {
		const html = renderToString( <CompareTable products={ many } /> );

		expect( ( html.match( /<th scope="col">/g ) || [] ).length ).toBe( 4 );
		expect( html ).toContain( 'Brand 4' );
		expect( html ).not.toContain( 'Brand 5' );
		expect( html ).toContain( 'The first 4 of the 7 products are compared.' );
	} );

	it( 'says nothing when all of them fit', () => {
		const html = renderToString( <CompareTable products={ many.slice( 0, 3 ) } /> );

		expect( html ).not.toContain( 'whsc-compare__note' );
	} );
} );

/**
 * What a comparison of the demo shop's products showed: a row of
 * "[object Object], [object Object]" for the variations, "Rating: 0" for a
 * product nobody has reviewed, and one fact under two names.
 */
describe( 'rows that read', () => {
	it( 'has no row for a list of objects, such as the variations', () => {
		const variants = [ { in_stock: true, attr_color: 'Red' }, { in_stock: false, attr_color: 'Blue' } ];
		const products = [
			product( 'a', { variants, material: 'Cotton', layers: [ { name: 'Shell' } ] } ),
			product( 'b', { variants, material: 'Wool', layers: [ { name: 'Fleece' } ] } ),
		];

		// `variants` is named as bookkeeping, and `layers` is a structure no rule has met: neither is a row.
		expect( comparisonRows( products ) ).toEqual( [ 'material' ] );
		expect( renderToString( <CompareTable products={ products } /> ) ).not.toContain( '[object Object]' );
	} );

	it( 'shows a rating of 0 as no rating', () => {
		const html = renderToString(
			<CompareTable products={ [ product( 'a', { rating: 4.5 } ), product( 'b', { rating: 0 } ), product( 'c', { average_rating: '0.00' } ) ] } />
		);

		expect( html ).toContain( '4.5' );
		expect( html ).not.toMatch( /<td>0<\/td>/ );
		expect( html ).toContain( '<td> - </td>' );
	} );

	it( 'has no row that nobody has a value in', () => {
		expect( comparisonRows( [ product( 'a', { rating: 0, material: 'Cotton' } ), product( 'b', { rating: 0, material: 'Wool' } ) ] ) ).toEqual( [ 'material' ] );
	} );

	it( 'draws one row for two fields that say the same thing under two names', () => {
		expect(
			comparisonRows( [
				product( 'a', { maker: 'Acme', manufacturer: 'Acme', material: 'Cotton' } ),
				product( 'b', { maker: 'Bolt', manufacturer: 'Bolt', material: 'Wool' } ),
			] )
		).toEqual( [ 'maker', 'material' ] );
	} );

	it( 'keeps two fields that differ, even when one product says the same in both', () => {
		expect(
			comparisonRows( [
				product( 'a', { maker: 'Acme', manufacturer: 'Acme' } ),
				product( 'b', { maker: 'Bolt', manufacturer: 'Bolt Ltd' } ),
			] )
		).toEqual( [ 'maker', 'manufacturer' ] );
	} );

	it( 'keeps two flags that are both the same for every product', () => {
		expect(
			comparisonRows( [
				product( 'a', { virtual: false, downloadable: false, material: 'Cotton' } ),
				product( 'b', { virtual: false, downloadable: false, material: 'Wool' } ),
			] )
		).toEqual( [ 'material', 'downloadable', 'virtual' ] );
	} );
} );

