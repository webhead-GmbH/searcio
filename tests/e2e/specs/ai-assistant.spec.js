/**
 * The AI Assistant tab. It's gated by `/storefront-config`'s
 * `capabilities.assistant`, so it appears only when the plan includes it; a chat
 * turn calls `/assistant` and renders the reply plus the products, and a Compare
 * button turns those products into an attribute table. The Search Cloud API is
 * mocked (see mockSearchCloud) so both the capability flag and the assistant
 * reply are deterministic.
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

test.describe( 'AI Assistant tab', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'is hidden when the plan does not include the assistant', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { assistant: false } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( page.locator( '.whsc-modal-tabs' ) ).toHaveCount( 0 );
	} );

	test( 'answers with products and compares them when the plan includes the assistant', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			assistant: true,
			assistantReply: 'Here are a few under €100.',
			assistantProducts: [
				postHit( { title: 'Pure Snow Shell', brand: 'PeakNord', color: 'Alpine White' }, 'p-1' ),
				postHit( { title: 'Jet Black Padded', brand: 'FrostGuard', color: 'Onyx Black' }, 'p-2' ),
			],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await page.getByRole( 'tab', { name: /assistant/i } ).click();

		const input = page.locator( '.whsc-assistant__input' );
		await input.fill( 'a warm jacket' );
		await input.press( 'Enter' );

		// The reply text and the product grid render.
		await expect( page.locator( '.whsc-assistant__bubble', { hasText: 'Here are a few under €100.' } ) ).toBeVisible();
		await expect( page.locator( '.whsc-assistant__grid .whsc-card' ) ).toHaveCount( 2 );

		// Compare turns the products into an attribute table.
		await page.getByRole( 'button', { name: /^compare$/i } ).click();
		await expect( page.locator( '.whsc-compare__table' ) ).toBeVisible();
		await expect( page.locator( '.whsc-compare' ) ).toContainText( 'PeakNord' );
		await expect( page.locator( '.whsc-compare' ) ).toContainText( 'Alpine White' );
	} );

	test( 'surfaces a friendly message when the AI usage cap is hit', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { assistant: true, assistantStatus: 429 } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await page.getByRole( 'tab', { name: /assistant/i } ).click();

		const input = page.locator( '.whsc-assistant__input' );
		await input.fill( 'anything' );
		await input.press( 'Enter' );

		await expect( page.locator( '.whsc-assistant__error' ) ).toBeVisible();
	} );
} );
