/**
 * The floating search button stood over a store notice fixed to the bottom of
 * the screen, its text and its close button.
 */
import { bottomBarHeight } from './bottomBars';

const box = ( position, top, height ) => {
	const element = document.createElement( 'div' );

	element.style.position = position;
	element.getBoundingClientRect = () => ( { top, bottom: top + height, height, left: 0, width: 400 } );
	document.body.appendChild( element );

	return element;
};

afterEach( () => {
	document.body.innerHTML = '';
	delete document.elementsFromPoint;
} );

describe( 'bottomBarHeight', () => {
	beforeEach( () => {
		window.innerHeight = 800;
	} );

	it( 'is the height of a bar fixed to the bottom under the point', () => {
		const bar = box( 'fixed', 752, 48 );
		const text = document.createElement( 'span' );

		bar.appendChild( text );
		document.elementsFromPoint = () => [ text, bar, document.body ];

		expect( bottomBarHeight( 300 ) ).toBe( 48 );
	} );

	it( 'is nothing for an overlay as tall as half the screen, a static element or the button itself', () => {
		const overlay = box( 'fixed', 0, 800 );
		const page = box( 'static', 0, 2000 );
		const own = box( 'fixed', 700, 56 );

		document.elementsFromPoint = () => [ own, overlay, page, document.body ];

		expect( bottomBarHeight( 300, own ) ).toBe( 0 );
	} );

	it( 'is nothing where the browser cannot say what is at a point', () => {
		expect( bottomBarHeight( 300 ) ).toBe( 0 );
	} );
} );
