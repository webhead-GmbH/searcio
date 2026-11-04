/**
 * The way from the plugin to the site's search statistics, which Searcio's
 * dashboard draws: an action in the settings header on every tab, and a link
 * under the allowances on the Connection tab. Runs as admin with dummy
 * credentials, so the page reports as connected, and mocks the health check.
 */

import { test, expect, setConnected } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud';
const STATISTICS_URL = 'https://dashboard.example.test/acme/sites/7';
const UPGRADE_URL = 'https://billing.example.test/upgrade';

/** The plugin's own health check, answered with the plan and the statistics page given. */
async function mockHealth( page, answer ) {
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/connection/test' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { ok: true, status: 200, ...answer } ),
			} )
	);
}

/** `window.open` recorded rather than followed: the dashboard is not this site. */
const recordOpens = ( page ) => page.addInitScript( () => {
	window.whscOpened = [];
	window.open = ( ...args ) => {
		window.whscOpened.push( args );

		return null;
	};
} );

test.describe( 'Search statistics', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'the header opens the site\'s statistics in a new tab, beside the upgrade', async ( { page } ) => {
		await recordOpens( page );
		await mockHealth( page, { plan: { is_free: true, name: 'Free', upgrade_url: UPGRADE_URL }, statistics_url: STATISTICS_URL } );
		await page.goto( SETTINGS_URL );

		const header = page.locator( '.webhead-search-cloud-admin-page__header' );
		const action = header.getByRole( 'button', { name: 'Search statistics' } );

		// The first of the two is drawn outlined; the upgrade stays the solid one.
		await expect( header.getByRole( 'button', { name: 'Upgrade plan' } ) ).toHaveClass( /__action--solid/ );
		await expect( action ).toHaveClass( /__action--outline/ );

		// Once the health check has named the site's page, that is where it goes.
		await expect.poll( async () => {
			await action.click();

			return page.evaluate( () => window.whscOpened.at( -1 ) );
		} ).toEqual( [ STATISTICS_URL, '_blank', 'noopener,noreferrer' ] );
	} );

	test( 'a paid plan has the statistics alone, and a service that names no page sends it to the dashboard', async ( { page } ) => {
		await recordOpens( page );
		await mockHealth( page, { plan: { is_free: false, name: 'Starter', upgrade_url: UPGRADE_URL } } );
		await page.goto( SETTINGS_URL );

		const header = page.locator( '.webhead-search-cloud-admin-page__header' );

		await expect( page.getByRole( 'tablist' ) ).toBeVisible();
		await expect( header.getByRole( 'button', { name: 'Upgrade plan' } ) ).toHaveCount( 0 );

		await header.getByRole( 'button', { name: 'Search statistics' } ).click();

		const opened = await page.evaluate( () => window.whscOpened );

		expect( opened.at( -1 )[ 0 ] ).toMatch( /\/login$/ );
	} );

	test( 'the Connection tab links to them under the allowances', async ( { page } ) => {
		await mockHealth( page, {
			plan: { is_free: false, name: 'Starter' },
			statistics_url: STATISTICS_URL,
			usage: { searches: { used: 1200, limit: 10000, percent: 12, near_limit: false, exceeded: false } },
		} );
		await page.goto( `${ SETTINGS_URL }&tab=connection` );

		const link = page.getByRole( 'link', { name: /See what visitors searched for/ } );

		await expect( link ).toBeVisible();
		await expect( link ).toHaveAttribute( 'href', STATISTICS_URL );
		await expect( link ).toHaveAttribute( 'target', '_blank' );
	} );
} );
