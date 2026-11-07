/**
 * A logged-in user sees WordPress's toolbar over the page, and a theme may
 * lift it above anything a window can be: fisch-gruber.at gives it
 * `z-index: 2147483647`, the highest there is. The search window starts where
 * the toolbar ends, so its search field is not under it.
 *
 * This file keeps the logged-in session the suite signs in with; the specs
 * that look at the window as a visitor sees it, with no toolbar, are the
 * others (`responsive.spec.js` measures it from the top of the screen).
 */

import { test, expect, SearchWidget, mockSearchCloud, configureSearchKey, createBlockPost } from '../utils';

/** The toolbar as high as a theme can lift it. */
const ABOVE_EVERYTHING = '#wpadminbar { z-index: 2147483647 !important; }';

/**
 * Where the toolbar ends, and whether the middle of the search field is the
 * search window's, not something drawn over it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {SearchWidget}                     widget
 */
const measure = async ( page, widget ) => {
	const bar = await page.locator( '#wpadminbar' ).boundingBox();
	const field = await widget.input.boundingBox();
	const fieldShows = await page.evaluate(
		( [ x, y ] ) => null !== document.elementFromPoint( x, y )?.closest( '.whsc-modal' ),
		[ field.x + field.width / 2, field.y + field.height / 2 ]
	);

	return { toolbarEnd: Math.round( bar.y + bar.height ), frame: await widget.modal.boundingBox(), fieldShows };
};

test.describe( 'Under the toolbar', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'the window starts where the toolbar ends', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );
		await page.addStyleTag( { content: ABOVE_EVERYTHING } );
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();

		const widget = new SearchWidget( page );
		await widget.openModal();

		const { toolbarEnd, frame, fieldShows } = await measure( page, widget );

		expect( toolbarEnd ).toBeGreaterThan( 0 );
		expect( Math.round( frame.y ) ).toBe( toolbarEnd );
		expect( fieldShows ).toBe( true );
	} );

	/**
	 * On a phone the window is the whole screen: under the toolbar it is the
	 * rest of it. Below 601px the toolbar is not fixed but stands at the top of
	 * the page, 46px tall.
	 */
	test( 'on a phone it fills the screen under the toolbar', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 390, height: 844 } );
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );
		await page.addStyleTag( { content: ABOVE_EVERYTHING } );
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();

		const widget = new SearchWidget( page );
		await widget.openModal();

		const { toolbarEnd, frame, fieldShows } = await measure( page, widget );

		expect( [ Math.round( frame.y ), Math.round( frame.y + frame.height ) ] ).toEqual( [ toolbarEnd, 844 ] );
		expect( fieldShows ).toBe( true );
	} );
} );
