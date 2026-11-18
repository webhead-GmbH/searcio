/**
 * The delete of a repeated row: as tall as the fields beside it where the row is one line, and the compact
 * button where the row is a group on a phone, so that it fits on the line of the first field's label.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import RowRemove from './RowRemove';

// The package's own button does not load in Jest; what is asked of it is what is checked.
jest.mock( '@wordpress/components', () => {
	const { createElement } = require( '@wordpress/element' );

	return {
		Button: ( { label, onClick, size, __next40pxDefaultSize: tall } ) =>
			createElement( 'button', { type: 'button', 'aria-label': label, onClick, 'data-size': size || '', 'data-tall': String( Boolean( tall ) ) } ),
	};
} );

let container;
let root;

const mockScreen = ( phone ) => {
	window.matchMedia = ( query ) => ( {
		matches: phone && '(max-width: 600px)' === query,
		addEventListener: () => {},
		removeEventListener: () => {},
	} );
};

const render = ( onClick = () => {} ) => act( () => root.render( <RowRemove label="Remove field" onClick={ onClick } /> ) );

const button = () => container.querySelector( '.whsc-row-remove button' );

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
} );

describe( 'RowRemove', () => {
	it( 'is named by what it removes', async () => {
		mockScreen( false );
		await render();

		expect( button().getAttribute( 'aria-label' ) ).toBe( 'Remove field' );
	} );

	it( 'is the compact button on a phone, so it stays on the label\'s line', async () => {
		mockScreen( true );
		await render();

		expect( button().dataset.size ).toBe( 'compact' );
		expect( button().dataset.tall ).toBe( 'false' );
	} );

	it( 'is as tall as a field where the row is one line', async () => {
		mockScreen( false );
		await render();

		expect( button().dataset.size ).toBe( '' );
		expect( button().dataset.tall ).toBe( 'true' );
	} );

	it( 'removes on a click', async () => {
		mockScreen( true );

		const onClick = jest.fn();

		await render( onClick );
		await act( () => button().click() );

		expect( onClick ).toHaveBeenCalledTimes( 1 );
	} );
} );
