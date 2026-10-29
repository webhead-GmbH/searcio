/**
 * Two bounds for a numeric facet field. A field the site names itself
 * (`fieldLabels` of the storefront config) is announced by that name. A bound
 * applies on Enter at once, 700ms after typing stops, and when the field is
 * left; a lower bound above the upper one swaps the two; and what is typed is
 * read the way the shop writes numbers.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` wraps this React and does not pass `act` on.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import PriceRange from './PriceRange';

let container;
let root;
let applied;

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	jest.useFakeTimers();
	applied = [];
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	jest.useRealTimers();
} );

const render = ( props = {} ) => act( () => root.render(
	<PriceRange
		field="price"
		label="Preis"
		span={ { min: 99, max: 249 } }
		active={ {} }
		onApply={ ( field, bound ) => applied.push( [ field, bound ] ) }
		decimalSep=","
		format={ ( value ) => `${ value } €` }
		{ ...props }
	/>
) );

const field = ( name ) => container.querySelector( `input[aria-label="${ name }"]` );

const type = ( input, value ) => act( () => {
	Object.getOwnPropertyDescriptor( window.HTMLInputElement.prototype, 'value' ).set.call( input, value );
	input.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
} );

describe( 'PriceRange', () => {
	it( 'names its fields by the field the site names, and says what its placeholders are', () => {
		render( { label: 'Breite' } );

		const min = field( 'Minimum Breite' );

		expect( min ).not.toBeNull();
		expect( field( 'Maximum Breite' ) ).not.toBeNull();
		expect( min.type ).toBe( 'text' );
		expect( min.getAttribute( 'inputmode' ) ).toBe( 'decimal' );
		expect( min.placeholder ).toBe( '99' );
		expect( document.getElementById( min.getAttribute( 'aria-describedby' ) ).textContent ).toBe( 'Range of the loaded results: 99 € to 249 €' );
	} );

	it( 'applies 700ms after typing stops, as the shop writes the number', () => {
		render();
		type( field( 'Minimum Preis' ), '1.299,50' );

		act( () => jest.advanceTimersByTime( 600 ) );
		expect( applied ).toEqual( [] );

		act( () => jest.advanceTimersByTime( 100 ) );
		expect( applied ).toEqual( [ [ 'price', { min: '1299.5', max: '' } ] ] );
	} );

	it( 'applies at once on Enter', () => {
		render();
		type( field( 'Minimum Preis' ), '100' );

		act( () => field( 'Minimum Preis' ).dispatchEvent( new window.KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true } ) ) );

		expect( applied ).toEqual( [ [ 'price', { min: '100', max: '' } ] ] );
	} );

	it( 'swaps a lower bound above the upper one', () => {
		render();
		type( field( 'Minimum Preis' ), '200' );
		type( field( 'Maximum Preis' ), '50' );

		act( () => jest.advanceTimersByTime( 700 ) );

		expect( applied ).toEqual( [ [ 'price', { min: '50', max: '200' } ] ] );
		expect( field( 'Minimum Preis' ).value ).toBe( '50' );
		expect( field( 'Maximum Preis' ).value ).toBe( '200' );
	} );

	it( 'empties its field when the bound is taken away elsewhere', () => {
		render( { active: { min: '100', max: '' } } );
		expect( field( 'Minimum Preis' ).value ).toBe( '100' );

		render( { active: {} } );
		expect( field( 'Minimum Preis' ).value ).toBe( '' );
	} );
} );
