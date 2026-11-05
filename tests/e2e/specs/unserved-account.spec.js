/**
 * The storefront of an account Searcio does not serve: without an active plan
 * every call is answered 402, for a suspended account 403, each with a
 * `reason`. A search the shopper submits goes to WordPress's own `?s=` search.
 * One that runs while they type only says search is unavailable: a keystroke
 * must not take them off the page with half a word as their query.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Storefront of an account that is not served', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	for ( const reason of [ 'no_active_plan', 'payment_overdue', 'account_suspended' ] ) {
		test( `a submitted search falls back to WordPress search (${ reason })`, async ( { page, requestUtils } ) => {
			await mockSearchCloud( page, { accountRefusal: reason } );
			await page.goto( await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'submit' } ) );

			const widget = new SearchWidget( page );
			await widget.openModal();
			await widget.search( 'boots' );

			await page.waitForURL( /[?&]s=boots/ );
		} );

		test( `a search while typing only says search is unavailable (${ reason })`, async ( { page, requestUtils } ) => {
			await mockSearchCloud( page, { accountRefusal: reason } );
			const post = await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'type' } );
			await page.goto( post );

			const widget = new SearchWidget( page );
			await widget.openModal();

			const refused = page.waitForResponse(
				( response ) => response.url().includes( '/search?' ) && 'boots' === new URL( response.url() ).searchParams.get( 'q' )
			);
			await widget.input.fill( 'boots' );
			expect( ( await refused ).status() ).toBe( 'account_suspended' === reason ? 403 : 402 );

			await expect( widget.modal.getByRole( 'alert' ) ).toBeVisible();
			await expect( widget.input ).toHaveValue( 'boots' );
			await expect( page ).toHaveURL( post );
		} );
	}
} );
