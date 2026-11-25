/**
 * The Search Config tab. Runs authenticated as admin (the default storage
 * state) and mocks the plugin's own `/search-config` proxy so the sections the
 * API added - redirects, merchandising's category trigger, the photo-search
 * switch - are deterministic.
 *
 * The point of pinning these in a browser rather than only in the mapping unit
 * tests: the tab is the only writer of these sections, so a control that never
 * renders is indistinguishable from a feature that does not exist.
 */

import { test, expect, setCategoryFilter, setConnected, touchingInShell } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=searcio&tab=search-config';

/** The tab lists its sections down the side, and draws the one the address names. */
const at = ( section ) => `${ SETTINGS_URL }&section=${ section }`;

/** Opens another section from the list, as a click would. */
const openSection = ( page, name ) => page.getByRole( 'tab', { name: new RegExp( name ) } ).click();

// A notice is also read out, through a live region that holds the same words
// outside the screen. What is asserted is what is drawn on it.
const SCREEN = '#searcio-root';

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

/** The profit ranking as Searcio reports it, switched on, with nothing of its own set. */
const PROFIT_RANKING = { enabled: true, strength: 15, target: 25, min_profit: null, rules: [], excluded_terms: [] };

// The tab loads its configuration, the indexing catalogue and a connection test
// before it renders anything, and the connection test is a real round trip to
// Searcio - slow to fail against dummy credentials. Give the first
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
 * @param {Array<Object>}                   languages     The site's languages, `{ code, name }`; none by default.
 * @param {Object}                          woo           More of the catalogue's `woo` block, such as `prices_with_tax`.
 */
