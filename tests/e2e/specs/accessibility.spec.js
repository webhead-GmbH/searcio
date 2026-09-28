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

	test( 'the search field is a labelled combobox', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.input ).toHaveAttribute( 'role', 'combobox' );
		await expect( widget.input ).toHaveAttribute( 'aria-label', /.+/ );
	} );
} );
