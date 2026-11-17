/**
 * The storefront's modal: what a dialog owes a keyboard, a screen reader and
 * the page behind it, and the elements and classes the stylesheet draws it by.
 */
// eslint-disable-next-line import/no-extraneous-dependencies -- `@wordpress/element` does not export `act`.
import { act } from 'react';
import { createRoot } from '@wordpress/element';

import Modal from './Modal';

let container;
let root;

beforeEach( () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement( 'div' );
	document.body.appendChild( container );
	root = createRoot( container );
	// A visitor who asks for less motion: the modal closes without an animation to wait for.
	window.matchMedia = () => ( {
		matches: true,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
	} );
} );

afterEach( () => {
	act( () => root.unmount() );
	container.remove();
	document.body.className = '';
} );

const wait = () => new Promise( ( resolve ) => setTimeout( resolve, 30 ) );

const flush = () => act( wait );

const overlay = () => document.querySelector( '.components-modal__screen-overlay' );
const frame = () => document.querySelector( '.components-modal__frame' );

const key = ( target, init ) => act( async () => {
	target.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, cancelable: true, ...init } ) );
	await wait();
} );

const press = ( target, button = 0 ) => act( async () => {
	target.dispatchEvent( new MouseEvent( 'pointerdown', { bubbles: true, cancelable: true, button } ) );
	target.dispatchEvent( new MouseEvent( 'pointerup', { bubbles: true, cancelable: true, button } ) );
	await wait();
} );

