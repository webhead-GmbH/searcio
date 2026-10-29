import { hasMoreToScroll, trackScrollEnd } from './scrollEnd';

const row = ( { scrollWidth, clientWidth, scrollLeft = 0 } ) => {
	const element = document.createElement( 'div' );
	Object.defineProperty( element, 'scrollWidth', { configurable: true, value: scrollWidth } );
	Object.defineProperty( element, 'clientWidth', { configurable: true, value: clientWidth } );
	element.scrollLeft = scrollLeft;

	return element;
};

describe( 'hasMoreToScroll', () => {
	it( 'is true while the row holds more than it shows past its end', () => {
		expect( hasMoreToScroll( { scrollWidth: 400, clientWidth: 240, scrollLeft: 0 } ) ).toBe( true );
	} );

	it( 'is false once the row is scrolled to its end', () => {
		expect( hasMoreToScroll( { scrollWidth: 400, clientWidth: 240, scrollLeft: 160 } ) ).toBe( false );
	} );

	it( 'is false for a row that fits, and for a few pixels of rounding', () => {
		expect( hasMoreToScroll( { scrollWidth: 240, clientWidth: 240, scrollLeft: 0 } ) ).toBe( false );
		expect( hasMoreToScroll( { scrollWidth: 243, clientWidth: 240, scrollLeft: 0 } ) ).toBe( false );
	} );

	it( 'reads a right-to-left row, whose scrollLeft counts down from 0', () => {
		expect( hasMoreToScroll( { scrollWidth: 400, clientWidth: 240, scrollLeft: -40 } ) ).toBe( true );
		expect( hasMoreToScroll( { scrollWidth: 400, clientWidth: 240, scrollLeft: -160 } ) ).toBe( false );
	} );
} );

describe( 'trackScrollEnd', () => {
	it( 'sets has-more at once and follows the scroll', () => {
		const element = row( { scrollWidth: 400, clientWidth: 240 } );
		const stop = trackScrollEnd( element );

		expect( element.classList.contains( 'has-more' ) ).toBe( true );

		element.scrollLeft = 160;
		element.dispatchEvent( new Event( 'scroll' ) );
		expect( element.classList.contains( 'has-more' ) ).toBe( false );

		stop();
		element.scrollLeft = 0;
		element.dispatchEvent( new Event( 'scroll' ) );
		expect( element.classList.contains( 'has-more' ) ).toBe( false );
	} );

	it( 'does nothing without a row', () => {
		expect( () => trackScrollEnd( null )() ).not.toThrow();
	} );
} );
