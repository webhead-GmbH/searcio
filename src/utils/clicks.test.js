import { openHandlers, positionInSearch } from './clicks';

describe( 'openHandlers', () => {
	it( 'reports a click, and a middle click, and no other button', () => {
		const onOpen = jest.fn();
		const { onClick, onAuxClick } = openHandlers( onOpen );

		onClick( { button: 0, ctrlKey: true } );
		onAuxClick( { button: 1 } );
		onAuxClick( { button: 2 } );

		expect( onOpen ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'gives a link nothing to listen with when nothing listens', () => {
		expect( openHandlers( undefined ) ).toEqual( {} );
	} );
} );

describe( 'positionInSearch', () => {
	const products = [
		{ id: 'a', search_id: 's1' },
		{ id: 'b', search_id: 's2' },
		{ id: 'c', search_id: 's1' },
		{ id: 'd', search_id: 's2' },
		{ id: 'e', search_id: 's1' },
	];

	it( 'counts the products of the clicked one\'s own search, in the order shown', () => {
		expect( positionInSearch( products, 0 ) ).toBe( 1 );
		expect( positionInSearch( products, 1 ) ).toBe( 1 );
		expect( positionInSearch( products, 2 ) ).toBe( 2 );
		expect( positionInSearch( products, 3 ) ).toBe( 2 );
		expect( positionInSearch( products, 4 ) ).toBe( 3 );
	} );
} );
