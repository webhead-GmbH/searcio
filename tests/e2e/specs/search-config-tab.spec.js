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

import { test, expect, setConnected, touchingInShell } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=search-config';

// A notice is also read out, through a live region that holds the same words
// outside the screen. What is asserted is what is drawn on it.
const SCREEN = '#webhead-search-cloud-root';

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
			filter_field: 'categories',
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

/**
 * The fields a product catalogue with tags, stock, prices and a colour
 * attribute is indexed with - the names `Woo::TOGGLE_FIELDS` writes, which is
 * not always the toggle's own name (`tags` writes `product_tags`).
 */
const INDEXED_FIELDS = [
	'title',
	'content',
	'type',
	'url',
	'price',
	'price_min',
	'price_max',
	'product_type',
	'on_sale',
	'stock_status',
	'in_stock',
	'categories',
	'product_tags',
	'attr_color',
];

/**
 * A fixed `/indexing/config` catalogue, so what the tab suggests does not
 * depend on how the test site's Indexing tab happens to be set up. What the
 * list contains for a given mapping is the integration suite's to prove
 * (`Index_Config_Test`, `Woo_Test`); this pins what the tab does with it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>}                   indexedFields The catalogue's `indexed_fields`.
 */
async function mockCatalog( page, indexedFields = INDEXED_FIELDS ) {
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/indexing/config' ),
		( route ) =>
			route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( {
					post_types: [
						{
							slug: 'product',
							label: 'Products',
							is_product: true,
							taxonomies: [],
							config: { enabled: true, type: 'product', fields: [] },
						},
					],
					sources: [],
					woo: { active: true, attributes: [ { slug: 'pa_color', label: 'Color' } ] },
					languages: { active: false, available: [] },
					indexed_fields: indexedFields,
					config_version: 1,
				} ),
			} )
	);
}

/**
 * The Search Config card whose title is `title`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          title The card's heading.
 */
const card = ( page, title ) =>
	page.locator( '.whsc-settings-card' ).filter( { has: page.getByRole( 'heading', { name: title, exact: true } ) } );

/**
 * Intercept the plugin's own REST proxy, capturing anything it PUTs back.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array}                           sent   Receives each write's method and body.
 * @param {Object}                          config The `/search-config` response.
 */
