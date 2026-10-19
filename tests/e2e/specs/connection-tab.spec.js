/**
 * The Connection tab's "This month" card, drawn from the same health check the
 * connected notice reads. A spent allowance is why a storefront stops returning
 * results, so this is where an admin has to be able to see it.
 *
 * The response below is deliberately awkward: allowances out of order, one the
 * plan does not meter at all, and the two account-wide counts. Each is a rule
 * the card applies, and each can fail on its own.
 */

import { test, expect, setConnected, touchingInShell } from '../utils';

const CONNECTION_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=connection';

// The tab waits on the settings response, then on the health check.
const LOADED = { timeout: 30000 };

const metric = ( used, limit, flags = {} ) => ( {
	used,
	limit,
	percent: null === limit ? null : Math.round( ( used / limit ) * 100 ),
	exceeded: false,
	near_limit: false,
	...flags,
} );

const HEALTH = {
	ok: true,
	status: 200,
	site_id: 21,
	documents: { used: 96, limit: 300000 },
	plan: { name: 'Business', is_free: false, upgrade_url: '' },
	languages: { limit: null },
	usage: {
		ai_messages: metric( 3000, 3000, { exceeded: true, near_limit: true } ),
		visual_searches: metric( 12, null ),
		searches: metric( 270000, 300000, { near_limit: true } ),
		members: metric( 1, 30 ),
		documents: metric( 96, 300000 ),
		sites: metric( 1, 15 ),
	},
};

/** Answer the plugin's own health route locally - it is a real round trip otherwise. */
async function mockHealth( page ) {
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/connection/test' ),
		( route ) => route.fulfill( {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( HEALTH ),
		} )
	);
}

