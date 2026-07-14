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
