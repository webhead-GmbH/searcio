/**
 * The Search Config tab. Runs authenticated as admin (the default storage
 * state) and mocks the plugin's own `/search-config` proxy so the sections the
 * API added — redirects, merchandising's category trigger, the photo-search
 * switch — are deterministic.
 *
 * The point of pinning these in a browser rather than only in the mapping unit
 * tests: the tab is the only writer of these sections, so a control that never
 * renders is indistinguishable from a feature that does not exist.
 */

import { test, expect, setConnected } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=search-config';

const CONFIG = {
	searchable_fields: [ { field: 'title', weight: 5 } ],
	type_boosts: [],
	facet_fields: [ 'brand' ],
	suggest_fields: [ 'title' ],
	synonyms: [],
	languages: [],
	merchandising: [
		{
			query: 'winter',
			filter_field: 'category',
			filter_value: 'shoes',
			pinned: [ 'p-100' ],
			hidden: [],
			banner: 'Shoe sale',
		},
	],
	redirects: [ { query: 'black friday', url: 'https://example.test/bf' } ],
	features: {
		ai_search: { available: true, enabled: true, status: 'ready' },
		visual_tagging: { available: true, enabled: false },
		visual_search: { available: true, enabled: false },
		personalization: { available: true, enabled: true },
	},
};

// The tab loads its configuration, the indexing catalogue and a connection test
// before it renders anything, and the connection test is a real round trip to
// Search Cloud - slow to fail against dummy credentials. Give the first
// assertion room rather than racing it.
const LOADED = { timeout: 20000 };

/** Intercept the plugin's own REST proxy, capturing anything it PUTs back. */
async function mockSearchConfig( page, sent = [] ) {
	// Answered locally so the tab is not waiting on a doomed outbound request.
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/connection/test' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { ok: true, status: 200, languages: { limit: null } } ),
			} )
	);

	await page.route(
		// Decode first: with plain permalinks apiFetch hits `?rest_route=…`.
		( url ) => decodeURIComponent( url.href ).includes( '/search-config' ),
		( route ) => {
			// Record by "not a read" rather than by method: apiFetch may tunnel a
			// PUT as a POST carrying X-HTTP-Method-Override on some hosts, and the
			// payload is what this test is about either way.
			if ( 'GET' !== route.request().method() ) {
				sent.push( { method: route.request().method(), body: route.request().postDataJSON() } );
			}

			return route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( CONFIG ),
			} );
		}
	);
}

test.describe( 'Search Config tab', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'shows the redirect rules the site has configured', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( SETTINGS_URL );

		const rule = page.locator( '.whsc-redirect-rule' ).first();
		await expect( rule ).toBeVisible( LOADED );
		await expect( rule.locator( 'input' ).first() ).toHaveValue( 'black friday' );
		await expect( rule.locator( 'input' ).nth( 1 ) ).toHaveValue( 'https://example.test/bf' );
	} );

	test( 'shows a merchandising rule\'s category trigger', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( SETTINGS_URL );

		const rule = page.locator( '.whsc-merchandising-rule' ).first();
		await expect( rule ).toBeVisible( LOADED );
		await expect( rule.getByLabel( /Also require filter/i ) ).toHaveValue( 'category' );
		await expect( rule.getByLabel( /Filter value/i ) ).toHaveValue( 'shoes' );
	} );

	test( 'offers the photo-search switch beside the other AI switches', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( SETTINGS_URL );

		const toggle = page.getByLabel( 'Search by photo', { exact: true } );
		await expect( toggle ).toBeVisible( LOADED );
		await expect( toggle ).not.toBeChecked();
	} );

	/**
	 * The half-written cases are the ones worth proving, because the API drops
	 * them silently rather than rejecting them — so a form that sent one would
	 * show a row that vanished on the next read.
	 */
	test( 'drops an untouched redirect row and an unpaired category trigger on save', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent );
		await page.goto( SETTINGS_URL );

		await expect( page.locator( '.whsc-redirect-rule' ).first() ).toBeVisible( LOADED );

		// Add an empty redirect row, and half a category trigger.
		await page.getByRole( 'button', { name: 'Add a redirect' } ).click();
		await page
			.locator( '.whsc-merchandising-rule' )
			.first()
			.getByLabel( /Filter value/i )
			.fill( '' );

		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		const payload = sent[ sent.length - 1 ].body;

		expect( payload.redirects ).toEqual( [ { query: 'black friday', url: 'https://example.test/bf' } ] );
		expect( payload.merchandising[ 0 ].filter_field ).toBeNull();
		expect( payload.merchandising[ 0 ].filter_value ).toBeNull();
	} );
} );
