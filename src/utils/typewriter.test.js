/**
 * The assistant's reply is typed out, word by word, and never far behind what
 * has arrived.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import { CATCH_UP_FRAMES, MIN_STEP, nextLength, useTypewriter } from './typewriter';

describe( 'nextLength', () => {
	it( 'shows a little more each frame, ending on a whole word', () => {
		const text = 'Here are some great warm jackets for your rainy autumn walks.';
		const next = nextLength( text, 0 );

		expect( next ).toBeGreaterThanOrEqual( MIN_STEP );
		expect( text[ next ] ).toBe( ' ' );
	} );

	it( 'never cuts a word, or a Markdown mark, in two', () => {
		const text = 'Try the **Fjellmark Waterproof Rain Jacket** for wet days.';

		for ( let shown = 0; shown < text.length; ) {
			shown = nextLength( text, shown );
			expect( shown === text.length || /\s/.test( text[ shown ] ) ).toBe( true );
		}
	} );

	it( 'catches up with a long backlog within a second', () => {
		const text = 'word '.repeat( 400 );
		let shown = 0;
		let frames = 0;

		while ( shown < text.length ) {
			shown = nextLength( text, shown );
			++frames;
		}

		// 60 frames are a second on a 60Hz screen.
		expect( frames ).toBeLessThanOrEqual( 60 );
		expect( frames ).toBeGreaterThan( CATCH_UP_FRAMES );
	} );

	it( 'shows what is left of a last word that has no end yet', () => {
		expect( nextLength( 'Hello wor', 6 ) ).toBe( 9 );
	} );

	it( 'stays at the end', () => {
		expect( nextLength( 'Done.', 5 ) ).toBe( 5 );
	} );
} );

describe( 'useTypewriter', () => {
	let container;
	let root;
	let frames;

	beforeEach( () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		frames = [];
		window.requestAnimationFrame = ( callback ) => frames.push( callback );
		window.cancelAnimationFrame = () => {};
		window.matchMedia = () => ( { matches: false } );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	const Typed = ( { text, animate = true, onType } ) => {
		const typed = useTypewriter( text, { animate, onType } );

		return <p data-typing={ String( typed.typing ) }>{ typed.text }</p>;
	};

	const step = () => act( () => frames.shift()?.() );

	it( 'starts empty and types the text out frame by frame', () => {
		const onType = jest.fn();

		act( () => root.render( <Typed text="Here are some warm jackets." onType={ onType } /> ) );

		expect( container.textContent ).toBe( '' );

		step();
		const first = container.textContent;

		expect( first.length ).toBeGreaterThan( 0 );
		expect( onType ).toHaveBeenCalled();

		while ( frames.length ) {
			step();
		}

		expect( container.textContent ).toBe( 'Here are some warm jackets.' );
		expect( container.querySelector( 'p' ).dataset.typing ).toBe( 'false' );
	} );

	it( 'carries on from where it stands when more of the reply arrives', () => {
		act( () => root.render( <Typed text="Here are" /> ) );
		while ( frames.length ) {
			step();
		}

		act( () => root.render( <Typed text="Here are some warm jackets." /> ) );

		expect( container.textContent ).toBe( 'Here are' );
		expect( container.querySelector( 'p' ).dataset.typing ).toBe( 'true' );
	} );

	it( 'shows everything at once when it is not to be typed', () => {
		act( () => root.render( <Typed text="An earlier reply." animate={ false } /> ) );

		expect( container.textContent ).toBe( 'An earlier reply.' );
		expect( frames ).toHaveLength( 0 );
	} );

	it( 'shows everything at once to a visitor who asks for less motion', () => {
		window.matchMedia = () => ( { matches: true } );

		act( () => root.render( <Typed text="Here are some warm jackets." /> ) );

		expect( container.textContent ).toBe( 'Here are some warm jackets.' );
	} );
} );
