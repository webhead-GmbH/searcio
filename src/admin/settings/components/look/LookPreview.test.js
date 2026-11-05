/**
 * The preview's frame is empty until its page has loaded, which reads as
 * broken, so a placeholder stands over it until then: the first time, and
 * after each change that loads the page again. A change of the look is sent
 * into the page and loads nothing.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import LookPreview from './LookPreview';

jest.mock( '@wordpress/api-fetch', () => jest.fn( () => Promise.resolve( { css: '', fonts: '' } ) ) );

const PREVIEW = { url: 'https://shop.test/?searcio-preview=1', nonce: 'abc' };
const PLACEMENT = { search: { mode: 'icon', look: {} }, floating: { enabled: false } };

let container;
let root;

const render = ( placement ) => act( () => {
	root.render( <LookPreview preview={ PREVIEW } view="trigger" placement={ placement } title="Preview" /> );
} );

const frame = () => container.querySelector( 'iframe' );
const placeholder = () => container.querySelector( '[role="status"]' );
const load = () => act( () => {
	frame().dispatchEvent( new Event( 'load' ) );
} );

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	jest.useFakeTimers();
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	jest.useRealTimers();
	document.body.innerHTML = '';
} );

describe( 'LookPreview', () => {
	it( 'stands a named placeholder over the frame until its page has loaded', async () => {
		await render( PLACEMENT );

		expect( placeholder() ).not.toBeNull();
		expect( placeholder().getAttribute( 'aria-label' ) ).toBe( 'Loading the preview' );
		expect( frame().getAttribute( 'aria-busy' ) ).toBe( 'true' );

		await load();

		expect( placeholder() ).toBeNull();
		expect( frame().getAttribute( 'aria-busy' ) ).toBe( 'false' );
	} );

	it( 'stands it there again while a change loads the page again', async () => {
		await render( PLACEMENT );
		await load();

		await render( { ...PLACEMENT, search: { ...PLACEMENT.search, mode: 'box' } } );
		await act( () => jest.advanceTimersByTime( 500 ) );

		expect( frame().getAttribute( 'src' ) ).toContain( '%22box%22' );
		expect( placeholder() ).not.toBeNull();

		await load();

		expect( placeholder() ).toBeNull();
	} );

	it( 'loads nothing again, and shows no placeholder, for a change of the look', async () => {
		await render( PLACEMENT );
		await load();
		const src = frame().getAttribute( 'src' );

		await render( { ...PLACEMENT, search: { ...PLACEMENT.search, look: { modal: { background: '#ffffff' } } } } );
		await act( () => jest.advanceTimersByTime( 500 ) );

		expect( frame().getAttribute( 'src' ) ).toBe( src );
		expect( placeholder() ).toBeNull();
	} );
} );
