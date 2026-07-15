/**
 * Type-filter facets: the chips rendered from a `/search` response's
 * `facets.types`, and that clicking one re-queries scoped to that type.
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

test.describe( 'Type facets', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'renders a chip per type and filters on click', async ( { page, requestUtils } ) => {
		const searches = [];
		await mockSearchCloud( page, {
			hits: [ postHit() ],
			facets: { types: [ { value: 'post', count: 3 }, { value: 'page', count: 1 } ] },
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'guide' );

		// "All" plus one chip per returned type.
		const chips = widget.modal.locator( '.whsc-facets .whsc-facet' );
		await expect( chips ).toHaveCount( 3 );

		await widget.modal.locator( '.whsc-facet', { hasText: 'post' } ).click();

		await expect
			.poll( () => searches.some( ( url ) => 'post' === url.searchParams.get( 'type' ) ) )
			.toBeTruthy();
	} );
} );