describe( 'Modal', () => {
	it( 'draws the elements and the classes the stylesheet knows, in the body of the page', () => {
		act( () => root.render(
			<Modal onRequestClose={ () => {} } className="mine" overlayClassName="theirs" contentLabel="Search">
				<p id="inside">Hello</p>
			</Modal>
		) );

		expect( overlay().parentElement ).toBe( document.body );
		expect( overlay().classList.contains( 'theirs' ) ).toBe( true );
		expect( frame().parentElement ).toBe( overlay() );
		expect( frame().classList.contains( 'mine' ) ).toBe( true );
		expect( frame().getAttribute( 'role' ) ).toBe( 'dialog' );
		expect( frame().getAttribute( 'aria-label' ) ).toBe( 'Search' );
		expect( frame().getAttribute( 'tabindex' ) ).toBe( '-1' );

		const content = frame().querySelector( ':scope > .components-modal__content' );

		expect( content.classList.contains( 'hide-header' ) ).toBe( true );
		expect( content.querySelector( ':scope > .components-modal__children-container > #inside' ) ).not.toBeNull();
		expect( document.querySelector( '.components-modal__header' ) ).toBeNull();
	} );

	it( 'is named by what the caller points to when it has no label of its own', () => {
		act( () => root.render(
			<Modal onRequestClose={ () => {} } aria={ { labelledby: 'title', describedby: 'text' } }>
				<h2 id="title">Filters</h2>
			</Modal>
		) );

		expect( frame().getAttribute( 'aria-labelledby' ) ).toBe( 'title' );
		expect( frame().getAttribute( 'aria-describedby' ) ).toBe( 'text' );
	} );

	it( 'closes on Escape, once, and tells the caller', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose }><button type="button">a</button></Modal> ) );
		await key( frame().querySelector( 'button' ), { key: 'Escape', code: 'Escape' } );

		expect( onRequestClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not close on an Escape that something inside it has already taken', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render(
			<Modal onRequestClose={ onRequestClose }>
				<input
					type="text"
					onKeyDown={ ( event ) => 'Escape' === event.key && event.preventDefault() }
				/>
			</Modal>
		) );
		await key( frame().querySelector( 'input' ), { key: 'Escape', code: 'Escape' } );

		expect( onRequestClose ).not.toHaveBeenCalled();
	} );

	it( 'does not close on Escape when it was told not to, and ignores other keys', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose } shouldCloseOnEsc={ false }><button type="button">a</button></Modal> ) );
		await key( frame().querySelector( 'button' ), { key: 'Escape', code: 'Escape' } );

		act( () => root.render( <Modal onRequestClose={ onRequestClose }><button type="button">a</button></Modal> ) );
		await key( frame().querySelector( 'button' ), { key: 'a', code: 'KeyA' } );

		expect( onRequestClose ).not.toHaveBeenCalled();
	} );

	it( 'does not take the Escape that ends composing text in an input method', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose }><input type="text" /></Modal> ) );
		await key( frame().querySelector( 'input' ), { key: 'Escape', code: 'Escape', keyCode: 229 } );

		expect( onRequestClose ).not.toHaveBeenCalled();
	} );

	it( 'closes on a press on the dimmed page, and only there', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose }><button type="button">a</button></Modal> ) );

		await press( frame().querySelector( 'button' ) );
		await press( frame() );

		expect( onRequestClose ).not.toHaveBeenCalled();

		await press( overlay(), 2 );

		expect( onRequestClose ).not.toHaveBeenCalled();

		await press( overlay() );

		expect( onRequestClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not close on a drag that began in it and ended on the page', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose }><button type="button">a</button></Modal> ) );
		await act( async () => {
			frame().dispatchEvent( new MouseEvent( 'pointerdown', { bubbles: true, cancelable: true, button: 0 } ) );
			overlay().dispatchEvent( new MouseEvent( 'pointerup', { bubbles: true, cancelable: true, button: 0 } ) );
			await wait();
		} );

		expect( onRequestClose ).not.toHaveBeenCalled();
	} );

	it( 'does not close on a press outside when it was told not to', async () => {
		const onRequestClose = jest.fn();

		act( () => root.render( <Modal onRequestClose={ onRequestClose } shouldCloseOnClickOutside={ false }><p>a</p></Modal> ) );
		await press( overlay() );

		expect( onRequestClose ).not.toHaveBeenCalled();
	} );

	it( 'hides the rest of the page from a screen reader while it is open, and gives it back', () => {
		const page = document.createElement( 'main' );
		const live = document.createElement( 'div' );
		const already = document.createElement( 'div' );

		live.setAttribute( 'role', 'status' );
		already.setAttribute( 'aria-hidden', 'true' );
		document.body.append( page, live, already );

		act( () => root.render( <Modal onRequestClose={ () => {} }><p>a</p></Modal> ) );

		expect( page.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( container.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( overlay().hasAttribute( 'aria-hidden' ) ).toBe( false );
		expect( live.hasAttribute( 'aria-hidden' ) ).toBe( false );

		act( () => root.render( null ) );

		expect( page.hasAttribute( 'aria-hidden' ) ).toBe( false );
		expect( container.hasAttribute( 'aria-hidden' ) ).toBe( false );
		// What was hidden before is not the modal's to show.
		expect( already.getAttribute( 'aria-hidden' ) ).toBe( 'true' );

		page.remove();
		live.remove();
		already.remove();
	} );

	it( 'puts a class on the body while it is open, until the last of two is closed', () => {
		const second = document.createElement( 'div' );

		document.body.appendChild( second );

		const other = createRoot( second );

		act( () => root.render( <Modal onRequestClose={ () => {} } bodyOpenClassName="whsc-open"><p>a</p></Modal> ) );

		expect( document.body.classList.contains( 'whsc-open' ) ).toBe( true );

		act( () => other.render( <Modal onRequestClose={ () => {} } bodyOpenClassName="whsc-open"><p>b</p></Modal> ) );
		act( () => root.render( null ) );

		expect( document.body.classList.contains( 'whsc-open' ) ).toBe( true );

		act( () => other.render( null ) );

		expect( document.body.classList.contains( 'whsc-open' ) ).toBe( false );

		act( () => other.unmount() );
		second.remove();
	} );

	it( 'is shown with `modal-open` on the body unless it is given another class', () => {
		act( () => root.render( <Modal onRequestClose={ () => {} }><p>a</p></Modal> ) );

		expect( document.body.classList.contains( 'modal-open' ) ).toBe( true );
	} );

	it( 'asks a modal that is open beside it to close, and one nested in it as it closes itself', () => {
		const first = jest.fn();
		const inner = jest.fn();
		const second = document.createElement( 'div' );

		document.body.appendChild( second );

		const other = createRoot( second );

		act( () => root.render( <Modal onRequestClose={ first }><p>a</p></Modal> ) );

		expect( first ).not.toHaveBeenCalled();

		act( () => other.render( <Modal onRequestClose={ () => {} }><p>b</p></Modal> ) );

		expect( first ).toHaveBeenCalledTimes( 1 );

		// A modal inside one that closes is closed with it.
		act( () => root.render(
			<Modal onRequestClose={ () => {} }>
				<Modal onRequestClose={ inner }><p>inner</p></Modal>
			</Modal>
		) );

		expect( inner ).not.toHaveBeenCalled();

		act( () => root.render( null ) );

		expect( inner ).toHaveBeenCalledTimes( 1 );

		act( () => other.unmount() );
		second.remove();
	} );

	it( 'does not ask the modal it is nested in to close', () => {
		const outer = jest.fn();

		act( () => root.render(
			<Modal onRequestClose={ outer }>
				<Modal onRequestClose={ () => {} }><p>inner</p></Modal>
			</Modal>
		) );

		expect( outer ).not.toHaveBeenCalled();
		expect( document.querySelectorAll( '.components-modal__frame' ) ).toHaveLength( 2 );
	} );

	it( 'moves the focus in as it opens and returns it to what had it as it closes', async () => {
		const opener = document.createElement( 'button' );

		document.body.appendChild( opener );
		opener.focus();

		act( () => root.render( <Modal onRequestClose={ () => {} }><button type="button" id="first">a</button></Modal> ) );
		await flush();

		expect( frame().contains( document.activeElement ) ).toBe( true );

		act( () => root.render( null ) );
		await flush();

		expect( document.activeElement ).toBe( opener );

		opener.remove();
	} );

	it( 'leaves the focus where it is when it is told to', async () => {
		const opener = document.createElement( 'input' );

		document.body.appendChild( opener );
		opener.focus();

		act( () => root.render( <Modal onRequestClose={ () => {} } focusOnMount={ false }><button type="button">a</button></Modal> ) );
		await flush();

		expect( document.activeElement ).toBe( opener );

		opener.remove();
	} );

	it( 'hands a ref of the overlay to the caller and the key presses of its frame', async () => {
		const ref = { current: null };
		const onKeyDown = jest.fn();

		act( () => root.render( <Modal ref={ ref } onRequestClose={ () => {} } onKeyDown={ onKeyDown }><button type="button">a</button></Modal> ) );
		await key( frame().querySelector( 'button' ), { key: 'a', code: 'KeyA' } );

		expect( ref.current ).toBe( overlay() );
		expect( onKeyDown ).toHaveBeenCalledTimes( 1 );
	} );
} );
