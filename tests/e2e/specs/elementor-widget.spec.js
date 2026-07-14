/**
 * Elementor widget smoke test. The Elementor widget shares the exact same
 * front-end runtime and modal as the block (covered exhaustively by the other
 * specs), so this only proves the Elementor embed point renders a working
 * trigger end-to-end. It skips when Elementor is not active, or when the
 * Elementor-rendered page did not produce a trigger in this environment.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createElementorPost,
	isPluginActive,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Elementor widget', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'renders a trigger that opens the modal', async ( { page, requestUtils } ) => {
		test.skip( ! ( await isPluginActive( requestUtils, 'elementor' ) ), 'Elementor is not active.' );

		await mockSearchCloud( page );
		await page.goto( createElementorPost( 'icon' ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.modal ).toBeVisible();

		// The Elementor widget shares the block's runtime, so a real query works too.
		await widget.search( 'jacket' );
		await expect( widget.modal.locator( '.whsc-card' ).first() ).toBeVisible();
	} );
} );
