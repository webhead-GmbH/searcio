/**
 * The Connection tab's "This month" card, drawn from the same health check the
 * connected notice reads. A spent allowance is why a storefront stops returning
 * results, so this is where an admin has to be able to see it.
 *
 * The response below is deliberately awkward: allowances out of order, one the
 * plan does not meter at all, and the two account-wide counts. Each is a rule
 * the card applies, and each can fail on its own.
 */

import { test, expect, setConnected } from '../utils';

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
		await expect( page.getByRole( 'img', { name: 'Searches: 90% used' } ) ).toBeVisible();
	} );

	test( 'sits under the connection heading rather than beside it', async ( { page } ) => {
		await mockHealth( page );
		await page.goto( CONNECTION_URL );

		// The card is nested in the connection card, whose title is the tab's h3.
		await expect( page.getByRole( 'heading', { level: 4, name: 'This month' } ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'heading', { level: 3, name: 'Search Cloud connection' } ) ).toBeVisible();
	} );
} );
