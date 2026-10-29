/**
 * One group's values, as a popover, a phone's sheet and a section of "All
 * filters" draw them: real checkboxes in a fieldset named by the group, tiles
 * that keep a value the other filters leave empty in its place, and a long
 * list cut to its first values with a way to the rest and a field to search
 * it.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` wraps this React and does not pass `act` on.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import FilterPanel, { panelEntries } from './FilterPanel';

// `@wordpress/components` loads packages that ship as ES modules only, which
// this suite does not run through Babel. The panel takes only an icon from it.
jest.mock( '@wordpress/components', () => ( { Icon: () => null } ) );

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

const render = ( props ) => act( () => root.render( <FilterPanel field="categories" label="Kategorie" display="list" onToggle={ () => {} } { ...props } /> ) );

const values = ( count ) => Array.from( { length: count }, ( _, index ) => ( { value: `Wert ${ String( index + 1 ).padStart( 2, '0' ) }`, count: 100 - index } ) );

const labels = () => [ ...container.querySelectorAll( '.whsc-facet__label' ) ].map( ( node ) => node.textContent );

describe( 'FilterPanel', () => {
	it( 'draws each value as a checkbox in a fieldset named by the group', () => {
		const toggled = [];

		render( {
			values: [ { value: 'Damenmode', count: 12 }, { value: 'Herrenmode', count: 11 } ],
			selected: [ 'Herrenmode' ],
			onToggle: ( field, value ) => toggled.push( [ field, value ] ),
		} );

		expect( container.querySelector( 'fieldset legend' ).textContent ).toBe( 'Kategorie' );

		const boxes = [ ...container.querySelectorAll( 'input[type="checkbox"]' ) ];

		expect( boxes.map( ( box ) => box.closest( 'label' ).textContent ) ).toEqual( [ 'Damenmode12', 'Herrenmode11' ] );
		expect( boxes.map( ( box ) => box.checked ) ).toEqual( [ false, true ] );

		act( () => boxes[ 0 ].click() );

		expect( toggled ).toEqual( [ [ 'categories', 'Damenmode' ] ] );
	} );

	it( 'keeps a tile the other filters leave empty in its place, disabled, and never a selected one', () => {
		render( {
			field: 'attr_size',
			label: 'Größe',
			display: 'tiles',
			values: [ { value: 'M', count: 1 }, { value: 'S', count: 1 } ],
			selected: [ 'XL' ],
			frozen: [ 'S', 'M', 'L', 'XL' ],
		} );

		expect( labels() ).toEqual( [ 'S', 'M', 'L', 'XL' ] );

		const disabled = [ ...container.querySelectorAll( 'input' ) ].map( ( box ) => box.disabled );

		expect( disabled ).toEqual( [ false, false, true, false ] );
		expect( container.querySelectorAll( '.whsc-tile.is-empty' ) ).toHaveLength( 1 );
	} );

	it( 'shows the first eight of a long list and opens the rest on request', () => {
		render( { values: values( 61 ), selected: [ 'Wert 40' ] } );

		// The first eight, and the selected value further down.
		expect( labels() ).toHaveLength( 9 );
		expect( labels()[ 8 ] ).toBe( 'Wert 40' );

		const more = container.querySelector( '.whsc-more' );

		expect( more.textContent ).toBe( 'Show all 61' );
		expect( more.getAttribute( 'aria-label' ) ).toBe( 'Show all 61 values for Kategorie' );
		expect( more.getAttribute( 'aria-expanded' ) ).toBe( 'false' );

		act( () => more.click() );

		expect( labels() ).toHaveLength( 61 );
		expect( container.querySelector( '.whsc-more' ).getAttribute( 'aria-expanded' ) ).toBe( 'true' );
	} );

	it( 'does not cut a list for one or two more values', () => {
		render( { values: values( 10 ) } );

		expect( labels() ).toHaveLength( 10 );
		expect( container.querySelector( '.whsc-more' ) ).toBeNull();
	} );

	it( 'gives a list of more than twelve a field that searches it', () => {
		render( { values: [ ...values( 12 ), { value: 'Küche & Haushalt', count: 1 } ] } );

		const field = container.querySelector( '.whsc-within__input' );

		expect( field.getAttribute( 'aria-label' ) ).toBe( 'Search Kategorie' );

		const setValue = Object.getOwnPropertyDescriptor( window.HTMLInputElement.prototype, 'value' ).set;

		act( () => {
			setValue.call( field, 'kuche' );
			field.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
		} );

		expect( labels() ).toEqual( [ 'Küche & Haushalt' ] );

		act( () => {
			setValue.call( field, 'nichts' );
			field.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
		} );

		expect( container.querySelector( '.whsc-opts__none' ).textContent ).toBe( 'Nothing matches “nichts”.' );
	} );

	it( 'draws colour pills with the value\'s colour', () => {
		render( {
			field: 'attr_color',
			label: 'Farbe',
			display: 'color',
			values: [ { value: 'Oliv', count: 3 } ],
			colors: { Oliv: '#6f7a3a' },
		} );

		expect( container.querySelector( '.whsc-swatch__dot' ).style.getPropertyValue( '--whsc-dot' ) ).toBe( '#6f7a3a' );
		expect( container.querySelector( '.whsc-swatch input[type="checkbox"]' ) ).not.toBeNull();
	} );
} );

describe( 'panelEntries', () => {
	it( 'hides a value at 0 unless it is selected or was on screen when the panel opened', () => {
		const entries = panelEntries( {
			values: [ { value: 'Oliv', count: 2 }, { value: 'Grau', count: 0 }, { value: 'Rot', count: 0 }, { value: 'Blau', count: 0 } ],
			selected: [ 'Rot' ],
			frozen: [ 'Oliv', 'Grau' ],
		} );

		expect( entries.map( ( entry ) => [ entry.value, entry.disabled ] ) ).toEqual( [
			[ 'Oliv', false ],
			[ 'Grau', true ],
			[ 'Rot', false ],
		] );
	} );

	it( 'keeps the order the panel opened with as the counts change', () => {
		const entries = panelEntries( {
			values: [ { value: 'Grau', count: 9 }, { value: 'Oliv', count: 1 }, { value: 'Neu', count: 5 } ],
			selected: [],
			frozen: [ 'Oliv', 'Grau' ],
		} );

		expect( entries.map( ( entry ) => entry.value ) ).toEqual( [ 'Oliv', 'Grau', 'Neu' ] );
	} );
} );
