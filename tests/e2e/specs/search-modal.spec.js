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
	 * The list was a `listbox` whose options could only be reached with Tab,
	 * one stop each: the arrow keys, which are what a listbox promises, did
	 * nothing.
	 */
	test( 'the arrow keys move through the suggestions and Enter searches for the marked one', async ( { page, requestUtils } ) => {
		const searched = [];

		await mockSearchCloud( page, {
			suggestions: [ 'Hoodie', 'Hoodie with Logo', 'Hoodie with Zipper' ],
			onSearch: ( url ) => searched.push( url.searchParams.get( 'q' ) ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.fill( 'hood' );

		const options = widget.modal.getByRole( 'option' );

		await expect( options ).toHaveCount( 3 );
		// Nothing is marked until a key says so.
		await expect( widget.modal.getByRole( 'option', { selected: true } ) ).toHaveCount( 0 );
		await expect( widget.input ).not.toHaveAttribute( 'aria-activedescendant', /.+/ );

		// Focus stays in the field; the field names the option the keys are on.
		const marked = async ( index ) => {
			await expect( options.nth( index ) ).toHaveAttribute( 'aria-selected', 'true' );
			await expect( widget.modal.getByRole( 'option', { selected: true } ) ).toHaveCount( 1 );
			await expect( widget.input ).toHaveAttribute( 'aria-activedescendant', await options.nth( index ).getAttribute( 'id' ) );
			await expect( widget.input ).toBeFocused();
		};

		await page.keyboard.press( 'ArrowDown' );
		await marked( 0 );
		await page.keyboard.press( 'ArrowDown' );
		await marked( 1 );
		await page.keyboard.press( 'ArrowUp' );
		await marked( 0 );
		// Round the top to the last one, and round the bottom to the first.
		await page.keyboard.press( 'ArrowUp' );
		await marked( 2 );
		await page.keyboard.press( 'ArrowDown' );
		await marked( 0 );
		await page.keyboard.press( 'ArrowDown' );
		await marked( 1 );

		// The mark can be seen: a ring, not only the pointer's faint fill.
		expect( await options.nth( 1 ).evaluate( ( el ) => window.getComputedStyle( el ).outlineStyle ) ).toBe( 'solid' );
		expect( await options.nth( 0 ).evaluate( ( el ) => window.getComputedStyle( el ).outlineStyle ) ).toBe( 'none' );

		// What was typed is still what is in the field.
		await expect( widget.input ).toHaveValue( 'hood' );

		await page.keyboard.press( 'Enter' );

		await expect( widget.input ).toHaveValue( 'Hoodie with Logo' );
		await expect( widget.modal.getByRole( 'listbox', { name: 'Search suggestions' } ) ).toBeHidden();
		await expect.poll( () => searched ).toContain( 'Hoodie with Logo' );
	} );

	test( 'Enter searches for what was typed when no suggestion is marked, and typing on forgets the mark', async ( { page, requestUtils } ) => {
		const searched = [];

		await mockSearchCloud( page, {
			suggestions: [ 'Hoodie', 'Hoodie with Logo' ],
			onSearch: ( url ) => searched.push( url.searchParams.get( 'q' ) ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.fill( 'hood' );

		const suggestions = widget.modal.getByRole( 'listbox', { name: 'Search suggestions' } );

		await expect( suggestions ).toBeVisible();
		await page.keyboard.press( 'ArrowDown' );
		await expect( widget.modal.getByRole( 'option', { selected: true } ) ).toHaveCount( 1 );

		// One more letter: the search is for the field again, not for the
		// suggestion that was marked a moment ago.
		await page.keyboard.type( 'i' );
		await expect( widget.modal.getByRole( 'option', { selected: true } ) ).toHaveCount( 0 );
		await page.keyboard.press( 'Enter' );

		await expect( widget.input ).toHaveValue( 'hoodi' );
		await expect.poll( () => searched ).toContain( 'hoodi' );
		expect( searched ).not.toContain( 'Hoodie' );
	} );

	test( 'the Down key brings back suggestions that Escape put away', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { suggestions: [ 'Hoodie', 'Hoodie with Logo' ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.input.fill( 'hoodie' );

		const suggestions = widget.modal.getByRole( 'listbox', { name: 'Search suggestions' } );

		await expect( suggestions ).toBeVisible();
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'Escape' );
		await expect( suggestions ).toBeHidden();
		await expect( widget.input ).not.toHaveAttribute( 'aria-activedescendant', /.+/ );

		await page.keyboard.press( 'ArrowDown' );

		// Open again, from the top, and not from where the keys were before.
		await expect( suggestions ).toBeVisible();
		await expect( widget.modal.getByRole( 'option' ).nth( 0 ) ).toHaveAttribute( 'aria-selected', 'true' );
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
