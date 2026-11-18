/**
 * The filter bar: the type switch, where a type the filters leave empty keeps
 * its place but is off and the counts go where the total they come from is not
 * an exact number, and the name of a group's button.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` wraps this React and does not pass `act` on.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import FilterBar from './FilterBar';

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

const render = ( props ) => act( () => root.render(
	<FilterBar
		narrow={ false }
		types={ [ { value: 'product', count: 21 }, { value: 'post', count: 0 } ] }
		activeTypes={ [] }
		showTypes
		onType={ () => {} }
		typeLabels={ { product: 'Produkte', post: 'Beiträge' } }
		showCount
		groups={ [] }
		buttonLabel={ () => ( {} ) }
		isActive={ () => false }
		openField=""
		allOpen={ false }
		popoverId="pop"
		activeCount={ 0 }
		limit={ 5 }
		fitKey="jacke"
		onGroup={ () => {} }
		onAll={ () => {} }
		{ ...props }
	/>
) );

const typeButton = ( label ) => [ ...container.querySelectorAll( '.whsc-type' ) ].find( ( button ) => button.querySelector( '.whsc-facet__label' ).textContent === label );

describe( 'FilterBar type switch', () => {
	it( 'keeps a type the filters leave empty in its place, off', () => {
		render();

		const posts = typeButton( 'Beiträge' );

		expect( posts ).toBeDefined();
		expect( posts.disabled ).toBe( true );
		expect( posts.classList.contains( 'is-empty' ) ).toBe( true );
		expect( typeButton( 'Produkte' ).disabled ).toBe( false );
	} );

	it( 'leaves a pressed type on even at 0, so the way back stays', () => {
		render( { activeTypes: [ 'post' ] } );

		expect( typeButton( 'Beiträge' ).disabled ).toBe( false );
		expect( typeButton( 'Beiträge' ).classList.contains( 'is-empty' ) ).toBe( false );
	} );

	it( 'shows the counts when the total is exact', () => {
		render();

		expect( typeButton( 'Produkte' ).querySelector( '.whsc-facet__count' ).textContent ).toBe( '21' );
	} );

	it( 'shows no counts when told the total is not exact', () => {
		render( { showCount: false } );

		expect( container.querySelectorAll( '.whsc-type .whsc-facet__count' ) ).toHaveLength( 0 );
		expect( typeButton( 'Beiträge' ).disabled ).toBe( true );
	} );
} );

describe( 'FilterBar group buttons', () => {
	const button = () => container.querySelector( '.whsc-filter-btn[data-field="attr_color"]' );
	const label = ( more ) => () => ( {
		text: 'Color: Black',
		name: 'Color',
		value: 'Black',
		more,
		hidden: more > 0 ? ', Olive' : '',
	} );

	it( 'is named by what it shows, "+1" included, and then by the values behind it', () => {
		render( { groups: [ 'attr_color' ], buttonLabel: label( 1 ), isActive: () => true } );

		expect( button().querySelector( '.whsc-filter-btn__more' ).textContent ).toBe( '+1' );
		// A name that leaves out what the button shows fails "Label in Name".
		expect( button().getAttribute( 'aria-label' ) ).toBe( 'Color: Black +1, Olive' );
	} );

	it( 'needs no name of its own while it shows everything it stands for', () => {
		render( { groups: [ 'attr_color' ], buttonLabel: label( 0 ), isActive: () => true } );

		expect( button().querySelector( '.whsc-filter-btn__more' ) ).toBeNull();
		expect( button().hasAttribute( 'aria-label' ) ).toBe( false );
	} );
} );

