/**
 * The storefront's icon: what `Icon` of `@wordpress/components` did for the
 * icons it draws, without the package.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import { closeSmall, search } from '@wordpress/icons';

import Icon from './Icon';

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

const render = ( element ) => {
	act( () => root.render( element ) );

	return container.querySelector( 'svg' );
};

describe( 'Icon', () => {
	it( 'draws an icon at 24 pixels unless it is given a size', () => {
		const svg = render( <Icon icon={ closeSmall } /> );

		expect( svg.getAttribute( 'width' ) ).toBe( '24' );
		expect( svg.getAttribute( 'height' ) ).toBe( '24' );
		expect( svg.querySelector( 'path' ) ).not.toBeNull();
	} );

	it( 'draws it at the size it is given', () => {
		const svg = render( <Icon icon={ closeSmall } size={ 18 } /> );

		expect( svg.getAttribute( 'width' ) ).toBe( '18' );
		expect( svg.getAttribute( 'height' ) ).toBe( '18' );
	} );

	it( 'passes the rest of its props to the svg', () => {
		const svg = render( <Icon icon={ closeSmall } className="mine" fill="currentColor" aria-hidden="true" /> );

		expect( svg.getAttribute( 'class' ) ).toBe( 'mine' );
		expect( svg.getAttribute( 'fill' ) ).toBe( 'currentColor' );
		expect( svg.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
	} );

	it( 'keeps what the icon says about itself and lets the caller say more', () => {
		// The outline magnifier is drawn with `fill: none` in a style of its own.
		const own = render( <Icon icon={ search } /> );

		expect( own.style.fill ).toBe( 'none' );

		const merged = render( <Icon icon={ search } style={ { color: 'red' } } /> );

		expect( merged.style.fill ).toBe( 'none' );
		expect( merged.style.color ).toBe( 'red' );

		const overridden = render( <Icon icon={ search } style={ { fill: 'currentColor' } } /> );

		expect( overridden.style.fill ).toBe( 'currentColor' );
	} );

	it( 'gives a component the size and the props', () => {
		const Glyph = ( { size, title } ) => <i data-size={ size } data-title={ title } />;

		act( () => root.render( <Icon icon={ Glyph } size={ 16 } title="x" /> ) );

		const glyph = container.querySelector( 'i' );

		expect( glyph.dataset.size ).toBe( '16' );
		expect( glyph.dataset.title ).toBe( 'x' );
	} );

	it( 'draws nothing for nothing', () => {
		act( () => root.render( <Icon /> ) );

		expect( container.innerHTML ).toBe( '' );
	} );
} );
