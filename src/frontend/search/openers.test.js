import { OPEN_EVENT, attachOpeners, isValidSelector } from './openers';

describe( 'openers', () => {
	let detach;
	let opened;
	const onOpen = ( event ) => opened.push( event.detail.query );

	beforeEach( () => {
		opened = [];
		window.addEventListener( OPEN_EVENT, onOpen );
		document.body.innerHTML = `
			<ul><li id="menu-item-search"><a href="?s=">Search</a></li></ul>
			<a id="hash" href="/shop/#searcio">Find</a>
			<span id="classed" class="searcio-open"><i id="inner">icon</i></span>
			<input id="theme-field" class="search-field" type="search" value="jac">
			<a id="plain" href="/about/">About</a>
			<input id="other-field" type="text">
			<div data-webhead-frontend-root><input id="own" class="search-field" type="search"></div>
		`;
	} );

	afterEach( () => {
		detach?.();
		detach = undefined;
		window.removeEventListener( OPEN_EVENT, onOpen );
	} );

	const click = ( id ) => {
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true } );

		document.getElementById( id ).dispatchEvent( event );

		return event;
	};

	it( 'opens from a link to #searcio and from the class, with no selector set', () => {
		detach = attachOpeners();

		expect( click( 'hash' ).defaultPrevented ).toBe( true );
		click( 'inner' );

		expect( opened ).toEqual( [ '', '' ] );
	} );

	it( 'opens from the theme element a selector names, and the theme never hears the click', () => {
		const theme = jest.fn();

		document.getElementById( 'menu-item-search' ).addEventListener( 'click', theme );
		document.addEventListener( 'click', theme );
		detach = attachOpeners( { selectors: [ '#menu-item-search > a' ] } );

		expect( click( 'menu-item-search' ).defaultPrevented ).toBe( false );
		expect( theme ).toHaveBeenCalledTimes( 2 );

		theme.mockClear();
		const event = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
		document.querySelector( '#menu-item-search > a' ).dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
		expect( theme ).not.toHaveBeenCalled();
		expect( opened ).toEqual( [ '' ] );
	} );

	it( 'leaves every other link alone', () => {
		detach = attachOpeners( { selectors: [ '#menu-item-search > a' ] } );

		expect( click( 'plain' ).defaultPrevented ).toBe( false );
		expect( opened ).toEqual( [] );
	} );

	it( 'opens from a theme field when it takes the focus, with what was typed in it', () => {
		detach = attachOpeners( { selectors: [ '.search-field' ] } );

		document.getElementById( 'theme-field' ).focus();

		expect( opened ).toEqual( [ 'jac' ] );
		expect( document.activeElement ).not.toBe( document.getElementById( 'theme-field' ) );
	} );

	it( 'never opens from its own markup, whatever a selector matches', () => {
		detach = attachOpeners( { selectors: [ '.search-field' ] } );

		document.getElementById( 'own' ).focus();

		expect( opened ).toEqual( [] );
	} );

	it( 'skips a selector the browser cannot read and keeps the others', () => {
		expect( isValidSelector( 'a[href=' ) ).toBe( false );
		expect( isValidSelector( '' ) ).toBe( false );
		expect( isValidSelector( '#menu-item-search > a' ) ).toBe( true );

		detach = attachOpeners( { selectors: [ 'a[href=', '#plain' ] } );
		click( 'plain' );

		expect( opened ).toEqual( [ '' ] );
	} );

	it( 'opens on Ctrl+K and Cmd+K, and on "/" outside a field, when the shortcut is on', () => {
		detach = attachOpeners( { shortcut: true } );

		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true } ) );
		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'K', metaKey: true, bubbles: true, cancelable: true } ) );
		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: '/', bubbles: true, cancelable: true } ) );

		expect( opened ).toEqual( [ '', '', '' ] );
	} );

	it( 'leaves "/" to a field that has the focus', () => {
		detach = attachOpeners( { shortcut: true } );

		const field = document.getElementById( 'other-field' );

		field.focus();
		field.dispatchEvent( new KeyboardEvent( 'keydown', { key: '/', bubbles: true, cancelable: true } ) );

		expect( opened ).toEqual( [] );
	} );

	it( 'has no shortcut unless it is turned on', () => {
		detach = attachOpeners();

		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true } ) );

		expect( opened ).toEqual( [] );
	} );

	it( 'stops listening when it is detached', () => {
		attachOpeners( { shortcut: true } )();

		click( 'hash' );
		document.body.dispatchEvent( new KeyboardEvent( 'keydown', { key: '/', bubbles: true } ) );

		expect( opened ).toEqual( [] );
	} );
} );
