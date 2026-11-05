/**
 * The General tab is built from the settings schema, which loads after the
 * page does. Both defects pinned here only show in a browser: a link to the
 * tab was sent to Sync before the tab could exist, and each field printed its
 * label and description twice - once in the card header, once on the control.
 */

import { test, expect, setConnected, setPlanTier } from '../utils';

const GENERAL_URL = '/wp-admin/admin.php?page=searcio&tab=general';

// The tab waits on the settings REST response before it can render.
const LOADED = { timeout: 30000 };

test.describe( 'General settings tab', () => {
	test( 'opens from a link instead of falling back to Sync', async ( { page } ) => {
		await page.goto( GENERAL_URL );

		await expect( page.getByRole( 'tab', { name: 'General' } ) ).toHaveAttribute( 'aria-selected', 'true', LOADED );
		await expect( page ).toHaveURL( /[?&]tab=general\b/ );
	} );

	test( 'names each setting once, and still names its control', async ( { page } ) => {
		await page.goto( GENERAL_URL );

		// Each description used to appear twice - under the card title and again
		// under the control. The controls keep a visually hidden label (which
		// Playwright counts as visible, being 1px), so the description is the
		// honest measure: it now exists once, with no hidden copy.
		const history = page.getByText( 'How long finished sync runs are kept. Use 0 to keep them forever.', { exact: true } );
		await expect( history.first() ).toBeVisible( LOADED );
		await expect( history ).toHaveCount( 1 );
		await expect(
			page.getByText( 'When enabled, deleting this plugin also removes its settings', { exact: false } )
		).toHaveCount( 1 );

		// Written once is not the same as unnamed: both controls still carry the
		// field's name for assistive tech.
		await expect( page.getByRole( 'spinbutton', { name: 'Keep history for (days)' } ) ).toBeVisible();
		await expect( page.getByRole( 'checkbox', { name: 'Delete plugin data on uninstall' } ) ).toBeAttached();
	} );
} );

/**
 * The connection check the card asks for the plan, answered here.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          plan
 */
async function mockPlan( page, plan ) {
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/connection/test' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { ok: true, status: 200, plan } ),
			} )
	);
}

/**
 * Support Searcio: the Searcio logo in the search window. Off until the shop
 * turns it on, and a Free plan neither forces it on nor locks the switch: a
 * credit on the shop's pages is the shop's choice.
 */
test.describe( 'Support Searcio', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		setConnected( false );
		setPlanTier( 'clear' );
		await requestUtils.rest( {
			path: '/searcio/v1/settings',
			method: 'POST',
			data: { settings: { support_searcio: false } },
		} );
	} );

	const card = ( page ) => page.locator( '.whsc-settings-card' ).filter( { has: page.getByRole( 'heading', { name: 'Support Searcio' } ) } );
	const toggle = ( page ) => card( page ).getByRole( 'checkbox', { name: 'Show the Searcio logo in the search window' } );

	for ( const plan of [ { is_free: true, name: 'Free', upgrade_url: 'https://searcio.example/billing' }, { is_free: false, name: 'Pro', upgrade_url: '' } ] ) {
		test( `on the ${ plan.name } plan the logo is off until it is turned on, and both stay`, async ( { page, requestUtils } ) => {
			setPlanTier( plan.is_free ? 'free' : 'paid' );
			await requestUtils.rest( {
				path: '/searcio/v1/settings',
				method: 'POST',
				data: { settings: { support_searcio: false } },
			} );
			await mockPlan( page, plan );
			await page.goto( GENERAL_URL );

			await expect( toggle( page ) ).not.toBeChecked( LOADED );
			await expect( toggle( page ) ).toBeEnabled();
			await expect( card( page ).getByRole( 'link', { name: 'Upgrade plan' } ) ).toHaveCount( 0 );

			await toggle( page ).click();
			await page.getByRole( 'button', { name: 'Save Settings' } ).click();
			await expect( page.getByRole( 'button', { name: 'Save Settings' } ) ).toBeDisabled( LOADED );
			await page.reload();
			await expect( toggle( page ) ).toBeChecked( LOADED );

			await toggle( page ).click();
			await page.getByRole( 'button', { name: 'Save Settings' } ).click();
			await expect( page.getByRole( 'button', { name: 'Save Settings' } ) ).toBeDisabled( LOADED );
			await page.reload();
			await expect( toggle( page ) ).not.toBeChecked( LOADED );
		} );
	}
} );
