/**
 * The type switch and a field group's values, as the filter bar draws them:
 * a pill per type from a `/search` response's `facets.types`, a button per
 * field group that opens its values (a popover, or on a phone a sheet), and
 * every pick applied at once.
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

	test( 'renders a pill per type and filters on click', async ( { page, requestUtils } ) => {
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

		const pills = widget.typeSwitch.getByRole( 'button' );

		// "All" plus one pill per returned type; on a phone no pressed type is all.
		await expect( pills ).toHaveCount( 'mobile-chrome' === test.info().project.name ? 2 : 3 );

		const post = widget.typeSwitch.getByRole( 'button', { name: /^post/ } );

		await post.click();

		await expect( post ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect
			.poll( () => searches.some( ( url ) => 'post' === url.searchParams.get( 'type' ) ) )
			.toBeTruthy();
	} );

	test( 'shows no switch when the results have one type and none is pressed', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { type: 'product', brand: 'Acme' } ) ],
			facets: { types: [ { value: 'product', count: 1 } ], brand: [ { value: 'Acme', count: 1 } ] },
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );

		await expect( widget.groupButton( 'Brand' ) ).toBeVisible();
		await expect( widget.typeSwitch ).toHaveCount( 0 );
	} );
} );

test.describe( 'Field facets', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'opens a group\'s values as checkboxes and applies a pick as it is made', async ( { page, requestUtils } ) => {
		const searches = [];
		await mockSearchCloud( page, {
			hits: [ postHit( { type: 'product', brand: 'Acme' } ) ],
			facets: { types: [ { value: 'product', count: 1 } ], brand: [ { value: 'Acme', count: 1 }, { value: 'Duff', count: 1 } ] },
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'chair' );

		const panel = await widget.openGroup( 'Brand' );
		const acme = panel.getByRole( 'checkbox', { name: /Acme/ } );

		await expect( panel.getByRole( 'group', { name: 'Brand' } ) ).toBeVisible();
		await acme.check();

		await expect( acme ).toBeChecked();
		await expect.poll( () => searches.some( ( url ) => 'Acme' === url.searchParams.get( 'filter[brand]' ) ) ).toBe( true );
		// Picked, not applied by a button: the panel is still open.
		await expect( panel ).toBeVisible();
		await expect( widget.groupButton( 'Brand' ) ).toHaveText( /Brand: Acme/ );
	} );

	test( 'an empty field with a filter browses the catalogue by it', async ( { page, requestUtils } ) => {
		const searches = [];
		await mockSearchCloud( page, {
			hits: [ postHit( { type: 'product', brand: 'Acme', title: 'Acme chair' } ) ],
			facets: { types: [ { value: 'product', count: 1 } ], brand: [ { value: 'Acme', count: 1 }, { value: 'Duff', count: 3 } ] },
			onSearch: ( url ) => searches.push( url ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.resultsHeading ).toHaveText( 'Current highlights' );

		const panel = await widget.openGroup( 'Brand' );
		await panel.getByRole( 'checkbox', { name: /Acme/ } ).check();

		// A search of the whole catalogue with the filter, not the highlights
		// narrowed by it: no term, no page size of the highlights.
		await expect
			.poll( () => searches.some( ( url ) => ! url.searchParams.get( 'q' ) && 'Acme' === url.searchParams.get( 'filter[brand]' ) && '20' === url.searchParams.get( 'per_page' ) ) )
			.toBe( true );
		await expect( widget.resultsHeading ).toHaveText( '1 result' );
	} );
} );