async function mockSearchConfig( page, sent = [], config = CONFIG ) {
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
				body: JSON.stringify( config ),
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

	test( 'leaves a gap between everything it stacks', async ( { page } ) => {
		await mockSearchConfig( page, [], { ...CONFIG, facet_fields: [ 'categories', 'category' ] } );
		await mockCatalog( page );
		await page.goto( SETTINGS_URL );

		// With a warning under a token field, which is a second child of a card.
		await expect( page.locator( '.whsc-unindexed-fields' ).first() ).toBeVisible( LOADED );

		expect( await touchingInShell( page ) ).toEqual( [] );
	} );

	/**
	 * With no configuration there is nothing to draw. The reason used to be set
	 * on a notice the placeholder never made room for, so the tab stayed a
	 * placeholder for good.
	 */
	test( 'says why the configuration did not load, and asks again when told to', async ( { page } ) => {
		let fail = true;

		await mockSearchConfig( page );
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/search-config' ),
			( route ) => {
				if ( ! fail ) {
					return route.fallback();
				}

				return route.fulfill( {
					status: 502,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { code: 'upstream', message: 'Search Cloud did not answer.' } ),
				} );
			}
		);
		await page.goto( SETTINGS_URL );

		await expect(
			page.locator( SCREEN ).getByText( 'The search configuration could not be loaded: Search Cloud did not answer.' )
		).toBeVisible( LOADED );

		fail = false;
		await page.getByRole( 'button', { name: 'Try again' } ).click();

		await expect( page.locator( '.whsc-redirect-rule' ).first() ).toBeVisible( LOADED );
	} );

	/**
	 * One notice beside the button that failed, with the reason the API gave,
	 * and no toast over it saying the same thing in fewer words.
	 */
	test( 'reports a save that failed beside the Save button, with the reason', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/search-config' ),
			( route ) => {
				if ( 'GET' === route.request().method() ) {
					return route.fallback();
				}

				return route.fulfill( {
					status: 422,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { code: 'invalid', message: 'A redirect needs a URL.' } ),
				} );
			}
		);
		await page.goto( SETTINGS_URL );

		const rule = page.locator( '.whsc-redirect-rule' ).first();

		await expect( rule ).toBeVisible( LOADED );
		await rule.locator( 'input' ).nth( 1 ).fill( 'https://example.test/other' );
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();

		await expect(
			page.locator( SCREEN ).getByText( 'The search configuration could not be saved: A redirect needs a URL.' )
		).toBeVisible();
		await expect( page.getByText( 'Search configuration saved.' ) ).toHaveCount( 0 );
		// What was typed is still there to be corrected.
		await expect( rule.locator( 'input' ).nth( 1 ) ).toHaveValue( 'https://example.test/other' );
	} );

	/**
	 * The delete stands level with the fields beside it, which begin one label
	 * below the top of the row. On a phone the row is a column instead.
	 */
	test( 'keeps a redirect\'s delete level with its fields', async ( { page } ) => {
		test.skip( page.viewportSize().width <= 782, 'A redirect is stacked on a narrow screen.' );

		await mockSearchConfig( page );
		await page.goto( SETTINGS_URL );

		const rule = page.locator( '.whsc-redirect-rule' ).first();

		await expect( rule ).toBeVisible( LOADED );

		const remove = await rule.getByRole( 'button', { name: 'Remove redirect' } ).boundingBox();
		const field = await rule.locator( 'input' ).first().boundingBox();

		expect( Math.abs( remove.y - field.y ) ).toBeLessThanOrEqual( 2 );
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
		await expect( rule.getByLabel( /Also require filter/i ) ).toHaveValue( 'categories' );
		await expect( rule.getByLabel( /Filter value/i ) ).toHaveValue( 'shoes' );
	} );

	test( 'offers the photo-search switch beside the other AI switches', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( SETTINGS_URL );

		const toggle = page.getByRole( 'checkbox', { name: 'Search by photo', exact: true } );
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

	/**
	 * The suggestions used to be a hand-kept list in the tab that offered
	 * `tags` (never written - the field is `product_tags`) and left out
	 * `in_stock`, `on_sale`, the price range and every attribute.
	 */
	test( 'suggests exactly the fields the site indexes', async ( { page } ) => {
		await mockSearchConfig( page );
		await mockCatalog( page );
		await page.goto( SETTINGS_URL );

		const facets = page.getByRole( 'combobox', { name: 'Facet fields' } );
		await expect( facets ).toBeVisible( LOADED );
		await facets.click();

		const options = page.getByRole( 'listbox' ).getByRole( 'option' );
		await expect( options ).toHaveText( INDEXED_FIELDS );
		await expect( options.filter( { hasText: /^tags$/ } ) ).toHaveCount( 0 );
		await expect( options.filter( { hasText: /^category$/ } ) ).toHaveCount( 0 );
	} );

	/**
	 * The dev-site failure: a facet on `category` - a field no document has,
	 * since the indexer writes `categories` - was accepted and stayed empty.
	 */
	test( 'warns about a facet field no document has, until it is removed', async ( { page } ) => {
		await mockSearchConfig( page, [], { ...CONFIG, facet_fields: [ 'categories', 'category' ] } );
		await mockCatalog( page );
		await page.goto( SETTINGS_URL );

		const facetCard = card( page, 'Facet fields' );
		const warning = facetCard.locator( '.whsc-unindexed-fields' );

		await expect( warning ).toBeVisible( LOADED );
		await expect( warning ).toContainText( 'No document on this site has a "category" field' );
		await expect( warning ).not.toContainText( '"categories"' );

		// The suggest fields (`title`) are all indexed, so that card stays quiet.
		await expect( card( page, 'Suggest fields' ).locator( '.whsc-unindexed-fields' ) ).toHaveCount( 0 );

		// Backspace in an empty token input removes the last token.
		await facetCard.getByRole( 'combobox', { name: 'Facet fields' } ).click();
		await page.keyboard.press( 'Backspace' );

		await expect( warning ).toHaveCount( 0 );
	} );

	test( 'warns about every unindexed suggest field at once', async ( { page } ) => {
		await mockSearchConfig( page, [], { ...CONFIG, suggest_fields: [ 'title', 'tags', 'brand' ] } );
		await mockCatalog( page );
		await page.goto( SETTINGS_URL );

		const warning = card( page, 'Suggest fields' ).locator( '.whsc-unindexed-fields' );

		await expect( warning ).toBeVisible( LOADED );
		await expect( warning ).toContainText( 'No document on this site has the fields "tags", "brand"' );
	} );

	/**
	 * Unmocked catalogue: whatever the test site indexes, the tab offers that
	 * list and nothing else. This is the one place the PHP list and the React
	 * tab meet, so a renamed key on either side fails here.
	 */
	test( 'offers the list the site\'s own catalogue reports', async ( { page } ) => {
		let reported;

		await mockSearchConfig( page );
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/indexing/config' ),
			async ( route ) => {
				const response = await route.fetch();
				reported = ( await response.json() ).indexed_fields;

				await route.fulfill( { response } );
			}
		);
		await page.goto( SETTINGS_URL );

		await expect( page.getByRole( 'combobox', { name: 'Facet fields' } ) ).toBeVisible( LOADED );
		expect( Array.isArray( reported ) ).toBe( true );

		const offered = await page
			.locator( '#whsc-field-suggestions option' )
			.evaluateAll( ( nodes ) => nodes.map( ( node ) => node.value ) );

		expect( offered ).toEqual( reported );
	} );
} );
