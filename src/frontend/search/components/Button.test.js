/**
 * The storefront's button. What matters most is what it does not carry: the
 * class of the package's button, which a theme may style with `!important`.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import Button from './Button';

// `@wordpress/components` loads packages that ship as ES modules only, which
// this suite does not run through Babel.
jest.mock( '@wordpress/components', () => ( {
	Icon: ( { icon } ) => <i data-icon={ icon } />,
	Tooltip: ( { text, children } ) => <span data-tooltip={ text }>{ children }</span>,
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
} );

const render = ( props ) => {
	act( () => root.render( <Button { ...props } /> ) );

	return container.querySelector( 'button' );
};

describe( 'Button', () => {
	it( 'does not carry the class themes style for WooCommerce\'s blocks', () => {
		const button = render( { className: 'whsc-voice-btn', icon: 'mic', label: 'Voice' } );

		expect( button.className ).toBe( 'whsc-control whsc-voice-btn' );
		expect( button.className ).not.toContain( 'components-' );
	} );

	it( 'is named by its label, draws its icon and does not submit a form', () => {
		const button = render( { icon: 'close', label: 'Close' } );

		expect( button.getAttribute( 'aria-label' ) ).toBe( 'Close' );
		expect( button.getAttribute( 'type' ) ).toBe( 'button' );
		expect( button.querySelector( 'i' ).getAttribute( 'data-icon' ) ).toBe( 'close' );
	} );

	it( 'submits when told to', () => {
		expect( render( { type: 'submit', label: 'Send' } ).getAttribute( 'type' ) ).toBe( 'submit' );
	} );

	it( 'says it is pressed, in its class and to a screen reader', () => {
		const button = render( { className: 'whsc-voice-btn', label: 'Voice', isPressed: true } );

		expect( button.classList.contains( 'is-pressed' ) ).toBe( true );
		expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
	} );

	it( 'is no toggle unless it is given a state', () => {
		expect( render( { label: 'Close' } ).hasAttribute( 'aria-pressed' ) ).toBe( false );
	} );

	it( 'hands on what it does not use itself', () => {
		const onClick = jest.fn();
		const button = render( { label: 'Close', disabled: true, onClick, title: 'Close' } );

		expect( button.disabled ).toBe( true );
		expect( button.getAttribute( 'title' ) ).toBe( 'Close' );
	} );

	it( 'shows a tooltip only when asked, and only with a label', () => {
		render( { label: 'Search' } );
		expect( container.querySelector( '[data-tooltip]' ) ).toBeNull();

		render( { label: 'Search', showTooltip: true } );
		expect( container.querySelector( '[data-tooltip]' ).getAttribute( 'data-tooltip' ) ).toBe( 'Search' );

		render( { showTooltip: true, children: 'Search' } );
		expect( container.querySelector( '[data-tooltip]' ) ).toBeNull();
	} );
} );
