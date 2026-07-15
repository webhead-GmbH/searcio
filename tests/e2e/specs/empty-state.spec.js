/**
 * The pre-query "browse" state: current-highlights carousel, curated popular
 * searches, and the visitor's own recent searches (persisted in localStorage).
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Empty (browse) state', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'shows the current-highlights carousel before typing', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { title: 'Featured Article' } ) ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		// Highlights come from a match-all /search with no query typed.
		await expect( widget.modal.getByText( 'Featured Article' ) ).toBeVisible();
	} );

	test( 'shows curated popular searches', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { popular: [ { query: 'jackets' }, { query: 'scarves' } ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.modal.getByText( 'jackets' ) ).toBeVisible();
		await expect( widget.modal.getByText( 'scarves' ) ).toBeVisible();
	} );

	test( 'remembers a recent search across reopen', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'umbrella' );
		await expect( widget.cards.first() ).toBeVisible();

		await widget.close();
		await widget.openModal();

		// The just-run query is now offered as a recent-search chip.
		await expect( widget.modal.getByText( 'umbrella' ) ).toBeVisible();
	} );
} );
