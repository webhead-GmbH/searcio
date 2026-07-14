/**
 * Responsive layout integrity. Because every spec runs on both the desktop and
 * mobile projects, this focuses on the layout invariants that most often break
 * on small screens: the modal opening and being usable, and the page never
 * gaining a horizontal scrollbar while the modal is open.
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

test.describe( 'Responsive layout', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'the modal opens, searches, and never causes horizontal overflow', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { title: 'Waterproof Jacket' } ) ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'jacket' );
		await expect( widget.modal.getByText( 'Waterproof Jacket' ) ).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
		);
		expect( hasHorizontalOverflow ).toBe( false );
	} );

	test( 'the modal covers a large share of a mobile viewport', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' !== testInfo.project.name, 'Mobile-only expectation.' );

		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const box = await widget.modal.boundingBox();
		const viewport = page.viewportSize();
		expect( box.width ).toBeGreaterThan( viewport.width * 0.85 );
	} );
} );
