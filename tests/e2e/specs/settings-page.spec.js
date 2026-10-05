/**
 * The settings screen as a page: the shell it is drawn by, the tab strip under
 * its header, and the space between everything a tab stacks.
 *
 * None of it can be read off the source. A frame that stops growing at some
 * maximum looks right on every screen narrower than that, two elements written
 * one after the other in a card touch without a word, and a heading level is
 * only wrong next to the one above it.
 *
 * Needs a build: run `npm run build` before the suite.
 */

import { test, expect, setConnected, touchingInShell } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud';

// A notice is also read out, through a live region that holds the same words
// outside the screen. What is asserted is what is drawn on it.
const SCREEN = '#webhead-search-cloud-root';

// A tab waits on the settings response, then on its own.
const LOADED = { timeout: 30000 };

/**
 * A tab, and something that is only on screen once it has drawn what it loads.
 */
const TABS = [
	{ tab: 'sync', ready: ( page ) => page.getByRole( 'heading', { level: 3, name: 'Sync history' } ) },
	{ tab: 'indexing', ready: ( page ) => page.getByRole( 'button', { name: 'Save indexing configuration' } ) },
	{ tab: 'connection', ready: ( page ) => page.getByRole( 'button', { name: 'Connect to Search Cloud' } ) },
	{ tab: 'general', ready: ( page ) => page.getByRole( 'button', { name: 'Save Settings' } ) },
];

