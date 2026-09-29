/**
 * Core search modal flow: opening from both trigger styles, running a query,
 * rendering result cards, the no-results and error states, the outgoing request
 * shape, and closing. Runs on the desktop and mobile projects.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
	SEARCH_KEY,
} from '../utils';

// View the front end as a logged-out visitor (no admin bar).
test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Search modal', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'the icon trigger opens the portalled modal', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.modal ).toBeVisible();
	} );

	test( 'the box trigger opens the modal', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'box' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.modal ).toBeVisible();
	} );

	test( 'typing a query renders result cards', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { title: 'Blue Sneakers' } ), postHit( { title: 'Red Boots' }, 'post-2' ) ],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'footwear' );

		await expect( widget.modal.getByText( 'Blue Sneakers' ) ).toBeVisible();
		await expect( widget.cards ).toHaveCount( 2 );
	} );

	test( 'shows the empty "no results" message', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'nothing-matches-this' );

		await expect( widget.modal.locator( '.whsc-no-results' ) ).toBeVisible();
	} );

	test( 'sends the query and search key to the API', async ( { page, requestUtils } ) => {
		let searchUrl;
		await mockSearchCloud( page, { onSearch: ( url ) => { searchUrl = url; } } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'hats' );

		await expect.poll( () => searchUrl?.searchParams.get( 'q' ) ).toBe( 'hats' );
		expect( searchUrl.searchParams.get( 'key' ) ).toBe( SEARCH_KEY );
	} );

	test( 'closes with the close button and with Escape', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.close();
		await expect( widget.modal ).toBeHidden();

		await widget.openModal();
		await page.keyboard.press( 'Escape' );
		await expect( widget.modal ).toBeHidden();
	} );

	/**
	 * Submit mode, typed but not yet searched: the column showed the
	 * highlights' title over a skeleton that never resolved.
	 */
	test( 'keeps the highlights while a query waits to be submitted', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { title: 'A highlight' } ) ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'submit' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.cards ).toHaveCount( 1 );

		await widget.input.fill( 'hood' );

		await expect( widget.resultsHeading ).toHaveText( 'Current highlights' );
		await expect( widget.cards ).toHaveCount( 1 );
		await expect( widget.modal.locator( '.whsc-skeleton-row' ) ).toHaveCount( 0 );
	} );

	test( 'Escape closes the suggestions and keeps the query', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { suggestions: [ 'Hoodie', 'Hoodie with Logo' ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.fill( 'hoodie' );

		const suggestions = widget.modal.getByRole( 'listbox', { name: 'Search suggestions' } );
		await expect( suggestions ).toBeVisible();

		await page.keyboard.press( 'Escape' );

		// A search field empties itself on Escape unless told not to; the first
		// press is for the dropdown, not for the query or the modal.
		await expect( suggestions ).toBeHidden();
		await expect( widget.input ).toHaveValue( 'hoodie' );
		await expect( widget.modal ).toBeVisible();
	} );

	/**
	 * The stock line was the one card colour no placement could change: a fixed
	 * green and red. The defaults stay those colours; a placement's own win.
	 */
	test( 'colours the stock line from the placement, defaulting to green and red', async ( { page, requestUtils } ) => {
		const stockHits = [
			postHit( { title: 'Tee in stock', type: 'product', in_stock: true }, 'p-in' ),
			postHit( { title: 'Tee sold out', type: 'product', in_stock: false }, 'p-out' ),
		];
		const widget = new SearchWidget( page );
		const inStock = widget.modal.locator( '.whsc-card__stock.is-in-stock' );
		const outOfStock = widget.modal.locator( '.whsc-card__stock.is-out-of-stock' );

		await mockSearchCloud( page, { hits: stockHits } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );
		await widget.openModal();
		await widget.search( 'tee' );
		await expect( inStock ).toHaveCSS( 'color', 'rgb(42, 125, 79)' );
		await expect( outOfStock ).toHaveCSS( 'color', 'rgb(176, 42, 55)' );

		// The scoped style is only printed for a named instance; the editor
		// names one on insert, a block created over REST has to say it.
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', instanceId: 'e2e-stock', stockInColor: '#1d4ed8', stockOutColor: '#7c2d12' } ) );
		await widget.openModal();
		await widget.search( 'tee' );
		await expect( inStock ).toHaveCSS( 'color', 'rgb(29, 78, 216)' );
		await expect( outOfStock ).toHaveCSS( 'color', 'rgb(124, 45, 18)' );
	} );

	test( 'reports a result click to the analytics beacon', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { title: 'Clickable' } ) ],
			searchId: 'search-e2e-1',
		} );
		// Resolve the card's navigation locally instead of hitting example.test.
		await page.route( 'https://example.test/**', ( route ) => route.fulfill( { status: 200, body: 'ok' } ) );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'shoes' );
		await expect( widget.cards.first() ).toBeVisible();

		const beacon = page.waitForRequest(
			( request ) => request.url().includes( '/search/click' ) && 'POST' === request.method()
		);
		await widget.cards.first().click();
		const request = await beacon;
		const payload = Object.fromEntries( new URLSearchParams( request.postData() ) );

		expect( payload ).toMatchObject( { search_id: 'search-e2e-1', document_id: 'post-1', position: '1' } );

		// Form-encoded keeps the beacon a CORS-safelisted request. As JSON the
		// browser preflights it, and the API answers preflights without CORS
		// headers, so the click never left the page.
		expect( request.headers()[ 'content-type' ] ).toContain( 'application/x-www-form-urlencoded' );
	} );

	test( 'falls back to native search when the API errors', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { searchStatus: 500 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'boots' );

		// A failed Search Cloud query degrades to WordPress's own ?s= search.
		await page.waitForURL( /[?&]s=boots/ );
	} );
} );
