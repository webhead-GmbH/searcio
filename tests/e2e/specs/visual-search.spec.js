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

	/**
	 * A photo search takes seconds, and before this the column kept its
	 * "Results" heading over a skeleton with nothing saying which photo it was
	 * about - or that one had been taken at all.
	 */
	test( 'shows the photo it is searching with, and keeps it beside the results', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualDelay: 1500 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		const thumbnail = widget.modal.getByRole( 'img', { name: 'Your photo' } );

		await expect( widget.resultsHeading ).toHaveText( 'Looking at your photo…' );
		await expect( thumbnail ).toBeVisible();

		await expect( widget.cards ).toHaveCount( 1 );
		await expect( thumbnail ).toBeVisible();
		// The tags belong to this search, so they sit in its column, beside the
		// photo they came from - not above the recent searches, pushing them down.
		await expect( widget.modal.locator( '.whsc-browse__main .whsc-visual-query .whsc-visual-tag' ) ).toHaveText( [ 'red', 'silk', 'dress' ] );
	} );

	/**
	 * Centred, the photo floated beside the middle of four wrapped rows of tags
	 * on a phone. It lines up with the first row; a single row stays centred.
	 */
	/**
	 * The camera came wrapped in a span, whose svg sat on a line of text: 4px
	 * above the close icon beside it.
	 */
	test( 'keeps the camera on the line of the close icon', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.photoButton ).toBeVisible();

		const middle = async ( locator ) => {
			const box = await locator.boundingBox();

			return box.y + ( box.height / 2 );
		};
		const camera = await middle( widget.photoButton.locator( 'svg' ) );
		const close = await middle( widget.modal.locator( '.whsc-modal-close svg' ) );

		expect( Math.abs( camera - close ) ).toBeLessThanOrEqual( 1 );
	} );

	test( 'lines the photo up with the first row of tags', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 320, height: 640 } );
		await mockSearchCloud( page, {
			visualSearch: true,
			visualTags: [ 'hoodie', 'light blue', 'cotton', 'graphic print', 'casual', 'youth', 'streetwear', 'daily wear', 'relaxed fit' ],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );
		await expect( widget.photoTags.first() ).toBeVisible();

		const photoBox = await widget.modal.locator( '.whsc-visual-query__photo' ).boundingBox();
		const tagsBox = await widget.modal.locator( '.whsc-visual-tags' ).boundingBox();

		expect( tagsBox.height ).toBeGreaterThan( photoBox.height );
		expect( Math.abs( tagsBox.y - photoBox.y ) ).toBeLessThanOrEqual( 2 );
	} );

	/**
	 * A file that is not an image can still get a response (the server read it
	 * differently); the thumbnail then fails to load and hides itself. The
	 * frontend reset draws every image as a block, which outranked `hidden`.
	 */
	test( 'hides a thumbnail the browser cannot draw', async ( { page, requestUtils } ) => {
		const notAnImage = path.join( path.dirname( photo ), 'not-an-image.png' );
		fs.writeFileSync( notAnImage, 'this is not an image' );

		await mockSearchCloud( page, { visualSearch: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( notAnImage );

		await expect( widget.photoTags.first() ).toBeVisible();
		await expect( widget.modal.locator( '.whsc-visual-query__photo' ) ).toBeHidden();
	} );

	/** The hidden flag a failed thumbnail set stayed on the reused element. */
	test( 'shows the next photo after one that could not be drawn', async ( { page, requestUtils } ) => {
		const notAnImage = path.join( path.dirname( photo ), 'not-an-image-2.png' );
		fs.writeFileSync( notAnImage, 'this is not an image' );

		await mockSearchCloud( page, { visualSearch: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		const thumbnail = widget.modal.locator( '.whsc-visual-query__photo' );
		await widget.openModal();

		await widget.searchByPhoto( notAnImage );
		await expect( widget.photoTags.first() ).toBeVisible();
		await expect( thumbnail ).toBeHidden();

		await widget.searchByPhoto( photo );
		await expect( widget.photoTags.first() ).toBeVisible();
		await expect( thumbnail ).toBeVisible();
	} );

	/**
	 * A typed search run over a photo's results kept the photo's state until
	 * its own answer came back, so it was titled, shown and announced as a
	 * photo search while it ran.
	 */
	test( 'a typed search after a photo search is not presented as one', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			visualSearch: true,
			// Only the typed search is held, so its loading state can be seen.
			searchDelay: ( url ) => ( url.searchParams.get( 'q' ) ? 1500 : 0 ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );
		await expect( widget.photoTags.first() ).toBeVisible();

		await widget.search( 'shoes' );

		await expect( widget.resultsHeading ).toHaveText( 'Results' );
		await expect( widget.modal.locator( '.whsc-visual-query__photo' ) ).toHaveCount( 0 );
		await expect( widget.modal.locator( 'p.whsc-visually-hidden[role="status"]' ) ).toHaveText( /^Searching/ );
	} );

	/**
	 * The photo search clears the type chips and ranges it cannot use; a failed
	 * one went back to the highlights without them.
	 */
	test( 'a failed photo search brings the type chips back', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			visualSearch: true,
			visualStatus: 422,
			facets: { types: [ { value: 'post', count: 3 }, { value: 'page', count: 1 } ] },
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		const chips = widget.typeSwitch.getByRole( 'button' );
		await widget.openModal();
		await expect( chips.first() ).toBeVisible();

		await widget.searchByPhoto( photo );

		await expect( widget.modal.getByRole( 'alert' ) ).toBeVisible();
		await expect( chips.first() ).toBeVisible();
	} );

	/** An empty submit after a photo search left an empty results column. */
	test( 'an empty search after a photo search goes back to the highlights', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );
		await expect( widget.photoTags.first() ).toBeVisible();

		await widget.input.focus();
		await page.keyboard.press( 'Enter' );

		await expect( widget.resultsHeading ).toHaveText( 'Current highlights' );
		await expect( widget.modal.locator( '.whsc-visual-query__photo' ) ).toHaveCount( 0 );
	} );

	test( 'goes back to browsing when the photo cannot be read', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualStatus: 422 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		await expect( widget.modal.getByRole( 'alert' ) ).toBeVisible();
		// No thumbnail of a photo that produced nothing, and no results heading
		// over an empty column.
		await expect( widget.modal.getByRole( 'img', { name: 'Your photo' } ) ).toHaveCount( 0 );
		await expect( widget.resultsHeading ).toHaveText( 'Current highlights' );
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

		await expect( widget.modal.getByRole( 'alert' ) ).toContainText( 'image' );
	} );

	test( 'says so when the monthly allowance is spent', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualStatus: 429 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		await expect( widget.modal.getByRole( 'alert' ) ).toContainText( 'limit' );
	} );

	/**
	 * The message was a `Notice` of `@wordpress/components`, and looked like
	 * whichever version of that package the plugin was built with. It is the
	 * surface's own tinted block now, the one the assistant and the product
	 * finder show for their errors.
	 */
	test( 'draws the message as the surface draws an error', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { visualSearch: true, visualStatus: 429 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.searchByPhoto( photo );

		const message = widget.modal.getByRole( 'alert' );

		await expect( message ).toBeVisible();
		await expect( widget.modal.locator( '.components-notice' ) ).toHaveCount( 0 );
		await expect( message ).toHaveCSS( 'background-color', 'rgb(253, 242, 242)' );
		await expect( message ).toHaveCSS( 'color', 'rgb(179, 38, 30)' );
		await expect( message ).toHaveCSS( 'border-top-width', '0px' );

		// As wide as the modal's content, like the banner it stands in the place of.
		const widths = await message.evaluate( ( el ) => [ el.getBoundingClientRect().width, el.parentElement.clientWidth ] );

		expect( widths[ 0 ] ).toBeGreaterThan( widths[ 1 ] * 0.8 );
	} );
} );
