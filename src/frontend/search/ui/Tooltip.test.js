/**
 * The tooltip of an icon button: when it opens, when it closes, what it says
 * to a screen reader, and what it leaves alone.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import Tooltip from './Tooltip';

let container;
let root;

beforeEach( () => {
	jest.useFakeTimers();
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	document.querySelectorAll( '.whsc-tooltip-layer' ).forEach( ( layer ) => layer.remove() );
	jest.useRealTimers();
} );

const render = ( props = {}, buttonProps = {} ) => {
	act( () => root.render(
		<Tooltip text="Close" { ...props }>
			<button type="button" aria-label="Close" { ...buttonProps }>x</button>
		</Tooltip>
	) );

	return container.querySelector( 'button' );
};

const tooltip = () => document.querySelector( '[role="tooltip"]' );

// React derives pointerenter from pointerover and pointerout, with the pointer type of that event.
const enter = ( button, pointerType = 'mouse' ) => {
	const event = new MouseEvent( 'pointerover', { bubbles: true, relatedTarget: document.body } );

	Object.defineProperty( event, 'pointerType', { value: pointerType } );
	act( () => {
		button.dispatchEvent( event );
	} );
};

const leave = ( button ) => {
	const event = new MouseEvent( 'pointerout', { bubbles: true, relatedTarget: document.body } );

	Object.defineProperty( event, 'pointerType', { value: 'mouse' } );
	act( () => {
		button.dispatchEvent( event );
	} );
};

describe( 'Tooltip', () => {
	it( 'draws the button and nothing else until it is asked for', () => {
		render();

		expect( container.querySelectorAll( 'button' ) ).toHaveLength( 1 );
		expect( tooltip() ).toBeNull();
	} );

	it( 'opens when a mouse has rested on the button for 700 ms, not before', () => {
		const button = render();

		enter( button );
		act( () => jest.advanceTimersByTime( 699 ) );

		expect( tooltip() ).toBeNull();

		act( () => jest.advanceTimersByTime( 1 ) );

		expect( tooltip().textContent ).toBe( 'Close' );
		expect( tooltip().classList.contains( 'components-tooltip' ) ).toBe( true );
	} );

	it( 'is drawn in a layer of its own that the stylesheet knows as an overlay of the storefront', () => {
		const button = render();

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );

		const layer = tooltip().closest( '.whsc-tooltip-layer' );

		expect( layer ).not.toBeNull();
		expect( layer.hasAttribute( 'data-webhead-frontend-overlay' ) ).toBe( true );
		expect( layer.parentElement ).toBe( document.body );
		expect( document.querySelectorAll( '.whsc-tooltip-layer' ) ).toHaveLength( 1 );
	} );

	it( 'is not opened by a touch', () => {
		const button = render();

		enter( button, 'touch' );
		act( () => jest.advanceTimersByTime( 2000 ) );

		expect( tooltip() ).toBeNull();
	} );

	it( 'closes when the pointer leaves, and a leave before the delay cancels the opening', () => {
		const button = render();

		enter( button );
		act( () => jest.advanceTimersByTime( 300 ) );
		leave( button );
		act( () => jest.advanceTimersByTime( 1000 ) );

		expect( tooltip() ).toBeNull();

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );

		expect( tooltip() ).not.toBeNull();

		leave( button );

		expect( tooltip() ).toBeNull();
	} );

	it( 'closes on Escape and on a click', () => {
		const button = render();

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );
		act( () => {
			button.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } ) );
		} );

		expect( tooltip() ).toBeNull();

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );
		act( () => button.click() );

		expect( tooltip() ).toBeNull();
	} );

	it( 'leaves what the button does with the same events alone', () => {
		const onClick = jest.fn();
		const onKeyDown = jest.fn();
		const button = render( {}, { onClick, onKeyDown } );

		act( () => button.click() );
		act( () => {
			button.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'a', bubbles: true } ) );
		} );

		expect( onClick ).toHaveBeenCalledTimes( 1 );
		expect( onKeyDown ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not say twice what the label says, and describes the button when it says more', () => {
		const labelled = render();

		enter( labelled );
		act( () => jest.advanceTimersByTime( 700 ) );

		expect( labelled.hasAttribute( 'aria-describedby' ) ).toBe( false );

		leave( labelled );

		const other = render( { text: 'Clears the search' } );

		enter( other );
		act( () => jest.advanceTimersByTime( 700 ) );

		expect( other.getAttribute( 'aria-describedby' ) ).toBe( tooltip().id );
	} );

	it( 'does not open for a button with nothing to say', () => {
		const button = render( { text: '' } );

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );

		expect( tooltip() ).toBeNull();
	} );

	it( 'stays inside the window and goes below a button that has no room above it', () => {
		const button = render();

		button.getBoundingClientRect = () => ( { top: 2, bottom: 30, left: 0, right: 28, width: 28, height: 28 } );
		Object.defineProperty( document.documentElement, 'clientWidth', { configurable: true, value: 320 } );

		const original = HTMLElement.prototype.getBoundingClientRect;

		HTMLElement.prototype.getBoundingClientRect = function box() {
			return this.getAttribute( 'role' ) === 'tooltip'
				? { top: 0, bottom: 24, left: 0, right: 60, width: 60, height: 24 }
				: original.call( this );
		};

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );

		const style = tooltip().style;

		HTMLElement.prototype.getBoundingClientRect = original;

		expect( style.visibility ).toBe( 'visible' );
		// Not above: the button is two pixels from the top. Below it, with the gap.
		expect( parseFloat( style.top ) ).toBe( 34 );
		// Centred on a button at the left edge would leave the window: held at its edge.
		expect( parseFloat( style.left ) ).toBeGreaterThanOrEqual( 0 );
	} );

	it( 'takes its text from the latest render', () => {
		const button = render();

		enter( button );
		act( () => jest.advanceTimersByTime( 700 ) );

		render( { text: 'Closed now' } );

		expect( tooltip().textContent ).toBe( 'Closed now' );
	} );
} );
