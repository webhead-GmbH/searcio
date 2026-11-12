/**
 * The excerpt of the built-in post card: cut at a word, marked with an
 * ellipsis when something was left out, and never split inside a character.
 */
import { renderToString } from '@wordpress/element';

jest.mock( '../../../utils/api', () => ( { getConfig: () => ( { i18n: {}, currency: {} } ) } ) );

// eslint-disable-next-line import/first -- must follow the jest.mock() call above.
import { ResultCard, trimExcerpt } from './templates';

// Character 120 is the "l" of "lining".
const LONG = 'Before you wash the backpack, empty each pocket first and open the zipper when the bag is dry, so that air reaches the lining and the seams.';

const withoutSegmenter = ( callback ) => {
	const { Segmenter } = Intl;

	delete Intl.Segmenter;

	try {
		callback();
	} finally {
		Intl.Segmenter = Segmenter;
	}
};

describe( 'trimExcerpt', () => {
	it( 'leaves a text that fits as it is', () => {
		expect( trimExcerpt( 'Open the zipper when the bag is dry.' ) ).toBe( 'Open the zipper when the bag is dry.' );
		expect( trimExcerpt( 'x'.repeat( 120 ) ) ).toBe( 'x'.repeat( 120 ) );
	} );

	it( 'ends a longer text at the last whole word, with an ellipsis', () => {
		expect( LONG.slice( 0, 120 ) ).toMatch( / l$/ );
		expect( trimExcerpt( LONG ) ).toBe(
			'Before you wash the backpack, empty each pocket first and open the zipper when the bag is dry, so that air reaches the…'
		);
	} );

	it( 'keeps the whole limit when it ends on a word', () => {
		expect( trimExcerpt( 'Open the zipper when dry', 15 ) ).toBe( 'Open the zipper…' );
	} );

	it( 'takes off a space, a comma or an opening bracket before the ellipsis', () => {
		expect( trimExcerpt( 'Wash it gently, with cold water', 16 ) ).toBe( 'Wash it gently…' );
		expect( trimExcerpt( 'Wash it gently (with cold water) and let it dry', 16 ) ).toBe( 'Wash it gently…' );
		expect( trimExcerpt( 'Wash it gently - with cold water', 16 ) ).toBe( 'Wash it gently…' );
	} );

	it( 'does not part a number', () => {
		expect( trimExcerpt( 'Price 1,299.00 EUR for the large model', 12 ) ).toBe( 'Price…' );
	} );

	it( 'counts a run of white space as the one space the browser draws', () => {
		expect( trimExcerpt( '  Open the\n\n  zipper\twhen dry.  ' ) ).toBe( 'Open the zipper when dry.' );
		// 138 characters as written, 114 as drawn.
		expect( trimExcerpt( 'word \n'.repeat( 23 ) ) ).toBe( 'word '.repeat( 23 ).trim() );
	} );

	it( 'has nothing to show for a text of white space or no text at all', () => {
		expect( trimExcerpt( ' \n\t ' ) ).toBe( '' );
		expect( trimExcerpt( undefined ) ).toBe( '' );
		expect( trimExcerpt( null ) ).toBe( '' );
	} );

	it( 'cuts a first word longer than the limit at the limit', () => {
		expect( trimExcerpt( 'a'.repeat( 200 ) ) ).toBe( `${ 'a'.repeat( 120 ) }…` );
	} );

	it( 'cuts right-to-left text at a space and puts the ellipsis at its end', () => {
		const text = 'این کیف چرمی می‌خواهد، با دقت نگهداری شود';

		// The zero-width non-joiner inside "می‌خواهد" joins one word.
		expect( trimExcerpt( text, 17 ) ).toBe( 'این کیف چرمی…' );
		// The Persian comma goes with the cut.
		expect( trimExcerpt( text, 21 ) ).toBe( 'این کیف چرمی می‌خواهد…' );
	} );

	it( 'never splits a surrogate pair', () => {
		const text = `a${ '😀'.repeat( 130 ) }`;

		// What the card used to show ended in half an emoji.
		expect( text.slice( 0, 120 ).isWellFormed() ).toBe( false );

		const excerpt = trimExcerpt( text );

		expect( excerpt.isWellFormed() ).toBe( true );
		expect( excerpt ).toBe( `a${ '😀'.repeat( 119 ) }…` );
	} );

	it( 'keeps a letter with its marks', () => {
		expect( trimExcerpt( 'e\u0301'.repeat( 130 ) ) ).toBe( `${ 'e\u0301'.repeat( 120 ) }…` );
	} );

	it( 'cuts at a space, and by code point, in a browser without Intl.Segmenter', () => {
		withoutSegmenter( () => {
			expect( typeof Intl.Segmenter ).toBe( 'undefined' );
			expect( trimExcerpt( LONG ) ).toBe(
				'Before you wash the backpack, empty each pocket first and open the zipper when the bag is dry, so that air reaches the…'
			);
			expect( trimExcerpt( 'Short.' ) ).toBe( 'Short.' );

			const excerpt = trimExcerpt( `a${ '😀'.repeat( 130 ) }` );

			expect( excerpt.isWellFormed() ).toBe( true );
			expect( excerpt ).toBe( `a${ '😀'.repeat( 119 ) }…` );
		} );
	} );
} );

