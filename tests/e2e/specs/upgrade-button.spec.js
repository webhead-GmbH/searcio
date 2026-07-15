/**
 * The settings-header "Upgrade plan" CTA. Runs authenticated as admin (the
 * default storage state — not overridden here), stores dummy credentials so the
 * page reports as connected, and mocks the health check so the plan tier is
 * deterministic. Verifies the button only appears on a Free plan, is actually
 * purple, and deep-links to the billing URL.
 */

import { test, expect, setConnected } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud';
const UPGRADE_URL = 'https://billing.example.test/upgrade';

/** Mock the plugin's own health check so `plan` is deterministic. */
async function mockPlan( page, plan ) {
	await page.route(
		// Decode first: with plain permalinks apiFetch hits `?rest_route=…` where
		// the slashes are percent-encoded (`%2Fconnection%2Ftest`).
		( url ) => decodeURIComponent( url.href ).includes( '/connection/test' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { ok: true, status: 200, plan } ),
			} )
	);
}

test.describe( 'Header upgrade CTA', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'shows a purple upgrade button that deep-links to billing on a Free plan', async ( { page } ) => {
		await mockPlan( page, { is_free: true, name: 'Free', upgrade_url: UPGRADE_URL } );
		await page.goto( SETTINGS_URL );

		const button = page.locator( '.whsc-upgrade-button' );
		await expect( button ).toBeVisible();
		await expect( button ).toContainText( 'Upgrade plan' );
		await expect( button ).toHaveAttribute( 'href', UPGRADE_URL );
		await expect( button ).toHaveAttribute( 'target', '_blank' );

		// Actually purple (violet-600 = rgb(124, 58, 237)), not the theme green.
		const background = await button.evaluate( ( el ) => window.getComputedStyle( el ).backgroundColor );
		expect( background ).toBe( 'rgb(124, 58, 237)' );
	} );

	test( 'hides the upgrade button on a paid plan', async ( { page } ) => {
		await mockPlan( page, { is_free: false, name: 'Starter', upgrade_url: UPGRADE_URL } );
		await page.goto( SETTINGS_URL );

		await expect( page.locator( '.whsc-settings-panel-header' ) ).toBeVisible();
		await expect( page.locator( '.whsc-upgrade-button' ) ).toHaveCount( 0 );
	} );
} );
