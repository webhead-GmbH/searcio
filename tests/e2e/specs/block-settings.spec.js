/**
 * The selects in the Searcio blocks' settings sidebar.
 *
 * They are `SelectControl` from `@wordpress/ui`, which hands over the whole
 * item it was given rather than its value. Wired straight into an attribute, a
 * pick saved the item, and a string attribute does not keep an object, so the
 * choice was gone the next time the post was opened. This pins that a pick
 * lands in the block as the option's value.
 */

import { test, expect } from '../utils';

/**
 * Open a select and pick one of its options. The list is portalled out of the
 * sidebar, and only one is open at a time.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} select The select's trigger.
 * @param {string}                             label  The option's label.
 */
async function pick( page, select, label ) {
	await select.click();
	await page.getByRole( 'option', { name: label, exact: true } ).click();
	await expect( select ).toHaveText( label );
}

test.describe( "The blocks' settings selects", () => {
	test( 'keep what the products block is set to', async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.insertBlock( { name: 'webhead-search-cloud/products' } );
		await editor.openDocumentSettingsSidebar();

		const inspector = page.getByRole( 'region', { name: 'Editor settings' } );

		await pick( page, inspector.getByRole( 'combobox', { name: 'Show', exact: true } ), 'Category listing' );
		await pick( page, inspector.getByRole( 'combobox', { name: 'Layout', exact: true } ), 'Grid' );
		await pick( page, inspector.getByRole( 'combobox', { name: 'Card source', exact: true } ), 'Searcio templates' );

		// What a category listing asks for in place of a product.
		await expect( inspector.getByRole( 'textbox', { name: 'Filter field' } ) ).toBeVisible();

		const [ block ] = await editor.getBlocks();

		expect( block.attributes ).toMatchObject( { source: 'category', layout: 'grid', cardSource: 'server' } );
	} );

	test( 'keep what the search block is set to', async ( { admin, editor, page } ) => {
		await admin.createNewPost();
		await editor.insertBlock( { name: 'webhead-search-cloud/search' } );
		await editor.openDocumentSettingsSidebar();

		const inspector = page.getByRole( 'region', { name: 'Editor settings' } );

		await pick( page, inspector.getByRole( 'combobox', { name: 'Card source', exact: true } ), 'Searcio templates' );
		await pick( page, inspector.getByRole( 'combobox', { name: 'Highlights source', exact: true } ), 'Featured' );
		await pick( page, inspector.getByRole( 'combobox', { name: 'Open animation', exact: true } ), 'None' );

		// The duration is only asked for an animation there is.
		await expect( inspector.getByRole( 'spinbutton', { name: 'Animation duration (ms)' } ) ).toHaveCount( 0 );

		const [ block ] = await editor.getBlocks();

		expect( block.attributes ).toMatchObject( { cardSource: 'server', highlightsSource: 'featured', animation: 'none' } );
	} );
} );