describe( 'the post card', () => {
	const render = ( content ) =>
		renderToString( <ResultCard hit={ { source: { type: 'post', title: 'Care guide', url: '/care', content } } } /> );

	it( 'shows the excerpt cut at a word', () => {
		expect( render( LONG ) ).toContain(
			'<span class="whsc-card__excerpt">Before you wash the backpack, empty each pocket first and open the zipper when the bag is dry, so that air reaches the…</span>'
		);
	} );

	it( 'shows a short excerpt whole, without an ellipsis', () => {
		expect( render( 'Open the zipper when the bag is dry.' ) ).toContain(
			'<span class="whsc-card__excerpt">Open the zipper when the bag is dry.</span>'
		);
	} );

	it( 'leaves the excerpt out when the post has no text', () => {
		expect( render( '   ' ) ).not.toContain( 'whsc-card__excerpt' );
		expect( render( undefined ) ).not.toContain( 'whsc-card__excerpt' );
	} );
} );

/**
 * A page or a custom type drew a card with its title alone, and a post type
 * renamed in the Indexing tab ("artikel") lost its card's text too.
 */
describe( 'the card of any other type', () => {
	const render = ( hit ) => renderToString( <ResultCard hit={ hit } /> );

	it( 'shows the text of a page and of a custom type', () => {
		expect( render( { id: 'page-17', source: { type: 'page', title: 'Black Friday', content: 'All offers of the week.' } } ) )
			.toContain( '<span class="whsc-card__excerpt">All offers of the week.</span>' );
		expect( render( { id: 'ratgeber-4', source: { type: 'anleitung', title: 'Milchschaum', content: 'Mit Hafermilch.' } } ) )
			.toContain( '<span class="whsc-card__excerpt">Mit Hafermilch.</span>' );
	} );

	it( 'draws a renamed product type as a product, from the post type in its id', () => {
		expect( render( { id: 'product-12', source: { type: 'produkt', title: 'Jacke', price: 99 } } ) ).toContain( 'whsc-card--product' );
	} );
} );

describe( 'the price of a product card', () => {
	const render = ( source ) => renderToString( <ResultCard hit={ { id: 'product-3', source: { type: 'product', title: 'Parka', ...source } } } /> );

	// Every variation on sale showed "from 239" with nothing struck through.
	it( "strikes a variable product's regular price through when it is on sale", () => {
		const html = render( { product_type: 'variable', price: 239, price_min: 239, price_max: 279, on_sale: true, regular_price: 299, sale_price: 239 } );

		expect( html ).toContain( 'whsc-card__price-from' );
		expect( html ).toContain( '<del class="whsc-card__price-regular">299.00</del>' );
		expect( html ).toContain( '<span class="whsc-card__price-current">239.00</span>' );
	} );

	it( 'strikes nothing through for a variable product that is not on sale', () => {
		expect( render( { product_type: 'variable', price: 239, price_min: 239, price_max: 279, on_sale: false } ) ).not.toContain( '<del' );
	} );

	it( 'strikes nothing through when the regular price is not above the "from" price', () => {
		expect( render( { product_type: 'variable', price: 239, price_min: 239, price_max: 279, on_sale: true, regular_price: 239, sale_price: 239 } ) ).not.toContain( '<del' );
	} );

	it( "strikes a simple product's regular price through, as it did", () => {
		const html = render( { product_type: 'simple', price: 99, on_sale: true, regular_price: 149, sale_price: 99 } );

		expect( html ).toContain( '<del class="whsc-card__price-regular">149.00</del>' );
		expect( html ).toContain( '<ins class="whsc-card__price-current">99.00</ins>' );
	} );
} );

describe( 'the stock line of a product card', () => {
	const render = ( source ) => renderToString( <ResultCard hit={ { id: 'product-4', source: { type: 'product', title: 'Sandal', price: 40, ...source } } } /> );

	// A product on backorder read "In stock" in green.
	it( 'says a product on backorder is on backorder, not in stock', () => {
		const html = render( { in_stock: true, stock_status: 'onbackorder' } );

		expect( html ).toContain( 'is-on-backorder' );
		expect( html ).toContain( 'On backorder' );
		expect( html ).not.toContain( 'In stock' );
	} );

	it( 'says in stock and out of stock as it did', () => {
		expect( render( { in_stock: true, stock_status: 'instock' } ) ).toContain( 'In stock' );
		expect( render( { in_stock: false, stock_status: 'outofstock' } ) ).toContain( 'Out of stock' );
	} );
} );