test.describe( 'Connection tab allowances', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'lists each metered allowance for this site, in the order that matters', async ( { page } ) => {
		await mockHealth( page );
		await page.goto( CONNECTION_URL );

		const labels = page.locator( '.whsc-usage__label' );
		await expect( labels.first() ).toBeVisible( LOADED );

		// Unmetered photo searches have nothing to show against a limit, and
		// sites and members are about the account rather than this site's search.
		await expect( labels ).toHaveText( [ 'Searches', 'Indexed documents', 'AI assistant messages' ] );
		await expect( page.locator( '.whsc-usage__count' ).first() ).toHaveText( '270,000 of 300,000' );
	} );

	test( 'says when an allowance is close to its limit, and when it is spent', async ( { page } ) => {
		await mockHealth( page );
		await page.goto( CONNECTION_URL );

		const searches = page.locator( '.whsc-usage__row', { hasText: 'Searches' } );
		const assistant = page.locator( '.whsc-usage__row', { hasText: 'AI assistant messages' } );

		await expect( searches ).toContainText( 'Close to the limit.', LOADED );
		await expect( assistant ).toContainText( 'Spent for this month.' );
		// A spent allowance says so once - not also "close to the limit".
		await expect( assistant ).not.toContainText( 'Close to the limit.' );

		// Three states are three colours: a bar that is fine, one to watch and
		// one that has stopped something must not look alike.
		const fill = ( row ) => row.locator( '.whsc-usage__fill' ).evaluate( ( el ) => window.getComputedStyle( el ).backgroundColor );
		const documents = page.locator( '.whsc-usage__row', { hasText: 'Indexed documents' } );
		const colours = [ await fill( documents ), await fill( searches ), await fill( assistant ) ];

		expect( new Set( colours ).size ).toBe( 3 );

		// And each is a colour: the tones' darkest shades are all but black.
		colours.forEach( ( colour ) => {
			const channels = colour.match( /\d+/g ).slice( 0, 3 ).map( Number );

			expect( Math.max( ...channels ) ).toBeGreaterThanOrEqual( 120 );
		} );
		await expect( page.getByRole( 'img', { name: 'Searches: 90% used' } ) ).toBeVisible();
	} );

	test( 'sits under the connection heading rather than beside it', async ( { page } ) => {
		await mockHealth( page );
		await page.goto( CONNECTION_URL );

		// The card is a section of the connection tab, whose heading is the h2
		// under the page title.
		await expect( page.getByRole( 'heading', { level: 3, name: 'This month' } ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'heading', { level: 2, name: 'Searcio connection' } ) ).toBeVisible();
	} );

	test( 'leaves a gap between everything the connected tab stacks', async ( { page } ) => {
		await mockHealth( page );
		await page.goto( CONNECTION_URL );

		await expect( page.locator( '.whsc-usage__label' ).first() ).toBeVisible( LOADED );

		expect( await touchingInShell( page ) ).toEqual( [] );
	} );

	/**
	 * Disconnecting deletes the site and its index on Searcio, which no
	 * click undoes, so it is asked about in a dialog only its own buttons close.
	 */
	test( 'asks before it disconnects, and does nothing when told not to', async ( { page } ) => {
		let disconnected = false;

		await mockHealth( page );
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/connection/disconnect' ),
			( route ) => {
				disconnected = true;

				return route.fulfill( { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' } );
			}
		);
		await page.goto( CONNECTION_URL );

		await page.getByRole( 'button', { name: 'Disconnect' } ).click( LOADED );

		const dialog = page.getByRole( 'dialog', { name: 'Disconnect from Searcio?' } );

		await expect( dialog ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeVisible();

		// What is lost, what search does meanwhile and what is kept - and the
		// button that goes ahead is named for what it deletes.
		await expect( dialog ).toContainText( 'removes the site from Searcio and permanently deletes its search index there' );
		await expect( dialog ).toContainText( "falls back to WordPress's own search until you connect again and run a sync" );
		await expect( dialog ).toContainText( 'Nothing in WordPress is deleted.' );
		await expect( dialog.getByRole( 'button', { name: 'Disconnect and delete the index' } ) ).toBeVisible();

		await dialog.getByRole( 'button', { name: 'Cancel' } ).click();

		await expect( dialog ).toHaveCount( 0 );
		expect( disconnected ).toBe( false );
	} );

	/**
	 * wp-admin is written in the language of the user's profile, and a browser
	 * is often set to another one. A number then has to follow the screen: a
	 * Persian browser used to put "۲۷۰٬۰۰۰ of ۳۰۰٬۰۰۰" into the English sentence.
	 * The suite itself runs in `en-US`, the one browser that cannot show this.
	 */
	test.describe( 'in a browser set to another language than the screen', () => {
		test.use( { locale: 'fa-IR' } );

		test( 'writes its numbers in the language of the screen', async ( { page } ) => {
			await mockHealth( page );
			await page.goto( CONNECTION_URL );

			const count = page.locator( '.whsc-usage__count' ).first();

			await expect( count ).toBeVisible( LOADED );

			// The browser is the Persian one this is about, and the screen is not.
			expect( await page.evaluate( () => ( 270000 ).toLocaleString() ) ).toBe( '۲۷۰٬۰۰۰' );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', /^en/ );

			await expect( count ).toHaveText( '270,000 of 300,000' );
			await expect(
				page.locator( '[class*="__notice"]' ).filter( { hasText: 'documents indexed' } )
			).toContainText( 'Connected - 96 / 300,000 documents indexed.' );
		} );
	} );
} );

test.describe( 'Connection tab before the site is connected', () => {
	test.beforeAll( () => {
		setConnected( false );
	} );

	/**
	 * The explainer sends its reader to a control on the tab behind it, so it
	 * has to call that control what the tab calls it.
	 */
	test( 'explains connecting with the label the email link has', async ( { page } ) => {
		// The legal links are a real round trip to Searcio otherwise.
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/connection/legal' ),
			( route ) => route.fulfill( { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' } )
		);
		await page.goto( CONNECTION_URL );

		await expect( page.getByRole( 'button', { name: 'Not this email?' } ) ).toBeVisible( LOADED );

		await page.getByRole( 'button', { name: 'How connecting works' } ).click();

		await expect( page.getByRole( 'dialog', { name: 'How connecting to Searcio works' } ) )
			.toContainText( 'under "Not this email?"' );
	} );
} );
