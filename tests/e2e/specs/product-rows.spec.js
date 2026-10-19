/**
 * Product rows placed on the storefront rather than inside the search modal.
 *
 * Two sources, and the thing worth pinning is what each one actually asks the
 * API for: "similar" must send the id of the product being viewed, and
 * "category" must send `filter[field]=value` - that filter is the only reason a
 * merchandising rule's category trigger ever fires.
 */

import {
	test,
	expect,
	mockSearchCloud,
	configureSearchKey,
	postHit,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const PRODUCTS = [
	postHit( { title: 'Cotton Crew Tee', type: 'product' }, 'p-1' ),
	postHit( { title: 'Relaxed Linen Shirt', type: 'product' }, 'p-2' ),
];

/**
 * A published post carrying the products block.
 *
 * Navigated by `?p=<id>` rather than the returned permalink: the row resolves
 * its subject from the page, so the test has to be on the single post and not
 * on an archive that happens to list it (where `is_singular()` is false and
 * every other post's row would render too).
 */
async function createRowPost( requestUtils, attributes ) {
	const post = await requestUtils.createPost( {
		title: 'Product row page',
		content: `<!-- wp:webhead-search-cloud/products ${ JSON.stringify( attributes ) } /-->`,
		status: 'publish',
	} );

	return { id: post.id, url: `/?p=${ post.id }` };
}

test.describe( 'product rows', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'similar products asks about the post being viewed', async ( { page, requestUtils } ) => {
		const seen = [];

		page.on( 'request', ( request ) => {
			if ( request.url().includes( '/search/similar' ) ) {
				seen.push( new URL( request.url() ) );
			}
		} );

		await mockSearchCloud( page, { similar: PRODUCTS } );

		const post = await createRowPost( requestUtils, { source: 'similar', heading: 'You may also like' } );
		await page.goto( post.url );

		await expect( page.locator( '.whsc-products .whsc-card' ).first() ).toBeVisible( { timeout: 20000 } );
		await expect( page.getByText( 'You may also like' ) ).toBeVisible();

		expect( seen ).toHaveLength( 1 );
		// The id the indexer pushes for this post, resolved from the page.
		expect( seen[ 0 ].searchParams.get( 'id' ) ).toBe( `post-${ post.id }` );
	} );

	test( 'a category row sends the filter that makes a merchandising rule fire', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, {
			hits: PRODUCTS,
			banner: 'Winter sale - up to 40% off',
			onSearch: ( url ) => searches.push( url ),
		} );

		const post = await createRowPost( requestUtils, {
			source: 'category',
			filterField: 'categories',
			filterValue: 'Jackets',
			layout: 'grid',
		} );
		await page.goto( post.url );

		await expect( page.locator( '.whsc-products .whsc-card' ).first() ).toBeVisible( { timeout: 20000 } );

		const last = searches[ searches.length - 1 ];
		expect( last.searchParams.get( 'filter[categories]' ) ).toBe( 'Jackets' );

		// The rule's banner arrives with that response and belongs above the row.
		await expect( page.locator( '.whsc-products .whsc-banner' ) ).toHaveText( 'Winter sale - up to 40% off' );
	} );

	/**
	 * A site without AI search answers `/search/similar` with an empty list
	 * rather than an error - an empty box left on the page would be worse than
	 * no row at all.
	 */
	test( 'renders nothing when there is nothing to show', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { similar: [] } );

		const post = await createRowPost( requestUtils, { source: 'similar', heading: 'You may also like' } );
		await page.goto( post.url );

		await expect( page.locator( '.whsc-products__heading' ) ).toHaveCount( 0 );
		await expect( page.locator( '.whsc-products .whsc-card' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'You may also like' ) ).toHaveCount( 0 );
	} );

	test( 'a failed request leaves the page exactly as it would have been', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { similarStatus: 500 } );

		const post = await createRowPost( requestUtils, { source: 'similar', heading: 'You may also like' } );
		await page.goto( post.url );

		await expect( page.locator( '.whsc-products .whsc-card' ) ).toHaveCount( 0 );
		// No error banner, no empty heading: merchandising is an enhancement.
		await expect( page.getByText( 'You may also like' ) ).toHaveCount( 0 );
	} );
} );
