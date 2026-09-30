/**
 * Which rows a comparison of the assistant's products has. The Compare button
 * is offered only when there is at least one: products carrying nothing but a
 * title, link, image and price used to open a table with a header and no body.
 */
import { comparisonRows } from './CompareTable';

const product = ( id, source ) => ( { id, source: { title: `Product ${ id }`, url: `https://example.test/${ id }`, ...source } } );

describe( 'comparisonRows', () => {
	it( 'has nothing to compare when products carry only what the header shows', () => {
		expect(
			comparisonRows( [
				product( 'a', { image: 'a.jpg', price: 10, type: 'product', in_stock: true } ),
				product( 'b', { image: 'b.jpg', price: 12, type: 'product', in_stock: false } ),
			] )
		).toEqual( [] );
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
				product( 'a', { featured: '1', brand: 'Acme' } ),
				product( 'b', { featured: true, brand: 'Other' } ),
			] )
		).toEqual( [ 'brand', 'featured' ] );
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
