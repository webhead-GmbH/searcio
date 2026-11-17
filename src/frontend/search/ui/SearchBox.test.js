/**
 * The box a trigger shows in the page. What matters is what the stylesheet
 * (which draws what the package's `SearchControl` used to draw) finds in it.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import SearchBox from './SearchBox';

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
	act( () => root.render( <SearchBox value="" onChange={ () => {} } { ...props } /> ) );

	return container.querySelector( 'input' );
};

describe( 'SearchBox', () => {
	it( 'is a search field with the classes the stylesheet draws it by', () => {
		render( { className: 'whsc-trigger-box' } );

		const field = container.firstElementChild;

		expect( field.classList.contains( 'components-search-control' ) ).toBe( true );
		expect( field.classList.contains( 'whsc-trigger-box' ) ).toBe( true );
		expect( container.querySelector( '.components-input-control__container' ) ).not.toBeNull();
		expect( container.querySelector( '.components-input-control__backdrop' ) ).not.toBeNull();
	} );

	it( 'puts a solid magnifier before the field', () => {
		render();

		const svg = container.querySelector( '.components-input-control__prefix svg' );

		expect( svg ).not.toBeNull();
		expect( svg.getAttribute( 'fill' ) ).toBe( 'currentColor' );
		// Painted by `fill`: a `stroke` or a `fill: none` would draw nothing in the stylesheet.
		expect( svg.style.fill ).toBe( '' );
		expect( svg.getAttribute( 'stroke' ) ).toBeNull();
	} );

	it( 'names the field for a screen reader and does not draw the name', () => {
		const input = render( { placeholder: 'Search the shop' } );
		const label = container.querySelector( 'label' );

		expect( label.getAttribute( 'for' ) ).toBe( input.id );
		expect( label.classList.contains( 'components-visually-hidden' ) ).toBe( true );
		expect( label.textContent ).toBe( 'Search' );
		expect( input.getAttribute( 'type' ) ).toBe( 'search' );
		expect( input.getAttribute( 'placeholder' ) ).toBe( 'Search the shop' );
		expect( input.getAttribute( 'autocomplete' ) ).toBe( 'off' );
	} );

	it( 'gives every box an id of its own', () => {
		act( () => root.render( <><SearchBox value="" onChange={ () => {} } /><SearchBox value="" onChange={ () => {} } /></> ) );

		const [ first, second ] = container.querySelectorAll( 'input' );

		expect( first.id ).not.toBe( '' );
		expect( first.id ).not.toBe( second.id );
	} );

	it( 'shows its value and reports the text typed into it', () => {
		const onChange = jest.fn();
		const input = render( { value: 'shoes', onChange } );

		expect( input.value ).toBe( 'shoes' );

		// React reads the value through the element's own setter.
		const setValue = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' ).set;

		act( () => {
			setValue.call( input, 'shoes red' );
			input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		} );

		expect( onChange ).toHaveBeenCalledWith( 'shoes red' );
	} );

	it( 'reports a click on the field, which is how a trigger opens the modal', () => {
		const onClick = jest.fn();
		const input = render( { onClick } );

		act( () => input.click() );

		expect( onClick ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'treats a missing value as an empty field', () => {
		const input = render( { value: undefined } );

		expect( input.value ).toBe( '' );
	} );
} );
