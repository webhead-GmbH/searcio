/**
 * Graceful degradation when the plugin has no search key: the trigger and modal
 * still work, but submitting a query hands off to WordPress's native `?s=`
 * search instead of calling Search Cloud. Restores the key afterwards so the
 * other specs are unaffected regardless of run order.
 */

import {
	test,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Unconfigured plugin', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils, '' );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'submitting a search falls back to native ?s= search', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'raincoat' );

		await page.waitForURL( /[?&]s=raincoat/ );
	} );
} );
