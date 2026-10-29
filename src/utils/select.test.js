/**
 * What a `SelectControl` of `@wordpress/ui` is given for a choice kept as a
 * string, and what is kept of the item it hands back.
 */
import { selectProps } from './select';

const NOTHING = { value: null, label: '- Do not send -' };
const TITLE = { value: 'post_title', label: 'Title' };
const BRAND = { value: 'taxonomy:product_brand', label: 'Taxonomy: Brands' };
const ITEMS = [ NOTHING, TITLE, BRAND ];

describe( 'selectProps', () => {
	it( 'draws the items it is given', () => {
		expect( selectProps( ITEMS, 'post_title', () => {} ).items ).toBe( ITEMS );
	} );

	it( 'marks the item the stored string names, as one of the items drawn', () => {
		expect( selectProps( ITEMS, 'taxonomy:product_brand', () => {} ).value ).toBe( BRAND );
	} );

	it( 'marks the item whose value is null for an empty or missing choice', () => {
		expect( selectProps( ITEMS, '', () => {} ).value ).toBe( NOTHING );
		expect( selectProps( ITEMS, undefined, () => {} ).value ).toBe( NOTHING );
		expect( selectProps( ITEMS, null, () => {} ).value ).toBe( NOTHING );
	} );

	it( 'marks nothing when no item stands for the stored choice', () => {
		expect( selectProps( [ TITLE, BRAND ], '', () => {} ).value ).toBeNull();
		expect( selectProps( ITEMS, 'taxonomy:gone', () => {} ).value ).toBeNull();
	} );

	it( 'hands on the value of the item picked, not the item', () => {
		const onChange = jest.fn();
		const { onValueChange } = selectProps( ITEMS, 'post_title', onChange );

		onValueChange( BRAND );
		onValueChange( NOTHING );
		onValueChange( null );

		expect( onChange.mock.calls ).toEqual( [ [ 'taxonomy:product_brand' ], [ null ], [ null ] ] );
	} );
} );
