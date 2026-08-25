/**
 * Search by photo. Gated by `/storefront-config`'s `capabilities.visual_search`
 * so a shopper never sees a control that could only answer 403, and a
 * `multipart/form-data` POST whose response carries the same hits a typed search
 * would, plus the tags the vision model read out of the image.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

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

// A real 1x1 PNG: the browser will only put a file in the form if it exists.
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let photo;

test.beforeAll( () => {
	photo = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'whsc-' ) ), 'dress.png' );
	fs.writeFileSync( photo, Buffer.from( PIXEL, 'base64' ) );
} );

test.describe( 'search by photo', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'is hidden when the site has not turned photo search on', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: false } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.photoButton ).toHaveCount( 0 );
	} );

	test( 'uploads the photo and shows the matches with the tags it read', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			visualSearch: true,
			visualTags: [ 'red', 'silk', 'dress' ],
			visualHits: [
				postHit( { title: 'Red Silk Dress', type: 'product' }, 'v-1' ),
				postHit( { title: 'Crimson Wrap Dress', type: 'product' }, 'v-2' ),
			],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.photoButton ).toBeVisible();

		await widget.searchByPhoto( photo );

		await expect( widget.photoTags ).toHaveText( [ 'red', 'silk', 'dress' ] );
		await expect( widget.cards ).toHaveCount( 2 );
		await expect( widget.modal.getByText( 'Red Silk Dress' ) ).toBeVisible();
	} );

	test( 'posts the image as multipart with the search key in the query string', async ( { page, requestUtils } ) => {
		const uploads = [];

		page.on( 'request', ( request ) => {
			if ( request.url().includes( '/search/visual' ) && 'POST' === request.method() ) {
				uploads.push( request );
			}
		} );

		await mockSearchCloud( page, { visualSearch: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );
		await expect( widget.photoTags.first() ).toBeVisible();

		expect( uploads ).toHaveLength( 1 );
		// The credential has to be in the URL: a preflight carries no custom
		// headers, so a header-only key leaves the API unable to answer CORS.
		expect( uploads[ 0 ].url() ).toContain( 'key=' );
		expect( uploads[ 0 ].headers()[ 'content-type' ] ).toContain( 'multipart/form-data' );
	} );

	/** A photo with nothing recognisable in it is an empty search, not an error. */
	test( 'shows a photo-specific empty state rather than the highlights carousel', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualTags: [], visualHits: [] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		await expect( widget.modal.locator( '.whsc-no-results' ) ).toContainText( 'photo' );
	} );

	test( 'explains a rejected image instead of failing silently', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualStatus: 422 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		await expect( widget.modal.locator( '.components-notice' ) ).toContainText( 'image' );
	} );

	test( 'says so when the monthly allowance is spent', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualStatus: 429 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		await expect( widget.modal.locator( '.components-notice' ) ).toContainText( 'limit' );
	} );
} );