test.describe( 'Settings screen', () => {
	test.beforeAll( () => {
		// The connect moment is the state of the Connection tab measured here.
		setConnected( false );
	} );

	/**
	 * Every admin screen of the plugin is drawn by `src/components/AdminPage.js`.
	 * Copy this test for each page that is added: two screens that both pass it
	 * start at the same place and are the same width.
	 *
	 * The width is one no laptop has, on purpose.
	 */
	test( 'is drawn by the page shell and fills the frame it is given', async ( { page } ) => {
		await page.setViewportSize( { width: 2400, height: 1200 } );
		await page.goto( SETTINGS_URL );

		const shell = page.locator( '.webhead-search-cloud-admin-page' );

		await expect( shell ).toBeVisible( LOADED );

		const measured = await shell.evaluate( ( element ) => {
			const frame = element.closest( '.wrap' ).getBoundingClientRect();
			const surface = element.querySelector( '.webhead-search-cloud-admin-page__surface' ).getBoundingClientRect();
			const style = window.getComputedStyle( element );

			return {
				frameStart: frame.x,
				frameWidth: frame.width,
				surfaceStart: surface.x,
				surfaceWidth: surface.width,
				insetStart: parseFloat( style.paddingLeft ),
				insetEnd: parseFloat( style.paddingRight ),
			};
		} );

		expect( measured.insetStart ).toBeGreaterThan( 0 );
		expect( measured.insetEnd ).toBe( measured.insetStart );
		expect( Math.abs( measured.surfaceStart - ( measured.frameStart + measured.insetStart ) ) ).toBeLessThanOrEqual( 1 );
		expect( Math.abs( measured.surfaceWidth - ( measured.frameWidth - 2 * measured.insetStart ) ) ).toBeLessThanOrEqual( 1 );
	} );

	test( 'names the page once, and the open tab under it', async ( { page } ) => {
		await page.goto( `${ SETTINGS_URL }&tab=sync` );

		await expect( page.getByRole( 'heading', { level: 1, name: 'webhead Search Cloud' } ) ).toBeVisible( LOADED );
		await expect( page.locator( '#webhead-search-cloud-root h1' ) ).toHaveCount( 1 );
		await expect( page.getByRole( 'heading', { level: 2, name: 'Sync', exact: true } ) ).toBeVisible( LOADED );
	} );

	/**
	 * Tabs that top a page reach the edges of the surface, with a line under
	 * them, and each label is as wide as its text. On a phone the strip scrolls
	 * and the page does not.
	 */
	test( 'draws the tab strip as wide as the surface, and never wider than the page', async ( { page } ) => {
		await page.goto( `${ SETTINGS_URL }&tab=sync` );

		const strip = page.getByRole( 'tablist' );

		await expect( strip ).toBeVisible( LOADED );

		const measured = await strip.evaluate( ( list ) => {
			const surface = list.closest( '.webhead-search-cloud-admin-page__surface' ).getBoundingClientRect();
			const tabs = [ ...list.querySelectorAll( '[role="tab"]' ) ].map( ( tab ) => tab.getBoundingClientRect().width );

			return {
				stripWidth: list.getBoundingClientRect().width,
				surfaceWidth: surface.width,
				line: window.getComputedStyle( list ).borderBottomWidth,
				widestTab: Math.max( ...tabs ),
				stripScrolls: list.scrollWidth > list.clientWidth,
				pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
			};
		} );

		expect( Math.abs( measured.stripWidth - measured.surfaceWidth ) ).toBeLessThanOrEqual( 1 );
		expect( measured.line ).toBe( '1px' );
		expect( measured.pageScrolls ).toBe( false );

		// A label, not a share of the strip. On a phone the strip is narrower
		// than its tabs and scrolls, and a tab has no room to grow into.
		if ( ! measured.stripScrolls ) {
			expect( measured.widestTab ).toBeLessThan( measured.surfaceWidth / 3 );
		}
	} );

	for ( const { tab, ready } of TABS ) {
		test( `leaves a gap between everything the ${ tab } tab stacks`, async ( { page } ) => {
			await page.goto( `${ SETTINGS_URL }&tab=${ tab }` );

			// The tab arrives with its data; measure the screen, not its skeleton.
			await expect( ready( page ) ).toBeVisible( LOADED );

			expect( await touchingInShell( page ) ).toEqual( [] );
		} );
	}

	/**
	 * A load that failed used to leave the screen as a plugin with no settings,
	 * and the only account of what had happened was in the browser console.
	 */
	test( 'says why the settings did not load, and asks again when told to', async ( { page } ) => {
		let fail = true;

		await page.route(
			( url ) => /\/webhead-search-cloud\/v1\/settings(\?|&|$)/.test( decodeURIComponent( url.href ) ),
			( route ) => {
				if ( ! fail ) {
					return route.continue();
				}

				return route.fulfill( {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { code: 'broken', message: 'The database went away.' } ),
				} );
			}
		);

		await page.goto( `${ SETTINGS_URL }&tab=general` );

		await expect( page.locator( SCREEN ).getByText( 'The settings could not be loaded: The database went away.' ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'tablist' ) ).toHaveCount( 0 );

		fail = false;
		await page.getByRole( 'button', { name: 'Try again' } ).click();

		await expect( page.getByRole( 'tab', { name: 'General' } ) ).toHaveAttribute( 'aria-selected', 'true', LOADED );
	} );

	/**
	 * One inline notice beside the button that failed, with the reason the REST
	 * API gave. It used to be a dialog that said to review the fields, whatever
	 * had gone wrong.
	 */
	test( 'reports a save that failed beside the Save button, with the reason', async ( { page } ) => {
		await page.route(
			( url ) => /\/webhead-search-cloud\/v1\/settings(\?|&|$)/.test( decodeURIComponent( url.href ) ),
			( route ) => {
				if ( 'GET' === route.request().method() ) {
					return route.continue();
				}

				return route.fulfill( {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { code: 'rest_invalid_param', message: 'Keep history for (days) must be a number.' } ),
				} );
			}
		);

		await page.goto( `${ SETTINGS_URL }&tab=general` );

		const days = page.getByRole( 'spinbutton', { name: 'Keep history for (days)' } );

		await expect( days ).toBeVisible( LOADED );
		await days.fill( '45' );
		await page.getByRole( 'button', { name: 'Save Settings' } ).click();

		await expect(
			page.locator( SCREEN ).getByText( 'The settings could not be saved: Keep history for (days) must be a number.' )
		).toBeVisible();
		await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
		// What was typed is still there to be corrected.
		await expect( days ).toHaveValue( '45' );
		expect( await touchingInShell( page ) ).toEqual( [] );
	} );
} );
