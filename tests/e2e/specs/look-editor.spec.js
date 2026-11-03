/**
 * The Placement tab's Look editor: every style setting of the Elementor
 * widget for what the tab places, per device where the widget has one, with
 * a preview at the device's width that shows a change as it is made.
 *
 * The site-wide settings are written over REST and reset after each test.
 */

import { test, expect, configureSearchKey, mockSearchCloud } from '../utils';

const TAB_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=placement&section=look';
const PLACEMENT_PATH = '/webhead-search-cloud/v1/placement';
const SCREEN = '#webhead-search-cloud-root';
const LOADED = { timeout: 15000 };

const savePlacement = ( requestUtils, placement ) =>
	requestUtils.rest( { path: PLACEMENT_PATH, method: 'POST', data: { placement } } );

const openEditor = async ( page ) => {
	await mockSearchCloud( page );
	await page.goto( TAB_URL );
	await page.locator( SCREEN ).getByRole( 'button', { name: 'Open the look editor' } ).click( LOADED );

	const dialog = page.getByRole( 'dialog', { name: 'Look editor' } );

	await expect( dialog ).toBeVisible();
	// The page in the preview has said it can be sent the look.
	await expect( page.frameLocator( '.whsc-look-editor__frame' ).locator( '#whsc-look-live' ) ).toBeAttached( LOADED );

	return dialog;
};

/** Sets a colour through its picker's hex field. */
const pickColour = async ( page, dialog, name, hex ) => {
	await dialog.getByRole( 'button', { name: new RegExp( `^${ name }` ) } ).first().click();
	await page.getByRole( 'textbox', { name: /hex/i } ).fill( hex );
};

test.describe( 'Look editor', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test.beforeEach( async ( { requestUtils } ) => {
		await savePlacement( requestUtils, {} );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await savePlacement( requestUtils, {} );
	} );

	test( 'shows a change in the preview at once, without loading the page again', async ( { page } ) => {
		const dialog = await openEditor( page );
		const frame = page.frameLocator( '.whsc-look-editor__frame' );

		// A mark on the preview's page, which a page loaded again would not have.
		await frame.locator( 'body' ).evaluate( () => {
			window.whscMark = 'kept';
		} );

		await dialog.getByRole( 'button', { name: /^Modal/ } ).click();
		await pickColour( page, dialog, 'Background', 'ffe9c2' );

		await expect( frame.locator( '#whsc-look-live' ) ).toHaveJSProperty( 'textContent', '.whsc-instance-preview{--whsc-bg:#ffe9c2}' );
		await expect.poll( () => frame.locator( '.whsc-instance-preview' ).first().evaluate( ( node ) => getComputedStyle( node ).getPropertyValue( '--whsc-bg' ).trim() ) ).toBe( '#ffe9c2' );
		expect( await frame.locator( 'body' ).evaluate( () => window.whscMark ) ).toBe( 'kept' );

		// The part says how many of its settings are set.
		await page.keyboard.press( 'Escape' );
		await dialog.getByRole( 'button', { name: 'All parts' } ).click();
		await expect( dialog.getByRole( 'button', { name: /^Modal/ } ) ).toContainText( '1 set' );
	} );

	test( 'Escape closes an open picker first, and the editor after it', async ( { page } ) => {
		const dialog = await openEditor( page );

		await dialog.getByRole( 'button', { name: /^Search field/ } ).click();
		await pickColour( page, dialog, 'Text color', '333333' );
		await expect( page.locator( '.components-popover' ) ).toHaveCount( 1 );

		// Typing in the picker leaves it open.
		await expect( page.getByRole( 'textbox', { name: /hex/i } ) ).toBeFocused();

		await page.keyboard.press( 'Escape' );
		await expect( page.locator( '.components-popover' ) ).toHaveCount( 0 );
		await expect( dialog ).toBeVisible();

		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeHidden();
		// What it changed stays on the tab, to save.
		await expect( page.locator( SCREEN ).getByRole( 'button', { name: 'Save placement' } ) ).toBeEnabled();
	} );

	test( 'sets a value for phones alone, and draws the page at a phone\'s width', async ( { page } ) => {
		const dialog = await openEditor( page );
		const frame = page.frameLocator( '.whsc-look-editor__frame' );

		await dialog.getByRole( 'radio', { name: 'Phone' } ).click();
		await expect( page.locator( '.whsc-look-editor__frame' ) ).toHaveCSS( 'width', '390px' );

		await dialog.getByRole( 'button', { name: /^Modal/ } ).click();
		await dialog.getByRole( 'spinbutton', { name: 'Padding (px), for phones' } ).fill( '8' );

		await expect( frame.locator( '#whsc-look-live' ) ).toHaveJSProperty( 'textContent', '@media (max-width:767px){.whsc-instance-preview{--whsc-padding:8px}}' );

		// A desktop has none of its own, and a tablet takes a desktop's.
		await dialog.getByRole( 'radio', { name: 'Desktop' } ).click();
		await expect( dialog.getByRole( 'spinbutton', { name: 'Padding (px), for desktops' } ) ).toHaveValue( '' );
		await dialog.getByRole( 'spinbutton', { name: 'Padding (px), for desktops' } ).fill( '30' );
		await dialog.getByRole( 'radio', { name: 'Tablet' } ).click();
		await expect( dialog.getByRole( 'spinbutton', { name: 'Padding (px), for tablets' } ) ).toHaveValue( '30' );
		await expect( dialog.getByText( 'The same as on a larger screen, until you change it here.' ) ).toBeVisible();
		await expect( page.locator( '.whsc-look-editor__frame' ) ).toHaveCSS( 'width', '768px' );
	} );

	test( 'saves the look, which the shortcode then carries', async ( { page, requestUtils } ) => {
		const dialog = await openEditor( page );

		// On a phone it opens on the phone's view.
		await dialog.getByRole( 'radio', { name: 'Desktop' } ).click();

		await dialog.getByRole( 'button', { name: /^Modal/ } ).click();
		await pickColour( page, dialog, 'Accent color', '00aa00' );
		await page.keyboard.press( 'Escape' );

		await dialog.getByRole( 'button', { name: 'All parts' } ).click();
		await dialog.getByRole( 'button', { name: /^Result cards/ } ).click();
		await dialog.getByRole( 'button', { name: /^Title typography/ } ).click();
		await dialog.getByRole( 'spinbutton', { name: 'Size (px), for desktops' } ).fill( '18' );

		const save = dialog.getByRole( 'button', { name: 'Save placement' } );

		await save.click();
		await expect( page.getByText( 'Placement saved.' ) ).toBeVisible();
		await expect( save ).toBeDisabled();

		const stored = await requestUtils.rest( { path: PLACEMENT_PATH } );

		expect( stored.placement.search.look ).toEqual( {
			modal_accent: '#00aa00',
			card_title_typography: { size: { desktop: 18 } },
		} );

		const post = await requestUtils.createPost( { title: 'Look page', content: '<!-- wp:shortcode -->[searcio]<!-- /wp:shortcode -->', status: 'publish' } );

		await page.goto( post.link );

		const styles = ( await page.locator( 'style' ).allTextContents() ).join( '\n' );

		expect( styles ).toMatch( /\.whsc-instance-p[0-9a-f]{8}\{--whsc-accent:#00aa00\}/ );
		expect( styles ).toMatch( /\.whsc-instance-p[0-9a-f]{8} \.whsc-card__title:not\(#whsc#whsc#whsc#whsc\)\{font-size:18px\}/ );
	} );
} );
