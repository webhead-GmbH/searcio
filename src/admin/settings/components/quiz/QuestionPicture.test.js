/**
 * A question's picture is picked in the WordPress Media Library. The library
 * is WordPress's own frame; what is pinned is what the editor does with the
 * picture picked there, and that it asks for the library when it is clicked:
 * the editor drew before the library was replaced here, and a reference taken
 * then opened the real one in the browser suite.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import QuestionPicture from './QuestionPicture';

// `@wordpress/components` loads packages that ship as ES modules only, which
// this suite does not run through Babel. The picture takes only a button from it.
jest.mock( '@wordpress/components', () => ( {
	Button: ( { children, onClick } ) => <button type="button" onClick={ onClick }>{ children }</button>,
} ) );

let container;
let root;

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	delete window.wp;
} );

/** A Media Library frame that hands `attachment` over when it is opened. */
const library = ( attachment ) => jest.fn( () => {
	const handlers = {};
	const frame = {
		on: ( event, handler ) => {
			handlers[ event ] = handler;

			return frame;
		},
		open: () => handlers.select?.(),
		state: () => ( { get: () => ( { first: () => ( { toJSON: () => attachment } ) } ) } ),
	};

	return frame;
} );

const button = ( label ) => [ ...container.querySelectorAll( 'button' ) ].find( ( item ) => item.textContent === label );

describe( 'QuestionPicture', () => {
	it( 'takes the large size of the picture picked, from the library as it is when clicked', () => {
		const onChange = jest.fn();

		window.wp = { media: library( { url: 'https://shop.test/stale.jpg' } ) };
		act( () => root.render( <QuestionPicture value="" onChange={ onChange } /> ) );

		// The library the page has by the time it is asked for.
		window.wp.media = library( { url: 'https://shop.test/full.jpg', sizes: { large: { url: 'https://shop.test/large.jpg' } } } );
		act( () => button( 'Choose a picture' ).click() );

		expect( onChange ).toHaveBeenCalledWith( 'https://shop.test/large.jpg' );
	} );

	it( 'shows the picture with a way to replace or remove it', () => {
		const onChange = jest.fn();

		window.wp = { media: library( {} ) };
		act( () => root.render( <QuestionPicture value="https://shop.test/large.jpg" onChange={ onChange } /> ) );

		expect( container.querySelector( 'img' ).getAttribute( 'src' ) ).toBe( 'https://shop.test/large.jpg' );
		expect( button( 'Replace' ) ).toBeDefined();

		act( () => button( 'Remove' ).click() );
		expect( onChange ).toHaveBeenCalledWith( '' );
	} );

	it( 'flags a picture that is not on https, which Searcio refuses', () => {
		window.wp = { media: library( {} ) };
		act( () => root.render( <QuestionPicture value="http://shop.test/large.jpg" onChange={ () => {} } /> ) );

		expect( container.textContent ).toContain( 'served over https' );
	} );

	it( 'asks for the address where the page has no Media Library', () => {
		act( () => root.render( <QuestionPicture value="" onChange={ () => {} } /> ) );

		expect( container.querySelector( 'input[type="url"]' ) ).not.toBeNull();
		expect( button( 'Choose a picture' ) ).toBeUndefined();
	} );
} );
