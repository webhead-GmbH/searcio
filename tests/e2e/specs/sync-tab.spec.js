/**
 * The Sync tab while a run is active. Runs authenticated as admin (the default
 * storage state) and mocks the plugin's own `/sync/status`, so the two states
 * of a run that somebody has to understand at a glance are on screen without
 * a sync being started: a run that is waiting to send a batch again, and a
 * run that is paused.
 *
 * What the engine does in those states is the integration suite's to prove
 * (`Sync_Retry_Test`); this pins what the tab says about them.
 */

import { test, expect, touchingInShell } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=sync';

// A notice is also read out, through a live region that holds the same words
// outside the screen. What is asserted is what is drawn on it.
const RUN_CARD = '#webhead-search-cloud-root .whsc-sync-run';

const RUN = {
	id: 41,
	status: 'running',
	trigger: 'scheduled',
	triggered_by: null,
	force: false,
	phase: 'product',
	cursor: { phase: 'index', type_index: 0, last_id: 400, retries: 0 },
	total_estimated: 1200,
	processed: 400,
	pushed: 380,
	skipped: 20,
	language_skipped: 0,
	deleted: 0,
	failed_count: 0,
	started_at: '2026-10-06T03:00:00+00:00',
	finished_at: null,
	last_error: null,
	created_at: '2026-10-06T03:00:00+00:00',
	updated_at: '2026-10-06T03:02:00+00:00',
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          run  What differs from {@see RUN}.
 */
async function mockActiveRun( page, run ) {
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/webhead-search-cloud/v1/sync/status' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { configured: true, indexable: [ 'product' ], active: { ...RUN, ...run } } ),
			} )
	);
}

/**
 * The notice that carries the given words. Its intent is only in its class,
 * which the component writes as `…__is-<intent>`.
 *
 * @param {import('@playwright/test').Locator} run
 * @param {string|RegExp}                      words
 */
function notice( run, words ) {
	return run.locator( '[class*="__notice"]' ).filter( { hasText: words } );
}

test.describe( 'Sync tab', () => {
	test( 'says when a run that could not write tries again, and leaves it running', async ( { page } ) => {
		const waiting = 'Could not reach Search Cloud. The sync tries again in 2 mins.';

		await mockActiveRun( page, {
			cursor: { ...RUN.cursor, retries: 2 },
			last_error: waiting,
		} );
		await page.goto( SETTINGS_URL );

		const run = page.locator( RUN_CARD );

		await expect( run.getByText( 'Running', { exact: true } ) ).toBeVisible();
		await expect( notice( run, waiting ) ).toBeVisible();

		// The run is not broken, it is waiting: a warning, not an error.
		await expect( notice( run, waiting ) ).toHaveClass( /is-warning/ );

		// It goes on by itself: there is nothing to resume, and it can still be
		// paused or cancelled.
		await expect( run.getByRole( 'button', { name: 'Resume' } ) ).toHaveCount( 0 );
		await expect( run.getByRole( 'button', { name: 'Pause' } ) ).toBeVisible();
		await expect( run.getByRole( 'button', { name: 'Cancel' } ) ).toBeVisible();
		await expect( run.getByText( /While a sync is paused/ ) ).toHaveCount( 0 );

		expect( await touchingInShell( page ) ).toEqual( [] );
	} );

	test( 'says what a pause costs and when it ends', async ( { page } ) => {
		await mockActiveRun( page, { status: 'paused' } );
		await page.goto( SETTINGS_URL );

		const run = page.locator( RUN_CARD );
		const hint = notice( run, /changes in your shop are not sent to Search Cloud/ );

		await expect( run.getByText( 'Paused', { exact: true } ) ).toBeVisible();
		await expect( hint ).toBeVisible();
		await expect( hint ).toContainText( 'The next scheduled sync continues it' );
		await expect( hint ).toHaveClass( /is-info/ );
		await expect( run.getByRole( 'button', { name: 'Resume' } ) ).toBeVisible();
		await expect( run.getByRole( 'button', { name: 'Pause' } ) ).toHaveCount( 0 );

		expect( await touchingInShell( page ) ).toEqual( [] );
	} );

	test( 'keeps the error of a run that is not trying again an error', async ( { page } ) => {
		const failed = 'Could not remove product-12 from the index (HTTP 500).';

		await mockActiveRun( page, { status: 'paused', last_error: failed } );
		await page.goto( SETTINGS_URL );

		const run = page.locator( RUN_CARD );

		await expect( notice( run, failed ) ).toBeVisible();
		await expect( notice( run, failed ) ).toHaveClass( /is-error/ );
		await expect( notice( run, /The next scheduled sync continues it/ ) ).toBeVisible();

		expect( await touchingInShell( page ) ).toEqual( [] );
	} );
} );
