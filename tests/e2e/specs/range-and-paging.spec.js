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

	test( 'offers bounds for a numeric facet and sends them as range[field]=min:max', async ( { page, requestUtils } ) => {
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

		await expect( widget.rangeGroups ).toHaveCount( 1 );
		await expect( widget.rangeGroups.first() ).toContainText( 'Price' );

		await widget.modal.getByLabel( 'Minimum Price' ).fill( '20' );
		await widget.modal.getByLabel( 'Maximum Price' ).fill( '45' );
		await widget.modal.getByRole( 'button', { name: 'Apply' } ).click();

		await expect
			.poll( () => requests.some( ( url ) => '20:45' === url.searchParams.get( 'range[price]' ) ) )
			.toBe( true );
	} );

	test( 'leaves one side open when only one bound is given', async ( { page, requestUtils } ) => {
		const requests = [];

		await mockSearchCloud( page, {
			hits: pricedHits( 6 ),
			facets: { types: [], price: [] },
			onSearch: ( url ) => requests.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		await widget.modal.getByLabel( 'Minimum Price' ).fill( '30' );
		await widget.modal.getByRole( 'button', { name: 'Apply' } ).click();

		await expect
			.poll( () => requests.some( ( url ) => '30:' === url.searchParams.get( 'range[price]' ) ) )
			.toBe( true );
	} );

	test( 'clears the bound again, and stops sending it', async ( { page, requestUtils } ) => {
		const requests = [];

		await mockSearchCloud( page, {
			hits: pricedHits( 6 ),
			facets: { types: [], price: [] },
			onSearch: ( url ) => requests.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		await widget.modal.getByLabel( 'Minimum Price' ).fill( '30' );
		await widget.modal.getByRole( 'button', { name: 'Apply' } ).click();
		await expect( widget.modal.getByRole( 'button', { name: 'Clear' } ) ).toBeVisible();

		requests.length = 0;
		await widget.modal.getByRole( 'button', { name: 'Clear' } ).click();

		await expect.poll( () => requests.length ).toBeGreaterThan( 0 );
		expect( requests.every( ( url ) => null === url.searchParams.get( 'range[price]' ) ) ).toBe( true );
	} );

	test( 'renders a text facet as chips, never as a number range', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { brand: 'Acme' } ) ],
			facets: { types: [], brand: [ { value: 'Acme', count: 1 } ] },
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );
		await expect( widget.cards.first() ).toBeVisible();

		await expect( widget.modal.locator( '.whsc-facet', { hasText: 'Acme' } ) ).toBeVisible();
		await expect( widget.rangeGroups ).toHaveCount( 0 );
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
} );
