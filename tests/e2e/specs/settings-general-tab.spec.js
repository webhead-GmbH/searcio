/**
 * The General tab is built from the settings schema, which loads after the
 * page does. Both defects pinned here only show in a browser: a link to the
 * tab was sent to Sync before the tab could exist, and each field printed its
 * label and description twice - once in the card header, once on the control.
 */

import { test, expect } from '../utils';

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
