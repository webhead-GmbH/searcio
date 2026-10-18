/**
 * The General tab is built from the settings schema, which loads after the
 * page does. Both defects pinned here only show in a browser: a link to the
 * tab was sent to Sync before the tab could exist, and each field printed its
 * label and description twice - once in the card header, once on the control.
 */

import { test, expect, setConnected, setPlanTier } from '../utils';

const GENERAL_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=general';

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
 * Support Searcio: the searcio logo in the search window. A paid plan can turn
 * it off, and saves it with the rest of the tab; a Free plan always shows it,
 * so its switch is on, cannot be moved, and the card says why.
 */
test.describe( 'Support Searcio', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		setConnected( false );
		setPlanTier( 'clear' );
		await requestUtils.rest( {
			path: '/webhead-search-cloud/v1/settings',
			method: 'POST',
			data: { settings: { support_searcio: true } },
		} );
	} );

	const card = ( page ) => page.locator( '.whsc-settings-card' ).filter( { has: page.getByRole( 'heading', { name: 'Support Searcio' } ) } );
	const toggle = ( page ) => card( page ).getByRole( 'checkbox', { name: 'Show the searcio logo in the search window' } );

	test( 'a paid plan turns the logo off, and it stays off', async ( { page } ) => {
		await mockPlan( page, { is_free: false, name: 'Pro', upgrade_url: '' } );
		await page.goto( GENERAL_URL );

		await expect( toggle( page ) ).toBeChecked( LOADED );
		await expect( toggle( page ) ).toBeEnabled();

		await toggle( page ).click();
		await expect( toggle( page ) ).not.toBeChecked();
		await page.getByRole( 'button', { name: 'Save Settings' } ).click();
		await expect( page.getByRole( 'button', { name: 'Save Settings' } ) ).toBeDisabled( LOADED );

		await page.reload();
		await expect( toggle( page ) ).not.toBeChecked( LOADED );
	} );

	test( 'a Free plan keeps it on and says why, whatever was saved', async ( { page, requestUtils } ) => {
		setPlanTier( 'free' );
		await requestUtils.rest( {
			path: '/webhead-search-cloud/v1/settings',
			method: 'POST',
			data: { settings: { support_searcio: false } },
		} );
		await mockPlan( page, { is_free: true, name: 'Free', upgrade_url: 'https://searcio.example/billing' } );
		await page.goto( GENERAL_URL );

		await expect( toggle( page ) ).toBeChecked( LOADED );
		await expect( toggle( page ) ).toBeDisabled();
		await expect( card( page ) ).toContainText( 'The Free plan always shows it. On a paid plan you can turn it off.' );
		await expect( card( page ).getByRole( 'link', { name: 'Upgrade plan' } ) ).toHaveAttribute( 'href', 'https://searcio.example/billing' );
	} );
} );
