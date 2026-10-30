/**
 * The type switch of the filter bar: a type the filters leave empty keeps its
 * place but is off, and the counts go where the total they come from is not
 * an exact number.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` wraps this React and does not pass `act` on.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import FilterBar from './FilterBar';

// `@wordpress/components` loads packages that ship as ES modules only, which
// this suite does not run through Babel. The bar takes only an icon from it.
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
