/**
 * Keyboard and focus behaviour: focus enters the modal on open, Escape closes
 * it, and focus returns to the page afterwards. The modal is a
 * `@wordpress/components` Modal, so these guard against a regression that breaks
 * its focus trap / restore.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Accessibility', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	/**
	 * The block's placeholder defaults to empty and its mode to "icon", so the
	 * default trigger was a button with `aria-label=""` and no text: a screen
	 * reader announced "button", and nothing could find it by name. Found in a
	 * browser, because every other spec clicks it by CSS selector.
	 */
	test( 'names the icon trigger even when no placeholder is set', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils ) );

		const widget = new SearchWidget( page );
		await widget.trigger.waitFor( { state: 'visible' } );

		await expect( widget.trigger.getByRole( 'button', { name: 'Search', exact: true } ) ).toBeVisible();
	} );

	test( 'moves focus into the modal on open', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const focusInModal = await page.evaluate(
			() => null !== document.activeElement?.closest( '.whsc-modal' )
		);
		expect( focusInModal ).toBe( true );
	} );

	test( 'closes on Escape and returns focus to the document body or trigger', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await page.keyboard.press( 'Escape' );

		await expect( widget.modal ).toBeHidden();

		// Focus must not be lost to <body> stuck behind an aria-hidden region.
		const focusOutsideHiddenModal = await page.evaluate(
			() => null === document.activeElement?.closest( '.whsc-modal' )
		);
		expect( focusOutsideHiddenModal ).toBe( true );
	} );

	/**
	 * The shared frontend reset takes the outline off every focused
	 * `[role="tab"]`, and the mode tabs never put one back: Tab landed on them
	 * with nothing on screen to say so.
	 */
	test( 'the mode tabs show where keyboard focus is', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { assistant: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.focus();
		await page.keyboard.press( 'Shift+Tab' );

		const tab = widget.modal.getByRole( 'tab', { name: 'AI Assistant' } );
		await expect( tab ).toBeFocused();
		await expect( tab ).toHaveCSS( 'outline-style', 'solid' );
		await expect( tab ).toHaveCSS( 'outline-width', '2px' );
	} );

	/**
	 * Both text fields showed focus with a colour change on a 1px border - the
	 * search field added an 18% tint that measured 1.2:1. Each now draws the
	 * same 2px outline as every other control.
	 */
	test( 'the search and assistant fields draw a focus outline', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { assistant: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.focus();

		const field = widget.modal.locator( '.whsc-search-input' );
		await expect( field ).toHaveCSS( 'outline-style', 'solid' );
		await expect( field ).toHaveCSS( 'outline-width', '2px' );

		await widget.openTab( 'AI Assistant' );
		await widget.modal.getByRole( 'textbox', { name: /message/i } ).focus();

		const composer = widget.modal.locator( '.whsc-assistant__composer' );
		await expect( composer ).toHaveCSS( 'outline-style', 'solid' );
		await expect( composer ).toHaveCSS( 'outline-width', '2px' );
	} );

	/** A tablist holds tabs; the close control sits beside it, not in it. */
	test( 'keeps the close control out of the tablist', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { assistant: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( 'AI Assistant' );

		const tablist = widget.modal.getByRole( 'tablist', { name: 'Search modes' } );
		await expect( tablist.getByRole( 'button' ) ).toHaveCount( 0 );
		await expect( widget.modal.getByRole( 'button', { name: 'Close search' } ) ).toBeVisible();
	} );

	test( 'the search field is a labelled combobox', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.input ).toHaveAttribute( 'role', 'combobox' );
		await expect( widget.input ).toHaveAttribute( 'aria-label', /.+/ );
	} );
} );
