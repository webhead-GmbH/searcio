/**
 * A row of the Indexing tab's extra fields: the name a field is sent under,
 * where its value comes from, and which one.
 *
 * Drawn with the real `SelectControl` of `@wordpress/ui` and picked from as a
 * visitor would, because what broke was the contract between that control and
 * the row: it hands over the whole item, and the row stored it as a string,
 * "[object Object]:", which no source kind matches.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` wraps this React and does not pass `act` on.
import { act } from 'react';
import { createRoot, useState } from '@wordpress/element';

import { CustomFieldRow } from './IndexingTab';

// `@wordpress/components` loads packages that ship as ES modules only, which
// this suite does not run through Babel. The row takes only its remove button
// from there; the selects under test are the real ones.
jest.mock( '@wordpress/components', () => {
	const { createElement } = require( '@wordpress/element' );

	return {
		Button: ( { label, onClick } ) => createElement( 'button', { type: 'button', 'aria-label': label, onClick } ),
		ToggleControl: () => null,
	};
} );

const TAXONOMIES = [
	{ slug: 'product_brand', label: 'Brands' },
	{ slug: 'product_cat', label: 'Product categories' },
];

let container;
let root;
let stored;

const Row = ( { initial } ) => {
	const [ field, setField ] = useState( initial );

	stored = field;

	return <CustomFieldRow field={ field } taxonomies={ TAXONOMIES } onChange={ setField } onRemove={ () => {} } />;
};

const render = ( field ) => act( () => root.render( <Row initial={ field } /> ) );

/**
 * The control a label names. The trigger of a select is named through
 * `aria-labelledby`, a text field through its `<label>`.
 *
 * @param {string} name The label.
 * @return {?HTMLElement} The control.
 */
const control = ( name ) =>
	[ ...container.querySelectorAll( '[role="combobox"], input' ) ].find( ( element ) => {
		const labelledBy = ( element.getAttribute( 'aria-labelledby' ) || '' )
			.split( ' ' )
			.map( ( id ) => document.getElementById( id )?.textContent ?? '' )
			.join( ' ' )
			.trim();

		return name === ( labelledBy || element.labels?.[ 0 ]?.textContent );
	} ) ?? null;

const options = () => [ ...document.querySelectorAll( '[role="option"]' ) ];

const open = ( name ) => act( async () => control( name ).click() );

/**
 * Open the select a label names and pick an option, the way a pointer does:
 * the press lands on the option, then the click.
 *
 * @param {string} name  The select's label.
 * @param {string} label The option's label.
 */
const pick = async ( name, label ) => {
	await open( name );

	const option = options().find( ( element ) => label === element.textContent );

	await act( async () => {
		option.dispatchEvent( new MouseEvent( 'pointerdown', { bubbles: true } ) );
		option.click();
	} );
};

beforeAll( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
} );

beforeEach( () => {
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
} );

afterEach( () => {
	act( () => root.unmount() );
	document.body.innerHTML = '';
} );

describe( 'CustomFieldRow', () => {
	it( 'keeps the kind a pick of "From" names, and asks for a taxonomy', async () => {
		await render( { as: 'brand', source: 'meta:' } );

		await pick( 'From', 'Taxonomy' );

		expect( stored.source ).toBe( 'taxonomy:' );
		expect( control( 'From' ).textContent ).toBe( 'Taxonomy' );
		expect( control( 'Taxonomy' ) ).not.toBeNull();
		expect( control( 'Meta key' ) ).toBeNull();

		await pick( 'Taxonomy', 'Brands' );

		expect( stored ).toEqual( { as: 'brand', source: 'taxonomy:product_brand' } );
		expect( control( 'Taxonomy' ).textContent ).toBe( 'Brands' );
	} );

	it( 'keeps a built-in field, and an empty one when "- Select -" is picked', async () => {
		await render( { as: 'slug', source: 'meta:' } );

		await pick( 'From', 'Built-in field' );

		expect( stored.source ).toBe( 'property:' );

		await pick( 'Value', 'Slug' );

		expect( stored.source ).toBe( 'property:slug' );

		await pick( 'Value', '- Select -' );

		expect( stored.source ).toBe( 'property:' );
		expect( control( 'Value' ).textContent ).toBe( '- Select -' );
	} );

	it( 'marks the stored choice as the selected option', async () => {
		await render( { as: 'brand', source: 'taxonomy:product_cat' } );

		await open( 'From' );

		expect(
			options()
				.filter( ( option ) => 'true' === option.getAttribute( 'aria-selected' ) )
				.map( ( option ) => option.textContent )
		).toEqual( [ 'Taxonomy' ] );
	} );

	it( 'asks for a meta key for a custom field', async () => {
		await render( { as: 'colour', source: 'meta:' } );

		expect( control( 'From' ).textContent ).toBe( 'Custom field' );
		expect( control( 'Meta key' ) ).not.toBeNull();
	} );
} );
