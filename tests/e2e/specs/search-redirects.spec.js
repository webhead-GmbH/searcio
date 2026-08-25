/**
 * Search-term redirects. A term the merchant configured answers with
 * `{query, redirect}` and no results at all, so the modal has to recognise that
 * shape before it tries to render hits, and send the visitor to the URL.
 *
 * The rule that needs holding down is *when* it fires: on a deliberate search,
 * never part-way through typing, or "search as you type" would throw a visitor
 * off the page mid-word on any term that happens to pass through a rule.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'search redirects', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'sends the visitor to the configured page instead of showing results', async ( { page, requestUtils } ) => {
		const destination = await createBlockPost( requestUtils, { mode: 'box' } );

		await mockSearchCloud( page, { redirects: { 'black friday': destination } } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'black friday' );

		await page.waitForURL( destination );
		await expect( page ).toHaveURL( destination );
	} );

	/** Matched exactly, but forgivingly: capitalisation and padding are ignored. */
	test( 'matches regardless of capitalisation or surrounding spaces', async ( { page, requestUtils } ) => {
		const destination = await createBlockPost( requestUtils, { mode: 'box' } );

		await mockSearchCloud( page, { redirects: { 'black friday': destination } } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( '  Black Friday  ' );

		await page.waitForURL( destination );
		await expect( page ).toHaveURL( destination );
	} );

	test( 'leaves a term that only contains the rule as a normal search', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { redirects: { 'black friday': 'https://example.test/bf' } } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'black friday deals' );

		await expect( widget.cards.first() ).toBeVisible();
	} );

	/**
	 * The dangerous case: in "search as you type" mode a live search fires from
	 * the fourth character on, so a visitor typing "sale shoes" on a site that
	 * redirects "sale" must not be navigated away as they pass through it.
	 */
	test( 'does not navigate part-way through typing a longer query', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { redirects: { sale: 'https://example.test/sale' } } );

		const start = await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'type' } );
		await page.goto( start );

		const widget = new SearchWidget( page );
		await widget.openModal();

		// Type the redirect term and stop, long enough for the live search to
		// fire and come back.
		await widget.input.fill( 'sale' );
		await page.waitForTimeout( 1500 );

		await expect( page ).toHaveURL( start );

		// Finishing the thought still searches normally.
		await widget.input.fill( 'sale shoes' );
		await expect( widget.cards.first() ).toBeVisible();
		await expect( page ).toHaveURL( start );
	} );
} );

test.describe( 'merchandising banner', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	/**
	 * The plugin's own Search Config tab writes these, so a banner that never
	 * reaches the storefront makes that field look broken.
	 */
	test( 'shows the banner a merchandising rule attaches to the search', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { banner: 'Winter sale - up to 40% off' } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'winter' );

		await expect( widget.modal.locator( '.whsc-banner' ) ).toHaveText( 'Winter sale - up to 40% off' );
	} );

	test( 'shows nothing when no rule matches', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { banner: null } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'winter' );

		await expect( widget.cards.first() ).toBeVisible();
		await expect( widget.modal.locator( '.whsc-banner' ) ).toHaveCount( 0 );
	} );
} );
