/**
 * Numeric filters and the pages beyond the first.
 *
 * Both are things the API has always offered and the modal never asked for: a
 * `range[field]=min:max` filter (the only way to express "under 50", since a
 * numeric field aggregates into one bucket per exact value - and, having no
 * `.keyword` sub-field, into no buckets at all), and `page`, without which a
 * catalogue of any size was 20 results deep with the rest unreachable.
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

/** `n` product hits, priced apart so a bound has something to exclude. */
const pricedHits = ( count, offset = 0 ) =>
	Array.from( { length: count }, ( _, index ) =>
		postHit(
			{ type: 'product', title: `Product ${ offset + index + 1 }`, price: 10 + ( offset + index ) * 5 },
			`product-${ offset + index + 1 }`
		)
	);

test.describe( 'numeric range filters', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	/**
	 * Open the price filter of a search for "chair", recording every request.
	 *
	 * @param {import('@playwright/test').Page} page
	 * @param {Object} requestUtils
	 * @return {Promise<{widget: SearchWidget, panel: import('@playwright/test').Locator, requests: URL[]}>}
	 */
	const openPrice = async ( page, requestUtils ) => {
		const requests = [];

		await mockSearchCloud( page, {
			hits: pricedHits( 6 ),
			// What a numeric facet field really looks like coming back: the key
			// says the field is filterable, the empty list says there is nothing
			// to make chips out of.
			facets: { types: [], price: [] },
			onSearch: ( url ) => requests.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		return { widget, panel: await widget.openGroup( 'Price' ), requests };
	};

	test( 'offers bounds for a numeric facet and sends them as range[field]=min:max', async ( { page, requestUtils } ) => {
		const { panel, requests } = await openPrice( page, requestUtils );

		// The span of the loaded results, said for what it is.
		// A price is written as the shop writes prices, with its currency when
		// WooCommerce is active.
		await expect( panel.getByText( /^Range of the loaded results: \D*10\D* to \D*35\D*$/ ) ).toBeVisible();

		await panel.getByLabel( 'Minimum Price' ).fill( '20' );
		await panel.getByLabel( 'Maximum Price' ).fill( '45' );
		await panel.getByLabel( 'Maximum Price' ).press( 'Enter' );

		await expect
			.poll( () => requests.some( ( url ) => '20:45' === url.searchParams.get( 'range[price]' ) ) )
			.toBe( true );
	} );

	test( 'applies a bound once typing stops, and leaves the other side open', async ( { page, requestUtils } ) => {
		const { panel, requests } = await openPrice( page, requestUtils );

		await panel.getByLabel( 'Minimum Price' ).pressSequentially( '100' );

		// Not on every key: "1" on the way to "100" would be another filter.
		expect( requests.some( ( url ) => '1:' === url.searchParams.get( 'range[price]' ) ) ).toBe( false );
		await expect
			.poll( () => requests.some( ( url ) => '100:' === url.searchParams.get( 'range[price]' ) ) )
			.toBe( true );
	} );

	test( 'swaps a lower bound above the upper one', async ( { page, requestUtils } ) => {
		const { panel, requests } = await openPrice( page, requestUtils );

		await panel.getByLabel( 'Minimum Price' ).fill( '200' );
		await panel.getByLabel( 'Maximum Price' ).fill( '50' );
		await panel.getByLabel( 'Maximum Price' ).press( 'Enter' );

		await expect
			.poll( () => requests.some( ( url ) => '50:200' === url.searchParams.get( 'range[price]' ) ) )
			.toBe( true );
		await expect( panel.getByLabel( 'Minimum Price' ) ).toHaveValue( '50' );
	} );

	test( 'takes the bound away again from its chip, and stops sending it', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' === testInfo.project.name, 'A phone shows the filters applied on the bar, not as chips.' );

		const { widget, panel, requests } = await openPrice( page, requestUtils );

		await panel.getByLabel( 'Minimum Price' ).fill( '30' );
		await panel.getByLabel( 'Minimum Price' ).press( 'Enter' );
		await page.keyboard.press( 'Escape' );

		const chip = widget.modal.getByRole( 'button', { name: /^Remove Price: from \D*30\D*$/ } );

		await expect( chip ).toBeVisible();
		await expect( widget.groupButton( 'Price' ) ).toHaveText( /Price: from \D*30/ );

		requests.length = 0;
		await chip.click();

		await expect( chip ).toBeHidden();

		// Searching for something else is what proves the bound is really gone
		// rather than just hidden, since that request has to go out.
		await widget.search( 'stool' );

		await expect.poll( () => requests.length ).toBeGreaterThan( 0 );
		expect( requests.every( ( url ) => null === url.searchParams.get( 'range[price]' ) ) ).toBe( true );
	} );

	test( 'draws a text facet as a list, never as a number range', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { brand: 'Acme' } ) ],
			facets: { types: [], brand: [ { value: 'Acme', count: 1 } ] },
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		const panel = await widget.openGroup( 'Brand' );

		await expect( panel.getByRole( 'checkbox', { name: /Acme/ } ) ).toBeVisible();
		await expect( panel.locator( '.whsc-price' ) ).toHaveCount( 0 );
	} );
} );

