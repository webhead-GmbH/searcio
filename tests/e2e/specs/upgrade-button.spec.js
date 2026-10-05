/**
 * The settings header's "Upgrade plan" action. Runs authenticated as admin (the
 * default storage state — not overridden here), stores dummy credentials so the
 * page reports as connected, and mocks the health check so the plan tier is
 * deterministic. Verifies the action only appears on a Free plan, is drawn by
 * the page shell like any other header action, and opens the billing URL.
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

test.describe( 'Header upgrade action', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'offers an upgrade that opens billing in a new tab on a Free plan', async ( { page } ) => {
		// Recorded rather than followed: the billing page is not this site's.
		await page.addInitScript( () => {
			window.whscOpened = [];
			window.open = ( ...args ) => {
				window.whscOpened.push( args );

				return null;
			};
		} );
		await mockPlan( page, { is_free: true, name: 'Free', upgrade_url: UPGRADE_URL } );
		await page.goto( SETTINGS_URL );

		const action = page
			.locator( '.webhead-search-cloud-admin-page__header' )
			.getByRole( 'button', { name: 'Upgrade plan' } );

		await expect( action ).toBeVisible();
		await action.click();

		const opened = await page.evaluate( () => window.whscOpened );

		expect( opened ).toHaveLength( 1 );
		expect( opened[ 0 ][ 0 ] ).toBe( UPGRADE_URL );
		expect( opened[ 0 ][ 1 ] ).toBe( '_blank' );
		expect( opened[ 0 ][ 2 ] ).toContain( 'noopener' );
	} );

	/**
	 * The stylesheet of `@wordpress/components` is WordPress's own, so it is as
	 * old as the WordPress the site runs, and two releases do not draw a button
	 * the same way: 7.1 gives it a border and draws focus as an outline, the
	 * releases before draw both as shadows. The shell's header buttons state
	 * both, and this runs on whatever WordPress the test site has.
	 */
	test( 'draws a ring round the action, and one more when it has focus', async ( { page } ) => {
		await mockPlan( page, { is_free: true, name: 'Free', upgrade_url: UPGRADE_URL } );
		await page.goto( SETTINGS_URL );

		const action = page.locator( '.webhead-search-cloud-admin-page__action--outline' ).first();

		await expect( action ).toBeVisible();

		const ring = () => action.evaluate( ( element ) => {
			const style = window.getComputedStyle( element );

			return {
				border: `${ style.borderTopWidth } ${ style.borderTopStyle } ${ style.borderTopColor }`,
				outline: `${ style.outlineStyle } ${ style.outlineColor }`,
				outlineWidth: parseFloat( style.outlineWidth ),
				shadow: style.boxShadow,
			};
		} );

		expect( ( await ring() ).border ).toBe( '1px solid rgb(255, 255, 255)' );

		// From the keyboard: a ring is drawn for the keyboard and not for a script.
		await action.focus();
		await page.keyboard.press( 'Tab' );
		await page.keyboard.press( 'Shift+Tab' );

		const focused = await ring();
		// The ring is as wide as the design system's focus token, which is 2px
		// and 1.5px on a dense screen, where the browser draws it on whole
		// device pixels and reports the width it drew.
		const tokenWidth = await page.evaluate( () => {
			const probe = document.createElement( 'div' );

			probe.style.cssText = 'position:absolute;width:var(--wpds-border-width-focus)';
			document.querySelector( '.webhead-search-cloud-admin-page' ).append( probe );

			const width = probe.getBoundingClientRect().width;

			probe.remove();

			return width;
		} );

		expect( tokenWidth ).toBeGreaterThanOrEqual( 1.5 );
		expect( focused.outline ).toBe( 'solid rgb(255, 255, 255)' );
		expect( focused.outlineWidth ).toBeGreaterThanOrEqual( Math.floor( tokenWidth ) );
		// One ring, not a second one in the accent under it.
		expect( focused.shadow ).toBe( 'none' );
		expect( focused.border ).toBe( '1px solid rgb(255, 255, 255)' );
	} );

	test( 'offers no upgrade on a paid plan', async ( { page } ) => {
		await mockPlan( page, { is_free: false, name: 'Starter', upgrade_url: UPGRADE_URL } );
		await page.goto( SETTINGS_URL );

		const header = page.locator( '.webhead-search-cloud-admin-page__header' );

		await expect( header ).toBeVisible();
		// The tabs are drawn after the health check has had its chance to add one.
		await expect( page.getByRole( 'tablist' ) ).toBeVisible();
		await expect( header.getByRole( 'button', { name: 'Upgrade plan' } ) ).toHaveCount( 0 );
	} );
} );
