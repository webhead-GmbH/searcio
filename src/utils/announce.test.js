/**
 * What a screen reader hears of a notice: its words once, as it appears, and
 * nothing of what the screen opened with.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import { speak } from '@wordpress/a11y';

import { useAnnounce } from './announce';

jest.mock( '@wordpress/a11y', () => ( { speak: jest.fn() } ) );

const Announcer = ( { message, politeness } ) => {
	useAnnounce( message, politeness );

	return null;
};

let container;
let root;

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	speak.mockClear();
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
} );

const render = ( message, politeness ) => act( () => root.render(
	<Announcer message={ message } politeness={ politeness } />
) );

describe( 'useAnnounce', () => {
	it( 'says nothing of what the screen opened with', () => {
		render( 'The settings could not be loaded.' );

		expect( speak ).not.toHaveBeenCalled();
	} );

	it( 'reads a message out once as it appears, politely unless told otherwise', () => {
		render( '' );
		render( 'Connected.' );
		render( 'Connected.' );

		expect( speak ).toHaveBeenCalledTimes( 1 );
		expect( speak ).toHaveBeenCalledWith( 'Connected.', 'polite' );
	} );

	it( 'reads a failure out assertively when it is told to', () => {
		render( '', 'assertive' );
		render( 'The save failed.', 'assertive' );

		expect( speak ).toHaveBeenCalledWith( 'The save failed.', 'assertive' );
	} );

	it( 'says nothing as a message goes, and reads it again when it comes back', () => {
		render( '' );
		render( 'The save failed.' );
		render( '' );

		expect( speak ).toHaveBeenCalledTimes( 1 );

		render( 'The save failed.' );

		expect( speak ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'reads nothing that is not a text', () => {
		render( '' );
		render( null );
		render( undefined );

		expect( speak ).not.toHaveBeenCalled();
	} );
} );
