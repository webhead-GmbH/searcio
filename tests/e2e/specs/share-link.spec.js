/**
 * A search as an address (`src/utils/shareLink.js`): the window keeps what it
 * shows in the part of the address behind the `#`, so that copying the address
 * shares the search, and a page opened on such an address opens the window on
 * that search.
 *
 * Read from the address and from the requests the page really sends, through
 * the API mock.
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

const RECENT_KEY = 'searcio.recentSearches';

const FACETS = {
	types: [ { value: 'post', count: 3 }, { value: 'page', count: 1 } ],
	brand: [ { value: 'Acme', count: 2 }, { value: 'Duff', count: 1 } ],
};

/** The part of the address behind the `#`, as the browser holds it. */
const hashOf = ( page ) => new URL( page.url() ).hash;

/** The searches of the window itself: the highlights are asked for on the same path. */
const overlay = ( searches ) => searches.filter( ( url ) => 'overlay' === url.searchParams.get( 'surface' ) );

test.describe( 'a search as an address', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'shows the search in the address as it is made, with no entry in the history, and takes it away when the window closes', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { type: 'post', brand: 'Acme' } ) ], facets: FACETS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		const entries = await page.evaluate( () => window.history.length );

		await widget.openModal();

		// The highlights are no search to share.
		expect( hashOf( page ) ).toBe( '' );

		await widget.search( 'guide' );
		await expect.poll( () => hashOf( page ) ).toBe( '#searcio?q=guide' );

		await widget.typeSwitch.getByRole( 'button', { name: /^post/ } ).click();
		await expect.poll( () => hashOf( page ) ).toBe( '#searcio?q=guide&type=post' );
		expect( await page.evaluate( () => window.history.length ) ).toBe( entries );

		await widget.close();
		await expect.poll( () => hashOf( page ) ).toBe( '' );
	} );

	test( 'shows a pick of a filter in the address too', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { type: 'post', brand: 'Acme' } ) ], facets: FACETS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );

		const panel = await widget.openGroup( 'Brand' );

		await panel.getByRole( 'checkbox', { name: /Acme/ } ).check();
		await expect.poll( () => hashOf( page ) ).toBe( '#searcio?q=guide&f.brand=Acme' );
	} );

	test( 'gives the address the page had back when the window closes', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );

		const start = await createBlockPost( requestUtils, { mode: 'icon' } );

		await page.goto( `${ start }#pricing` );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await expect.poll( () => hashOf( page ) ).toBe( '#searcio?q=guide' );

		await widget.close();
		await expect.poll( () => hashOf( page ) ).toBe( '#pricing' );
	} );

	test( 'opens on the search a link holds, as a visitor would have made it', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, {
			hits: [ postHit( { type: 'post', brand: 'Acme', title: 'Acme guide' } ) ],
			facets: FACETS,
			onSearch: ( url ) => searches.push( url ),
		} );

		const start = await createBlockPost( requestUtils, { mode: 'icon' } );

		await page.goto( `${ start }#searcio?q=guide&type=post&f.brand=Acme` );

		const widget = new SearchWidget( page );

		await expect( widget.modal ).toBeVisible();
		await expect( widget.input ).toHaveValue( 'guide' );
		await expect( widget.typeSwitch.getByRole( 'button', { name: /^post/ } ) ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( widget.groupButton( 'Brand' ) ).toHaveText( /Brand: Acme/ );
		await expect( widget.cards.first() ).toBeVisible();

		// The words first, then the type and the filter on top of them: the
		// answer to a search that has the filter from the start knows no other
		// type and no other brand to change the pick to.
		await expect
			.poll( () => overlay( searches ).some( ( url ) => 'post' === url.searchParams.get( 'type' ) && 'Acme' === url.searchParams.get( 'filter[brand]' ) ) )
			.toBe( true );

		const [ first ] = overlay( searches );

		expect( first.searchParams.get( 'q' ) ).toBe( 'guide' );
		expect( first.searchParams.get( 'type' ) ).toBeNull();
		expect( first.searchParams.get( 'filter[brand]' ) ).toBeNull();

		// Nobody searched: out of the statistics until a result is clicked, and
		// not among the recent searches.
		overlay( searches ).forEach( ( url ) => expect( url.searchParams.get( 'live' ) ).toBe( '1' ) );
		expect( JSON.parse( ( await page.evaluate( ( key ) => window.localStorage.getItem( key ), RECENT_KEY ) ) || '[]' ) ).toEqual( [] );

		// The pick can be changed to the other values the first search found.
		const panel = await widget.openGroup( 'Brand' );

		await expect( panel.getByRole( 'checkbox', { name: /Duff/ } ) ).toBeVisible();
	} );

	test( 'opens on a link whose search has no words', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, { facets: FACETS, onSearch: ( url ) => searches.push( url ) } );

		const start = await createBlockPost( requestUtils, { mode: 'icon' } );

		await page.goto( `${ start }#searcio?type=post` );

		const widget = new SearchWidget( page );

		await expect( widget.modal ).toBeVisible();
		await expect( widget.input ).toHaveValue( '' );
		await expect( widget.typeSwitch.getByRole( 'button', { name: /^post/ } ) ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect.poll( () => overlay( searches ).some( ( url ) => 'post' === url.searchParams.get( 'type' ) ) ).toBe( true );
	} );

	test( 'opens on a link pasted into the address of a page that is open', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.trigger.waitFor( { state: 'visible' } );
		await expect( widget.modal ).toHaveCount( 0 );

		await page.evaluate( () => {
			window.location.hash = '#searcio?q=chair';
		} );

		await expect( widget.modal ).toBeVisible();
		await expect( widget.input ).toHaveValue( 'chair' );
	} );

	test( 'leaves alone an address it cannot use', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );

		const start = await createBlockPost( requestUtils, { mode: 'icon' } );
		const widget = new SearchWidget( page );

		for ( const link of [ '#searcio?sort=price&tab=assistant', '#searcio?q=%00', `#searcio?q=${ 'a'.repeat( 300 ) }`, '#searcio?', '#pricing', '#searcio' ] ) {
			await page.goto( `${ start }${ link }` );
			await widget.trigger.waitFor( { state: 'visible' } );

			await expect( widget.modal ).toHaveCount( 0 );
			expect( hashOf( page ) ).toBe( link );
		}
	} );

	test( 'brings the search back after a result was opened and the visitor went back', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { type: 'post', title: 'Guide to chairs' } ) ], facets: FACETS } );
		await page.route( 'https://example.test/**', ( route ) => route.fulfill( { status: 200, contentType: 'text/html', body: '<!doctype html><title>A result</title><p>A result</p>' } ) );

		const start = await createBlockPost( requestUtils, { mode: 'icon' } );

		await page.goto( start );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await expect.poll( () => hashOf( page ) ).toBe( '#searcio?q=guide' );

		await widget.cards.first().click();
		await page.waitForURL( /^https:\/\/example\.test\// );
		await page.goBack();

		await expect( widget.modal ).toBeVisible();
		await expect( widget.input ).toHaveValue( 'guide' );
		await expect( widget.cards.first() ).toBeVisible();
	} );
} );
