/**
 * What the storefront tells Searcio about each search, for the site's search
 * statistics (`docs/api/search.md`): whether a search as you type is `live`,
 * how a settled search was started (`origin`), where results are shown
 * (`surface`), whether the page is a builder's editor (`preview`), and a click
 * beacon from every list a visitor can open a result from.
 *
 * Read from the requests the page really sends, through the API mock.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

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

const RECENT_KEY = 'webheadSearchCloud.recentSearches';
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const hint = ( url, name ) => url.searchParams.get( name );

/** Every click beacon the page sends, as its form fields. */
const beacons = ( page ) => {
	const sent = [];

	page.on( 'request', ( request ) => {
		if ( request.url().includes( '/search/click' ) ) {
			sent.push( Object.fromEntries( new URLSearchParams( request.postData() || '' ) ) );
		}
	} );

	return sent;
};

/** A link a card opens goes nowhere, so a click does not leave the page under test. */
const stayOnPage = ( page ) => page.route( 'https://example.test/**', ( route ) => route.fulfill( { status: 204, body: '' } ) );

async function createPage( requestUtils, content ) {
	const post = await requestUtils.createPost( { title: 'Analytics page', content, status: 'publish' } );

	return `/?p=${ post.id }`;
}

test.describe( 'search analytics', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'a search as you type is live until Enter settles it, and only the settled words are remembered', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, { onSearch: ( url ) => searches.push( url ) } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'type' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.input.pressSequentially( 'jacke', { delay: 30 } );
		await expect.poll( () => searches.some( ( url ) => 'jacke' === hint( url, 'q' ) ) ).toBeTruthy();

		await widget.input.press( 't' );
		await expect.poll( () => searches.some( ( url ) => 'jacket' === hint( url, 'q' ) ) ).toBeTruthy();
		await widget.input.press( 'Enter' );
		await expect.poll( () => searches.filter( ( url ) => 'jacket' === hint( url, 'q' ) ).length ).toBe( 2 );

		const [ highlights ] = searches;
		const live = searches.filter( ( url ) => '1' === hint( url, 'live' ) );
		const settled = searches.filter( ( url ) => 'typed' === hint( url, 'origin' ) );

		// An empty query is sent without `q` at all.
		expect( hint( highlights, 'q' ) ).toBeNull();
		expect( hint( highlights, 'surface' ) ).toBe( 'highlights' );
		expect( live.map( ( url ) => hint( url, 'q' ) ) ).toEqual( [ 'jacke', 'jacket' ] );
		live.forEach( ( url ) => expect( hint( url, 'origin' ) ).toBeNull() );
		// The settled search went out although a live request for the same
		// words had just been answered.
		expect( settled.map( ( url ) => hint( url, 'q' ) ) ).toEqual( [ 'jacket' ] );
		expect( hint( settled[ 0 ], 'live' ) ).toBeNull();
		searches.slice( 1 ).forEach( ( url ) => expect( hint( url, 'surface' ) ).toBe( 'overlay' ) );
		searches.forEach( ( url ) => expect( hint( url, 'preview' ) ).toBeNull() );

		expect( await page.evaluate( ( key ) => JSON.parse( localStorage.getItem( key ) ), RECENT_KEY ) ).toEqual( [ 'jacket' ] );
	} );

	test( 'a recent search, a popular search and a suggestion each say how the search started', async ( { page, requestUtils } ) => {
		const searches = [];

		await page.addInitScript( ( key ) => localStorage.setItem( key, JSON.stringify( [ 'boots' ] ) ), RECENT_KEY );
		await mockSearchCloud( page, {
			popular: [ { query: 'scarves' } ],
			suggestions: [ 'Jacket with hood' ],
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		const origin = ( q ) => hint( searches.find( ( url ) => q === hint( url, 'q' ) ), 'origin' );

		await widget.openModal();

		await widget.modal.locator( '.whsc-chip__label', { hasText: 'boots' } ).click();
		await expect.poll( () => origin( 'boots' ) ).toBe( 'recent' );

		await widget.input.fill( '' );
		await widget.modal.locator( '.whsc-popular-item', { hasText: 'scarves' } ).click();
		await expect.poll( () => origin( 'scarves' ) ).toBe( 'popular' );

		await widget.input.fill( 'jac' );
		await widget.modal.getByRole( 'option', { name: 'Jacket with hood' } ).click();
		await expect.poll( () => origin( 'Jacket with hood' ) ).toBe( 'suggestion' );
	} );

	test( 'a filter picked with words in the field is a settled search started by the filter', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, {
			facets: { types: [ { value: 'post', count: 3 }, { value: 'page', count: 1 } ] },
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await expect( widget.cards.first() ).toBeVisible();
		await widget.typeSwitch.getByRole( 'button', { name: /^post/ } ).click();

		await expect.poll( () => searches.find( ( url ) => 'post' === hint( url, 'type' ) ) ).toBeTruthy();

		const picked = searches.find( ( url ) => 'post' === hint( url, 'type' ) );

		expect( hint( picked, 'origin' ) ).toBe( 'filter' );
		expect( hint( picked, 'surface' ) ).toBe( 'overlay' );
	} );

	test( '"Load more" says where its results are shown, and nothing that would count it again', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, { total: 40, onSearch: ( url ) => searches.push( url ) } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await widget.loadMore.click();

		await expect.poll( () => searches.find( ( url ) => '2' === hint( url, 'page' ) ) ).toBeTruthy();

		const more = searches.find( ( url ) => '2' === hint( url, 'page' ) );

		expect( hint( more, 'surface' ) ).toBe( 'overlay' );
		expect( hint( more, 'origin' ) ).toBeNull();
		expect( hint( more, 'live' ) ).toBeNull();
	} );

	test( 'a middle click on a result is counted like a click', async ( { page, requestUtils, context } ) => {
		const sent = beacons( page );

		await stayOnPage( context );
		await mockSearchCloud( page, { hits: [ postHit( {}, 'post-1' ), postHit( { title: 'Second' }, 'post-2' ) ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await widget.cards.nth( 1 ).click( { button: 'middle' } );

		await expect.poll( () => sent ).toEqual( [ { search_id: 'search-e2e', document_id: 'post-2', position: '2' } ] );
	} );

	test( 'a page builder\'s editor marks its searches a preview and remembers none of them', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, { onSearch: ( url ) => searches.push( url ) } );
		// Beaver Builder's editor canvas is the page with `?fl_builder`; the
		// plugin needs no Beaver Builder to read it.
		const url = new URL( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		url.searchParams.set( 'fl_builder', '' );
		await page.goto( url.toString() );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'guide' );
		await expect.poll( () => searches.length ).toBeGreaterThanOrEqual( 2 );

		searches.forEach( ( url ) => expect( hint( url, 'preview' ) ).toBe( '1' ) );
		expect( await page.evaluate( ( key ) => localStorage.getItem( key ), RECENT_KEY ) ).toBeNull();
	} );

	test( 'a similar-products row sends a beacon with its own search, and a category row says where it is', async ( { page, requestUtils, context } ) => {
		const sent = beacons( page );
		const searches = [];

		await stayOnPage( context );
		await mockSearchCloud( page, {
			similar: [ postHit( { type: 'product', title: 'One' }, 'p-1' ), postHit( { type: 'product', title: 'Two' }, 'p-2' ) ],
			similarSearchId: 'similar-e2e',
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createPage(
			requestUtils,
			'<!-- wp:webhead-search-cloud/products {"source":"similar","documentId":"product-9"} /-->' +
			'<!-- wp:webhead-search-cloud/products {"source":"category","filterField":"categories","filterValue":"Jackets"} /-->'
		) );

		const similar = page.locator( '[data-source="similar"] .whsc-card' );

		await similar.nth( 1 ).click();
		await expect.poll( () => sent ).toEqual( [ { search_id: 'similar-e2e', document_id: 'p-2', position: '2' } ] );

		expect( searches.map( ( url ) => hint( url, 'surface' ) ) ).toEqual( [ 'category' ] );
	} );

	test( 'a photo search\'s results send a beacon', async ( { page, requestUtils, context } ) => {
		const sent = beacons( page );
		const photo = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'whsc-' ) ), 'dress.png' );

		fs.writeFileSync( photo, Buffer.from( PIXEL, 'base64' ) );
		await stayOnPage( context );
		await mockSearchCloud( page, { visualSearch: true, visualSearchId: 'photo-e2e' } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.searchByPhoto( photo );
		await widget.cards.first().click();

		await expect.poll( () => sent ).toEqual( [ { search_id: 'photo-e2e', document_id: 'visual-1', position: '1' } ] );
	} );

	test( 'an assistant product sends a beacon with the search that found it, from a card and from the table', async ( { page, requestUtils, context } ) => {
		const sent = beacons( page );

		await stayOnPage( context );
		await mockSearchCloud( page, {
			assistant: true,
			assistantProducts: [
				{ ...postHit( { title: 'Shell', brand: 'PeakNord' }, 'p-1' ), search_id: 's-a' },
				{ ...postHit( { title: 'Padded', brand: 'FrostGuard' }, 'p-2' ), search_id: 's-b' },
				{ ...postHit( { title: 'Parka', brand: 'PeakNord' }, 'p-3' ), search_id: 's-a' },
			],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.openTab( /assistant/i );
		await page.locator( '.whsc-assistant__input' ).fill( 'a warm jacket' );
		await page.locator( '.whsc-assistant__input' ).press( 'Enter' );

		const grid = page.locator( '.whsc-assistant__grid .whsc-card' );

		await grid.nth( 2 ).click();
		await expect.poll( () => sent ).toEqual( [ { search_id: 's-a', document_id: 'p-3', position: '2' } ] );

		await page.getByRole( 'button', { name: /compare/i } ).click();
		await page.locator( '.whsc-compare__product' ).nth( 1 ).click( { button: 'middle' } );
		await expect.poll( () => sent.length ).toBe( 2 );
		expect( sent[ 1 ] ).toEqual( { search_id: 's-b', document_id: 'p-2', position: '1' } );
	} );

	test( 'the product finder\'s matches say where they are shown', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, {
			quiz: true,
			quizzes: [ {
				id: 4,
				name: 'Find your fit',
				questions: [ {
					id: 'style',
					text: "What's your style?",
					options: [ { id: 'casual', label: 'Casual', next_question_id: null, tags_matched: [ { field: 'style', value: 'casual' } ] } ],
				} ],
			} ],
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.openTab( /product finder/i );
		await widget.answerQuiz( 'Casual' );
		await expect( widget.quizCards.first() ).toBeVisible();

		const final = searches.find( ( url ) => 'casual' === hint( url, 'filter[style]' ) );

		expect( hint( final, 'surface' ) ).toBe( 'quiz' );
	} );
} );
