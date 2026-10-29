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