test.describe( 'result paging', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'counts what the index matched, not what is loaded, and loads the rest on request', async ( { page, requestUtils } ) => {
		// No semantic search on this site, so the response's `total` is a real
		// count of matches and the heading can say "of 45".
		await mockSearchCloud( page, {
			total: 45,
			hits: ( url ) => pricedHits( 20, 20 * ( Number( url.searchParams.get( 'page' ) || 1 ) - 1 ) ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );

		await expect( widget.cards ).toHaveCount( 20 );
		await expect( widget.resultsHeading ).toHaveText( '20 of 45 results' );

		await widget.loadMore.click();

		await expect( widget.cards ).toHaveCount( 40 );
		await expect( widget.resultsHeading ).toHaveText( '40 of 45 results' );
		// Page two's hits are appended, not swapped in.
		await expect( widget.cards.first() ).toContainText( 'Product 1' );
		await expect( widget.cards.nth( 20 ) ).toContainText( 'Product 21' );
	} );

	test( 'offers nothing more to load once everything is on screen', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: pricedHits( 3 ), total: 3 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );

		await expect( widget.cards ).toHaveCount( 3 );
		await expect( widget.resultsHeading ).toHaveText( '3 results' );
		await expect( widget.loadMore ).toHaveCount( 0 );
	} );

	/**
	 * A semantic query's `total` counts the window the engine retrieved, not
	 * the matches: measured against the service it reads 23 on page one and 40
	 * on page two of a 96-document index. Believing it would stop the list dead
	 * at page two and label it complete.
	 */
	test( 'keeps paging a semantic search, whose total counts the window rather than the matches', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			semanticSearch: true,
			hits: ( url ) => {
				const page1 = Number( url.searchParams.get( 'page' ) || 1 );

				return pricedHits( 3 === page1 ? 16 : 20, 20 * ( page1 - 1 ) );
			},
			total: ( url ) => 20 * Number( url.searchParams.get( 'page' ) || 1 ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );

		await expect( widget.cards ).toHaveCount( 20 );
		// No "of N": that number would be the window size, not a result count.
		await expect( widget.resultsHeading ).toHaveText( '20 results' );

		await widget.loadMore.click();
		await expect( widget.cards ).toHaveCount( 40 );
		await expect( widget.resultsHeading ).toHaveText( '40 results' );

		// The short third page is what ends the list.
		await widget.loadMore.click();
		await expect( widget.cards ).toHaveCount( 56 );
		await expect( widget.loadMore ).toHaveCount( 0 );
	} );

	test( 'lets go of the load-more button when a new search overtakes it', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: ( url ) => pricedHits( 20, ( Number( url.searchParams.get( 'page' ) || 1 ) - 1 ) * 20 ),
			total: 60,
			facets: { types: [] },
			// Only the second page is held open, so the new search below starts
			// while the load-more request is still unanswered.
			searchDelay: ( url ) => ( Number( url.searchParams.get( 'page' ) || 1 ) > 1 ? 2000 : 0 ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		const loadMore = widget.modal.locator( '.whsc-load-more__button' );

		await loadMore.click();
		await widget.search( 'stool' );
		await expect( widget.cards.first() ).toBeVisible();

		// The overtaken request still has to release the button, or the new
		// search's results end with one reading "Loading…" that never resolves.
		await expect( loadMore ).toBeEnabled( { timeout: 10000 } );
		await expect( loadMore ).toHaveText( 'Load more results' );
	} );
} );