async function mockCatalog( page, indexedFields = INDEXED_FIELDS, languages = [], woo = {} ) {
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
					woo: { active: true, attributes: [ { slug: 'pa_color', label: 'Color' } ], ...woo },
					languages: { active: languages.length > 0, available: languages },
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
 * @param {string}                          title The section's heading.
 */
const card = ( page, title ) =>
	page.locator( '.whsc-placement-section' ).filter( { has: page.getByRole( 'heading', { name: title, exact: true } ) } );

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
		setCategoryFilter( 'clear' );
	} );

	/**
	 * The service answers the categories by count, so the filter showed them
	 * in an order the shop never chose. It is kept in WordPress and saved by
	 * the tab's one Save button.
	 */
	test( 'saves the order of the categories with the tab, the shop\'s own by default', async ( { page } ) => {
		const saved = [];

		await mockSearchConfig( page );
		await page.route(
			( url ) => decodeURIComponent( url.href ).includes( '/searcio/v1/settings' ),
			async ( route ) => {
				if ( 'GET' !== route.request().method() ) {
					saved.push( route.request().postDataJSON() );
				}

				await route.continue();
			}
		);
		await page.goto( at( 'filters' ) );

		const order = card( page, 'Category filter' ).getByRole( 'combobox', { name: 'Order of the categories' } );

		await expect( order ).toHaveText( /As sorted in WooCommerce/, LOADED );

		await order.click();
		await page.getByRole( 'option', { name: 'By name' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => saved.length ).toBeGreaterThan( 0 );

		expect( saved.at( -1 ).settings.category_filter_order ).toBe( 'name' );

		await page.reload();
		await expect( order ).toHaveText( /By name/, LOADED );
	} );

	test( 'leaves a gap between everything it stacks', async ( { page } ) => {
		await mockSearchConfig( page, [], { ...CONFIG, facet_fields: [ 'categories', 'category' ] } );
		await mockCatalog( page );
		await page.goto( at( 'filters' ) );

		// With a warning under a token field, which is a second child of a card.
		await expect( page.locator( '.whsc-unindexed-fields' ).first() ).toBeVisible( LOADED );

		expect( await touchingInShell( page ) ).toEqual( [] );

		// And in every other section of the list: each is drawn on its own.
		for ( const name of [ 'AI & ranking', 'Searchable fields', 'Type boosts', 'Suggestions', 'Synonyms', 'Languages', 'Merchandising rules', 'Search redirects' ] ) {
			const tab = page.getByRole( 'tab', { name: new RegExp( name ) } );

			await tab.click();
			await expect( tab ).toHaveAttribute( 'aria-selected', 'true' );

			expect( await touchingInShell( page ), name ).toEqual( [] );
		}
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
					body: JSON.stringify( { code: 'upstream', message: 'Searcio did not answer.' } ),
				} );
			}
		);
		await page.goto( at( 'redirects' ) );

		await expect(
			page.locator( SCREEN ).getByText( 'The search configuration could not be loaded: Searcio did not answer.' )
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
		await page.goto( at( 'redirects' ) );

		const rule = page.locator( '.whsc-redirect-rule' ).first();

		await expect( rule ).toBeVisible( LOADED );
		await rule.locator( 'input' ).nth( 1 ).fill( 'https://example.test/other' );
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();

		await expect(
			page.locator( SCREEN ).getByText( 'The search configuration could not be saved: A redirect needs a URL.' )
		).toBeVisible();
		await expect( page.locator( '.components-snackbar' ).filter( { hasText: 'Search configuration saved.' } ) ).toHaveCount( 0 );
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
		await page.goto( at( 'redirects' ) );

		const rule = page.locator( '.whsc-redirect-rule' ).first();

		await expect( rule ).toBeVisible( LOADED );

		const remove = await rule.getByRole( 'button', { name: 'Remove redirect' } ).boundingBox();
		const field = await rule.locator( 'input' ).first().boundingBox();

		expect( Math.abs( remove.y - field.y ) ).toBeLessThanOrEqual( 2 );
	} );

	test( 'shows the redirect rules the site has configured', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( at( 'redirects' ) );

		const rule = page.locator( '.whsc-redirect-rule' ).first();
		await expect( rule ).toBeVisible( LOADED );
		await expect( rule.locator( 'input' ).first() ).toHaveValue( 'black friday' );
		await expect( rule.locator( 'input' ).nth( 1 ) ).toHaveValue( 'https://example.test/bf' );
	} );

	test( 'shows a merchandising rule\'s category trigger', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( at( 'merchandising' ) );

		const rule = page.locator( '.whsc-merchandising-rule' ).first();
		await expect( rule ).toBeVisible( LOADED );
		await expect( rule.getByLabel( /Also require filter/i ) ).toHaveValue( 'categories' );
		await expect( rule.getByLabel( /Filter value/i ) ).toHaveValue( 'shoes' );
	} );

	test( 'offers the photo-search switch beside the other AI switches', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( at( 'ai' ) );

		const toggle = page.getByRole( 'checkbox', { name: 'Search by photo', exact: true } );
		await expect( toggle ).toBeVisible( LOADED );
		await expect( toggle ).not.toBeChecked();
	} );

	/**
	 * The index status is live state of the AI search switch, set under its
	 * description. It used to sit at the card's edge, out of line with the
	 * description above it, which starts under the switch's label.
	 */
	test( 'lines up the index status with the AI search switch\'s description', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( at( 'ai' ) );

		const status = page.locator( SCREEN ).getByText( 'Index status: Ready', { exact: true } );
		await expect( status ).toBeVisible( LOADED );

		const description = page.locator( SCREEN ).getByText( /^Searches return hybrid keyword/ );
		const [ under, above ] = await Promise.all( [ status.boundingBox(), description.boundingBox() ] );

		expect( Math.round( under.x ) ).toBe( Math.round( above.x ) );
		expect( under.y ).toBeGreaterThanOrEqual( above.y + above.height );
	} );

	/**
	 * A type boost is a slider named by its content type. It was a "Boost"
	 * slider beside a "Type" caption and the type's name, which stood out of
	 * line with the slider's label and its track.
	 */
	test( 'names each type boost by its content type', async ( { page } ) => {
		await mockSearchConfig( page );
		await mockCatalog( page );
		await page.goto( at( 'boosts' ) );

		const boosts = card( page, 'Type boosts' );
		await expect( boosts.getByRole( 'slider', { name: 'Products', exact: true } ) ).toBeVisible( LOADED );
		await expect( boosts.getByRole( 'spinbutton', { name: 'Products', exact: true } ) ).toBeVisible();
		await expect( boosts.getByText( 'Type', { exact: true } ) ).toHaveCount( 0 );
	} );

	/**
	 * A content type renamed on the Indexing tab ("post" to "artikel") left its
	 * old boost in Searcio's list, and the tab listed it as a row of its own that
	 * moved no result. A neutral one is not kept; another is marked, and can go.
	 */
	test( 'marks the boost of a type no content has any more, and lets it go', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent, { ...CONFIG, type_boosts: [ { type: 'product', boost: 3 }, { type: 'post', boost: 5 }, { type: 'ratgeber', boost: 1 } ] } );
		await mockCatalog( page );
		await page.goto( at( 'boosts' ) );

		const boosts = card( page, 'Type boosts' );

		await expect( boosts.getByRole( 'slider', { name: 'Products', exact: true } ) ).toBeVisible( LOADED );
		await expect( boosts.getByRole( 'slider', { name: 'post', exact: true } ) ).toBeVisible();
		await expect( boosts.getByRole( 'slider', { name: 'ratgeber', exact: true } ) ).toHaveCount( 0 );
		await expect( boosts.getByText( /no content of this site has any more/ ) ).toBeVisible();

		await boosts.getByRole( 'button', { name: 'Remove the boost of post' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.type_boosts ).toEqual( [ { type: 'product', boost: 3 } ] );
	} );

	/**
	 * The half-written cases are the ones worth proving, because the API drops
	 * them silently rather than rejecting them - so a form that sent one would
	 * show a row that vanished on the next read.
	 */
	test( 'drops an untouched redirect row and an unpaired category trigger on save', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent );
		await page.goto( at( 'redirects' ) );

		await expect( page.locator( '.whsc-redirect-rule' ).first() ).toBeVisible( LOADED );

		// Add an empty redirect row, and half a category trigger.
		await page.getByRole( 'button', { name: 'Add a redirect' } ).click();
		await openSection( page, 'Merchandising rules' );
		await page
			.locator( '.whsc-merchandising-rule' )
			.first()
			.getByLabel( /Filter value/i )
			.fill( '' );

		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		const payload = sent[ sent.length - 1 ].body;

		// The empty row changes nothing, so the redirects are not sent at all.
		expect( payload ).not.toHaveProperty( 'redirects' );
		expect( payload.merchandising[ 0 ].filter_field ).toBeNull();
		expect( payload.merchandising[ 0 ].filter_value ).toBeNull();
	} );

	/**
	 * Searcio gave redirects a language, and the tab dropped it: a save took
	 * the language off every redirect given one in the dashboard.
	 */
	test( 'keeps the language a redirect is followed in, and saves every language unsaid', async ( { page } ) => {
		const sent = [];
		const config = { ...CONFIG, redirects: [ { query: 'versand', url: '/de/versand', lang: 'de' } ] };

		await mockCatalog( page, INDEXED_FIELDS, [ { code: 'de', name: 'Deutsch' }, { code: 'en', name: 'English' } ] );
		await mockSearchConfig( page, sent, config );
		await page.goto( at( 'redirects' ) );

		const rule = page.locator( '.whsc-redirect-rule' ).first();
		const language = rule.getByRole( 'combobox', { name: 'Language' } );

		await expect( language ).toHaveText( 'Deutsch (de)', LOADED );

		await rule.getByLabel( 'Send them to' ).fill( '/de/lieferung' );
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.redirects ).toEqual( [ { query: 'versand', url: '/de/lieferung', lang: 'de' } ] );

		await language.click();
		await page.getByRole( 'option', { name: 'Every language' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 1 );

		expect( sent[ sent.length - 1 ].body.redirects ).toEqual( [ { query: 'versand', url: '/de/versand' } ] );
	} );

	/**
	 * A number field could not be a range, and colour and size matched the
	 * product rather than one variation: Searcio keeps `numeric_fields` and
	 * `variant_fields`, and the tab offers them once it reports them.
	 */
	test( 'offers the number and variant fields once Searcio reports them, and saves each change', async ( { page } ) => {
		const sent = [];
		const config = { ...CONFIG, numeric_fields: [], variant_fields: [] };

		await mockCatalog( page );
		await mockSearchConfig( page, sent, config );
		await page.goto( at( 'filters' ) );

		const numbers = page.getByRole( 'combobox', { name: 'Fields that hold numbers' } );
		const variants = page.getByRole( 'combobox', { name: 'Attributes one variation must match' } );

		await expect( numbers ).toBeVisible( LOADED );

		await variants.click();
		await expect( page.getByRole( 'option', { name: 'attr_color' } ) ).toBeVisible();
		await expect( page.getByRole( 'option', { name: 'title' } ) ).toHaveCount( 0 );
		await page.getByRole( 'option', { name: 'attr_color' } ).click();

		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body ).toEqual( { variant_fields: [ 'attr_color' ] } );
	} );

	/**
	 * "Profitable products first" was the Searcio dashboard's alone, and
	 * turned on there without purchase prices it lifted nothing, with nothing
	 * to say why. The tab offers it once Searcio reports it, says when the
	 * products are indexed without a purchase price, and saves it whole.
	 */
	test( 'offers profit ranking, says when no purchase price is sent, and saves it whole', async ( { page } ) => {
		const sent = [];
		const ranking = { enabled: true, strength: 15, target: 25, min_profit: null, rules: [], excluded_terms: [] };

		await mockCatalog( page );
		await mockSearchConfig( page, sent, { ...CONFIG, profit_ranking: ranking } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );

		await expect( profit ).toBeVisible( LOADED );
		await expect( profit.getByText( 'Nothing is lifted yet' ) ).toBeVisible();

		await profit.getByRole( 'spinbutton', { name: 'Target margin (%)' } ).fill( '30' );
		await profit.getByRole( 'button', { name: 'Add a target' } ).click();
		// A field with suggestions is a combobox.
		await profit.getByRole( 'combobox', { name: 'Field', exact: true } ).fill( 'categories' );
		await profit.getByRole( 'textbox', { name: 'Value', exact: true } ).fill( 'Clearance' );
		await profit.getByRole( 'checkbox', { name: 'Never lift' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body ).toEqual( {
			profit_ranking: { ...ranking, target: 30, rules: [ { field: 'categories', value: 'Clearance', target: null, exclude: true } ] },
		} );
	} );

	/**
	 * The profit ranking card's own checks: Searcio's messages name a field by
	 * its key and come in the service's language, a blank row above a target
	 * would move its message to another row, and a target for a field no
	 * product has (`farbe` for `attr_farbe`) would be saved without a word.
	 */
	test( 'words what is out of range itself, under the right row, and sends nothing', async ( { page } ) => {
		const sent = [];

		await mockCatalog( page );
		await mockSearchConfig( page, sent, { ...CONFIG, profit_ranking: PROFIT_RANKING } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );
		const rows = profit.locator( '.whsc-profit-rule' );

		await expect( profit ).toBeVisible( LOADED );
		await profit.getByRole( 'spinbutton', { name: 'Strength (%)' } ).fill( '60' );

		// An untouched row, then a target with a field and a value and no margin.
		await profit.getByRole( 'button', { name: 'Add a target' } ).click();
		await profit.getByRole( 'button', { name: 'Add a target' } ).click();
		await rows.nth( 1 ).getByRole( 'combobox', { name: 'Field', exact: true } ).fill( 'categories' );
		await rows.nth( 1 ).getByRole( 'textbox', { name: 'Value', exact: true } ).fill( 'Clearance' );

		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();

		await expect( profit.getByText( 'Enter a strength from 1 to 50.' ) ).toBeVisible();
		await expect( rows.nth( 1 ).getByText( 'Enter a target margin from 0.1 to 100, or tick Never lift.' ) ).toBeVisible();
		await expect( rows.nth( 0 ).getByText( /Enter a target margin/ ) ).toHaveCount( 0 );
		expect( sent ).toEqual( [] );

		// Mended, it goes.
		await profit.getByRole( 'spinbutton', { name: 'Strength (%)' } ).fill( '20' );
		await rows.nth( 1 ).getByRole( 'checkbox', { name: 'Never lift' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.profit_ranking.rules ).toEqual( [ { field: 'categories', value: 'Clearance', target: null, exclude: true } ] );
	} );

	/**
	 * Searcio can order a listing without a search term (a category page, the
	 * highlights) by the lift alone, which is stronger than in a search. Where it
	 * reports the switch the card offers it, and says the least profit is counted
	 * without tax; the key goes back as it is when the card saves.
	 */
	test( 'offers the switch for listings where Searcio has it, and sends it back', async ( { page } ) => {
		const sent = [];

		await mockCatalog( page );
		await mockSearchConfig( page, sent, { ...CONFIG, profit_ranking: { ...PROFIT_RANKING, listings: true } } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );
		const listings = profit.getByRole( 'checkbox', { name: 'Also order listings without a search term' } );

		await expect( profit ).toBeVisible( LOADED );
		await expect( listings ).toBeChecked();
		await expect( profit.getByText( 'Optional, without tax.' ) ).toBeVisible();

		await listings.click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.profit_ranking ).toMatchObject( { enabled: true, listings: false } );
	} );

	test( 'offers no switch for listings to a Searcio without it', async ( { page } ) => {
		await mockCatalog( page );
		await mockSearchConfig( page, [], { ...CONFIG, profit_ranking: PROFIT_RANKING } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );

		await expect( profit ).toBeVisible( LOADED );
		await expect( profit.getByRole( 'checkbox', { name: /listings/ } ) ).toHaveCount( 0 );
		await expect( profit.getByText( 'Optional, without tax.' ) ).toHaveCount( 0 );
	} );

	test( 'warns about a target for a field no product has, until it is mended', async ( { page } ) => {
		await mockCatalog( page );
		await mockSearchConfig( page, [], { ...CONFIG, profit_ranking: PROFIT_RANKING } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );

		await expect( profit ).toBeVisible( LOADED );
		await profit.getByRole( 'button', { name: 'Add a target' } ).click();

		const field = profit.getByRole( 'combobox', { name: 'Field', exact: true } );

		await field.fill( 'color' );
		await expect( profit.getByText( 'No product on this site has this field' ) ).toBeVisible();

		await field.fill( 'attr_color' );
		await expect( profit.getByText( 'No product on this site has this field' ) ).toHaveCount( 0 );
	} );

	test( 'sends the shop owner to the Indexing tab, and words the least profit by the shop\'s tax display', async ( { page } ) => {
		await mockCatalog( page, INDEXED_FIELDS, [], { prices_with_tax: true } );
		await mockSearchConfig( page, [], { ...CONFIG, profit_ranking: PROFIT_RANKING } );
		await page.goto( at( 'profit' ) );

		const profit = page.locator( '.whsc-profit-ranking' );

		await expect( profit ).toBeVisible( LOADED );
		await expect( profit.getByRole( 'link', { name: 'Open the Indexing tab' } ) ).toHaveAttribute( 'href', /tab=indexing/ );
		await expect( profit.getByText( 'which include tax' ) ).toBeVisible();
	} );

	test( 'offers no profit ranking to a service that does not report it', async ( { page } ) => {
		await mockCatalog( page );
		await mockSearchConfig( page );
		await page.goto( at( 'filters' ) );

		await expect( page.getByRole( 'combobox', { name: 'Facet fields' } ) ).toBeVisible( LOADED );
		await expect( page.locator( '.whsc-profit-ranking' ) ).toHaveCount( 0 );
	} );

	test( 'offers no number or variant fields to a service that does not report them', async ( { page } ) => {
		await mockCatalog( page );
		await mockSearchConfig( page );
		await page.goto( at( 'filters' ) );

		await expect( page.getByRole( 'combobox', { name: 'Facet fields' } ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'combobox', { name: 'Fields that hold numbers' } ) ).toHaveCount( 0 );
		await expect( page.getByRole( 'combobox', { name: 'Attributes one variation must match' } ) ).toHaveCount( 0 );
	} );

	test( 'offers no language for a redirect on a site with one language', async ( { page } ) => {
		await mockCatalog( page );
		await mockSearchConfig( page );
		await page.goto( at( 'redirects' ) );

		const rule = page.locator( '.whsc-redirect-rule' ).first();

		await expect( rule ).toBeVisible( LOADED );
		await expect( rule.getByRole( 'combobox', { name: 'Language' } ) ).toHaveCount( 0 );
	} );

	/**
	 * A rule set to fire on its trigger alone in the Searcio dashboard came
	 * back as "contains" from any save of the rules: the tab dropped `match`.
	 */
	test( 'keeps a rule that fires on its trigger alone, and saves "contains" unsaid', async ( { page } ) => {
		const sent = [];
		const config = { ...CONFIG, merchandising: [ { ...CONFIG.merchandising[ 0 ], match: 'exact' } ] };

		await mockSearchConfig( page, sent, config );
		await page.goto( at( 'merchandising' ) );

		const rule = page.locator( '.whsc-merchandising-rule' ).first();
		const match = rule.getByRole( 'combobox', { name: 'Fires when the search term' } );

		await expect( match ).toHaveText( 'Is the trigger itself', LOADED );

		await rule.getByLabel( 'Promotional banner' ).fill( 'Winter shoe sale' );
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.merchandising[ 0 ] ).toMatchObject( { banner: 'Winter shoe sale', match: 'exact' } );

		await match.click();
		await page.getByRole( 'option', { name: 'Contains the trigger' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 1 );

		expect( sent[ sent.length - 1 ].body.merchandising[ 0 ] ).not.toHaveProperty( 'match' );
	} );

	/**
	 * The tab may show what it read some minutes ago, and the same settings
	 * can be changed in the Searcio panel meanwhile. A save sends what was
	 * changed here and leaves the rest as Searcio has it.
	 */
	test( 'saves only what was changed on the tab, and leaves the rest to Searcio', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent );
		await page.goto( at( 'ai' ) );
		await expect( page.getByRole( 'checkbox', { name: 'Search by photo', exact: true } ) ).toBeVisible( LOADED );

		await page.getByRole( 'checkbox', { name: 'Search by photo', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body ).toEqual( { features: { visual_search: { enabled: true } } } );
	} );

	/**
	 * Whether a filter's picked values combine as OR or as AND is Searcio's
	 * to keep, so it is offered only once Searcio reports it.
	 */
	test( 'offers OR or AND per filter field once Searcio reports it, and saves the choice', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent );
		await page.goto( at( 'filters' ) );
		await expect( page.getByRole( 'combobox', { name: 'Facet fields' } ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'group', { name: 'When a shopper picks several values of one filter' } ) ).toHaveCount( 0 );

		await page.unrouteAll( { behavior: 'ignoreErrors' } );
		await mockSearchConfig( page, sent, { ...CONFIG, facet_fields: [ 'brand', 'features' ], facet_match: { features: 'all' } } );
		await page.reload();

		const group = page.getByRole( 'group', { name: 'When a shopper picks several values of one filter' } );

		await expect( group ).toBeVisible( LOADED );
		await expect( group.getByRole( 'radiogroup', { name: 'features' } ).getByRole( 'radio', { name: 'All (AND)' } ) ).toBeChecked();

		await group.getByRole( 'radiogroup', { name: 'brand' } ).getByRole( 'radio', { name: 'All (AND)' } ).click();
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.facet_match ).toEqual( { brand: 'all', features: 'all' } );
	} );

	/**
	 * The terms never offered as popular searches are Searcio's list, kept
	 * beside the plugin's own fallback, so the field shows only once Searcio
	 * reports the list. Searcio keeps each term once, whatever its capitals.
	 */
	test( 'offers the terms never shown as popular searches once Searcio reports them, and saves each once', async ( { page } ) => {
		const sent = [];

		await mockSearchConfig( page, sent );
		await page.goto( at( 'suggest' ) );
		await expect( page.getByRole( 'textbox', { name: 'Popular searches' } ) ).toBeVisible( LOADED );
		await expect( page.getByRole( 'textbox', { name: 'Never show as a popular search' } ) ).toHaveCount( 0 );

		await page.unrouteAll( { behavior: 'ignoreErrors' } );
		await mockSearchConfig( page, sent, { ...CONFIG, excluded_popular_terms: [ 'free' ] } );
		await page.reload();

		const field = page.getByRole( 'textbox', { name: 'Never show as a popular search' } );

		await expect( field ).toHaveValue( 'free', LOADED );
		await expect( page.getByRole( 'textbox', { name: 'Fallback list' } ) ).toBeVisible();

		await field.fill( 'free\nSample\n\nsample ' );
		await page.getByRole( 'button', { name: 'Save search configuration' } ).click();
		await expect.poll( () => sent.length ).toBeGreaterThan( 0 );

		expect( sent[ sent.length - 1 ].body.excluded_popular_terms ).toEqual( [ 'free', 'Sample' ] );
	} );

	/**
	 * "Rucksack, Ranzen" listed twice was kept twice, and nothing said that the
	 * second group changed nothing.
	 */
	test( 'says when a synonym group is listed twice, and stops saying it once it is not', async ( { page } ) => {
		await mockSearchConfig( page );
		await page.goto( at( 'synonyms' ) );

		const field = page.getByRole( 'textbox', { name: 'Synonyms' } );
		const warning = page.locator( '.whsc-repeated-synonyms' );

		await expect( field ).toBeVisible( LOADED );
		await expect( warning ).toHaveCount( 0 );

		await field.fill( 'Rucksack, Ranzen\nsneaker, trainer\nranzen, rucksack' );
		await expect( warning ).toContainText( 'The group "ranzen, rucksack" is listed twice' );

		await field.fill( 'Rucksack, Ranzen\nsneaker, trainer' );
		await expect( warning ).toHaveCount( 0 );
	} );

	/**
	 * The suggestions used to be a hand-kept list in the tab that offered
	 * `tags` (never written - the field is `product_tags`) and left out
	 * `in_stock`, `on_sale`, the price range and every attribute.
	 */
	test( 'suggests exactly the fields the site indexes', async ( { page } ) => {
		await mockSearchConfig( page );
		await mockCatalog( page );
		await page.goto( at( 'filters' ) );

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
		await page.goto( at( 'filters' ) );

		const facetCard = card( page, 'Facet fields' );
		const warning = facetCard.locator( '.whsc-unindexed-fields' );

		await expect( warning ).toBeVisible( LOADED );
		await expect( warning ).toContainText( 'No document on this site has a "category" field' );
		await expect( warning ).not.toContainText( '"categories"' );

		// The suggest fields (`title`) are all indexed, so that section stays quiet.
		await openSection( page, 'Suggestions' );
		await expect( card( page, 'Suggest fields' ).locator( '.whsc-unindexed-fields' ) ).toHaveCount( 0 );
		await openSection( page, 'Filters' );

		// Backspace in an empty token input removes the last token.
		await facetCard.getByRole( 'combobox', { name: 'Facet fields' } ).click();
		await page.keyboard.press( 'Backspace' );

		await expect( warning ).toHaveCount( 0 );
	} );

	test( 'warns about every unindexed suggest field at once', async ( { page } ) => {
		await mockSearchConfig( page, [], { ...CONFIG, suggest_fields: [ 'title', 'tags', 'brand' ] } );
		await mockCatalog( page );
		await page.goto( at( 'suggest' ) );

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
		await page.goto( at( 'filters' ) );

		await expect( page.getByRole( 'combobox', { name: 'Facet fields' } ) ).toBeVisible( LOADED );
		expect( Array.isArray( reported ) ).toBe( true );

		const offered = await page
			.locator( '#whsc-field-suggestions option' )
			.evaluateAll( ( nodes ) => nodes.map( ( node ) => node.value ) );

		expect( offered ).toEqual( reported );
	} );
} );
