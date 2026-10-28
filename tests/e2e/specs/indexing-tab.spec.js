/**
 * The Indexing tab's selects. Runs authenticated as admin (the default
 * storage state) and mocks the plugin's own `/indexing/config`, so the
 * catalogue is fixed and what the tab saves is captured rather than stored.
 *
 * The selects are `SelectControl` from `@wordpress/ui`, which hands over the
 * whole item it was given rather than its value. Wired to a string, a pick
 * stored "[object Object]": the extra field's "From" showed it and kept
 * asking for a meta key, and the PHP side dropped a result source it could
 * not read as a string. How the saved mapping is cleaned is the integration
 * suite's to prove (`Index_Config_Test`); this pins what the tab sends.
 */

import { test, expect } from '../utils';

const SETTINGS_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=indexing';

// A tab waits on the settings response, then on its own.
const LOADED = { timeout: 30000 };

const PRODUCT = {
	slug: 'product',
	label: 'Products',
	is_product: true,
	taxonomies: [
		{ slug: 'product_brand', label: 'Brands' },
		{ slug: 'product_cat', label: 'Product categories' },
	],
	config: {
		enabled: true,
		type: 'product',
		title_source: 'property:title',
		content_source: 'property:content',
		url_source: 'property:permalink',
		image_source: 'property:thumbnail',
		include_excerpt: true,
		include_private: false,
		fields: [],
		woo: {},
	},
};

/**
 * The catalogue `Index_Config::catalog()` answers with, for one post type.
 *
 * @param {Object} config The product's mapping.
 * @return {Object} The `/indexing/config` response.
 */
const catalog = ( config ) => ( {
	post_types: [ { ...PRODUCT, config } ],
	sources: [
		{ value: 'property:title', label: 'Post title' },
		{ value: 'property:content', label: 'Post content' },
		{ value: 'property:excerpt', label: 'Excerpt' },
		{ value: 'property:permalink', label: 'Permalink (URL)' },
		{ value: 'property:thumbnail', label: 'Featured image' },
	],
	woo: { active: true, meets_minimum: true, version: '11.2.0', minimum: '8.0', attributes: [], toggles: [] },
	languages: { active: false, available: [] },
	indexed_fields: [ 'title', 'content', 'type', 'url' ],
	config_version: 1,
} );

/**
 * Answer `/indexing/config` with the fixed catalogue, and a save with what was
 * sent, capturing each save's body.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array}                           sent Receives each save's body.
 */
async function mockCatalog( page, sent ) {
	await page.route(
		// Decode first: with plain permalinks apiFetch hits `?rest_route=…`.
		( url ) => decodeURIComponent( url.href ).includes( '/indexing/config' ),
		( route ) => {
			let body = catalog( PRODUCT.config );

			if ( 'GET' !== route.request().method() ) {
				const data = route.request().postDataJSON();

				sent.push( data );
				body = catalog( data.config.product );
			}

			return route.fulfill( {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( body ),
			} );
		}
	);
}

/**
 * Open a select and pick one of its options. The list is portalled out of the
 * card, and only one is open at a time.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} select The select's trigger.
 * @param {string}                             label  The option's label.
 */
async function pick( page, select, label ) {
	await select.click();
	await page.getByRole( 'option', { name: label, exact: true } ).click();
}

test.describe( 'Indexing tab', () => {
	test( 'keeps what each select is set to, and sends it as a string', async ( { page } ) => {
		const sent = [];

		await mockCatalog( page, sent );
		await page.goto( SETTINGS_URL );

		const card = page.locator( '.whsc-post-type-card' ).filter( { has: page.getByRole( 'heading', { name: 'Products' } ) } );

		await card.getByRole( 'button', { name: 'Show advanced options' } ).click( LOADED );
		await card.getByRole( 'button', { name: 'Add a field' } ).click();

		const row = card.locator( '.whsc-custom-field-row' );
		const from = row.getByRole( 'combobox', { name: 'From', exact: true } );

		await row.getByRole( 'textbox', { name: 'Send as' } ).fill( 'brand' );
		await expect( from ).toHaveText( 'Custom field' );
		await expect( row.getByRole( 'textbox', { name: 'Meta key' } ) ).toBeVisible();

		await pick( page, from, 'Taxonomy' );

		await expect( from ).toHaveText( 'Taxonomy' );
		await expect( row.getByRole( 'textbox', { name: 'Meta key' } ) ).toHaveCount( 0 );

		const taxonomy = row.getByRole( 'combobox', { name: 'Taxonomy', exact: true } );

		await pick( page, taxonomy, 'Brands' );
		await expect( taxonomy ).toHaveText( 'Brands' );

		// The picked option is the one the list marks as chosen.
		await from.click();
		await expect( page.getByRole( 'option', { selected: true } ) ).toHaveText( 'Taxonomy' );
		await page.keyboard.press( 'Escape' );

		const body = card.getByRole( 'combobox', { name: 'Body text', exact: true } );
		const image = card.getByRole( 'combobox', { name: 'Thumbnail image', exact: true } );

		await pick( page, body, 'Excerpt' );
		await pick( page, image, '- Do not send -' );

		await expect( body ).toHaveText( 'Excerpt' );
		await expect( image ).toHaveText( '- Do not send -' );

		await page.getByRole( 'button', { name: 'Save indexing configuration' } ).click();

		await expect.poll( () => sent.length ).toBe( 1 );
		expect( sent[ 0 ].config.product ).toMatchObject( {
			title_source: 'property:title',
			content_source: 'property:excerpt',
			url_source: 'property:permalink',
			image_source: '',
			fields: [ { as: 'brand', source: 'taxonomy:product_brand' } ],
		} );

		// Drawn again from what the save answered, the row still names its taxonomy.
		await expect( from ).toHaveText( 'Taxonomy' );
		await expect( taxonomy ).toHaveText( 'Brands' );
	} );
} );
