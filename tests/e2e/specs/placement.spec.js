/**
 * The Placement tab, and what it places on the site: the site's own search
 * forms drawn as Searcio, a theme element that opens it, a link to
 * `#searcio`, the keyboard shortcut and the floating button.
 *
 * The site-wide settings are written over REST and reset after each test, so
 * a test starts from a site where every way is off, as an updated site is.
 */

import { test, expect, configureSearchKey, mockSearchCloud, touchingInShell } from '../utils';

const TAB_URL = '/wp-admin/admin.php?page=webhead-search-cloud&tab=placement';
const PLACEMENT_PATH = '/webhead-search-cloud/v1/placement';
const SCREEN = '#webhead-search-cloud-root';
const LOADED = { timeout: 15000 };

const savePlacement = ( requestUtils, placement ) =>
	requestUtils.rest( { path: PLACEMENT_PATH, method: 'POST', data: { placement } } );

/**
 * A section of the tab, by its entry in the list down the side. An entry is
 * named by its label followed by its lines of state, so it is found by the
 * label it starts with.
 */
const sectionTab = ( page, label ) => page.locator( SCREEN ).getByRole( 'tab', { name: new RegExp( `^${ label }` ) } );

const openSection = async ( page, label ) => {
	await sectionTab( page, label ).click( LOADED );
	await expect( sectionTab( page, label ) ).toHaveAttribute( 'aria-selected', 'true' );
};

/**
 * A page holding the Enfold header's search item, as a live Enfold shop
 * prints it, with a theme script that opens its own dropdown on a click.
 */
const ENFOLD_PAGE = `<!-- wp:html -->
<ul id="avia-menu"><li id="menu-item-search" class="noMobile menu-item menu-item-search-dropdown menu-item-avia-special" role="menuitem"><a class="avia-svg-icon" aria-label="Search" href="?s=" rel="nofollow" title="Click to open the search input field">Search</a></li></ul>
<p><a id="hash-link" href="#searcio">Open the search</a></p>
<script>document.addEventListener('click',function(e){if(e.target.closest('#menu-item-search a')){e.preventDefault();document.body.classList.add('theme-search-open');}});</script>
<!-- /wp:html -->
<!-- wp:search {"label":"Search","buttonText":"Search"} /-->`;

test.describe( 'Placement tab', () => {
	test.beforeEach( async ( { requestUtils } ) => {
		await savePlacement( requestUtils, {} );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await savePlacement( requestUtils, {} );
	} );

	test( 'every way starts off, and turning one on shows what it needs', async ( { page } ) => {
		await page.goto( TAB_URL );

		const screen = page.locator( SCREEN );

		await expect( screen.getByRole( 'heading', { name: 'Placement', level: 2 } ) ).toBeVisible( LOADED );

		for ( const [ section, name ] of [
			[ 'Search forms', 'Use Searcio for the site\'s search forms' ],
			[ 'The theme\'s search', 'Open Searcio from the theme\'s own search' ],
			[ 'Keyboard shortcut', 'Use the keyboard shortcut' ],
			[ 'Floating search button', 'Show a floating search button' ],
		] ) {
			await expect( sectionTab( page, section ) ).toContainText( 'Off' );
			await openSection( page, section );
			await expect( screen.getByRole( 'checkbox', { name } ) ).not.toBeChecked();
		}

		await openSection( page, 'The theme\'s search' );
		await expect( screen.getByLabel( 'CSS selectors' ) ).toHaveCount( 0 );
		await screen.getByRole( 'checkbox', { name: 'Open Searcio from the theme\'s own search' } ).check();
		await expect( screen.getByLabel( 'CSS selectors' ) ).toBeVisible();

		await screen.getByLabel( 'CSS selectors' ).fill( '#menu-item-search > a\na[href=' );
		await expect( screen.getByText( 'A browser cannot read these, so they open nothing: a[href=' ) ).toBeVisible();
		// The entry says what the section holds now, before it is saved.
		await expect( sectionTab( page, 'The theme\'s search' ) ).toContainText( '2 selectors' );

		await openSection( page, 'Floating search button' );
		await screen.getByRole( 'checkbox', { name: 'Show a floating search button' } ).check();
		await expect( screen.locator( 'iframe.whsc-placement-preview--floating' ) ).toBeVisible();
		await expect( sectionTab( page, 'Floating search button' ) ).toContainText( 'On phones' );
	} );

	test( 'saves, says so, and has nothing left to save', async ( { page, requestUtils } ) => {
		await page.goto( TAB_URL );

		const screen = page.locator( SCREEN );
		const save = screen.getByRole( 'button', { name: 'Save placement' } );

		await expect( save ).toBeDisabled( LOADED );

		await openSection( page, 'Keyboard shortcut' );
		await screen.getByRole( 'checkbox', { name: 'Use the keyboard shortcut' } ).check();
		await expect( save ).toBeEnabled();
		await save.click();

		await expect( page.getByText( 'Placement saved.' ) ).toBeVisible();
		await expect( save ).toBeDisabled();

		const stored = await requestUtils.rest( { path: PLACEMENT_PATH } );

		expect( stored.placement.shortcut ).toBe( true );
	} );

	test( 'says why a save failed, beside the button, with the reason the REST API gave', async ( { page } ) => {
		// The REST route, the admin page and the preview all have "placement"
		// in their address; only a save is answered.
		await page.route( '**/*placement*', async ( route ) => {
			if ( 'GET' === route.request().method() ) {
				return route.continue();
			}

			return route.fulfill( { status: 500, contentType: 'application/json', body: JSON.stringify( { code: 'broken', message: 'The database is read-only.' } ) } );
		} );

		await page.goto( TAB_URL );

		const screen = page.locator( SCREEN );

		await openSection( page, 'Keyboard shortcut' );
		await screen.getByRole( 'checkbox', { name: 'Use the keyboard shortcut' } ).check();
		await screen.getByRole( 'button', { name: 'Save placement' } ).click();

		await expect( screen.getByText( 'The placement could not be saved: The database is read-only.' ) ).toBeVisible();
		await expect( page.getByText( 'Placement saved.' ) ).toHaveCount( 0 );
	} );

	test( 'writes a shortcode with what differs from the look, and copies it', async ( { page, context } ) => {
		await context.grantPermissions( [ 'clipboard-read', 'clipboard-write' ] );
		await page.goto( TAB_URL );
		await openSection( page, 'Shortcodes' );

		const card = page.locator( SCREEN ).locator( '.whsc-settings-card' ).filter( { hasText: 'Shortcode for the search' } );
		const code = card.locator( '.whsc-placement-snippet__code' );

		await expect( code ).toHaveText( '[searcio]', LOADED );

		await card.getByRole( 'radio', { name: 'Search field' } ).click();
		await card.getByLabel( 'Placeholder' ).fill( 'Find a jacket' );
		await expect( code ).toHaveText( '[searcio mode="box" placeholder="Find a jacket"]' );

		await card.getByRole( 'button', { name: 'Copy' } ).click();
		await expect( page.getByText( 'Copied.' ) ).toBeVisible();
		expect( await page.evaluate( () => navigator.clipboard.readText() ) ).toBe( '[searcio mode="box" placeholder="Find a jacket"]' );
	} );

	test( 'leaves a gap between everything it stacks', async ( { page } ) => {
		await page.goto( TAB_URL );
		await expect( page.locator( SCREEN ).getByRole( 'button', { name: 'Save placement' } ) ).toBeVisible( LOADED );

		await openSection( page, 'The theme\'s search' );
		await page.locator( SCREEN ).getByRole( 'checkbox', { name: 'Open Searcio from the theme\'s own search' } ).check();
		expect( await touchingInShell( page ) ).toEqual( [] );

		for ( const section of [ 'Search forms', 'Keyboard shortcut', 'Floating search button', 'Look', 'Shortcodes', 'Product rows', 'Other ways to place it' ] ) {
			await openSection( page, section );
			expect( await touchingInShell( page ), section ).toEqual( [] );
		}
	} );

	/**
	 * The tab used to be one column of eight cards. Each way is a section of
	 * its own now, listed down the side with its state, and the one open is
	 * kept in the address.
	 */
	test( 'lists its sections down the side, opens one at a time, and keeps it in the address', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { shortcut: true, floating: { enabled: true, devices: 'all' }, search: { mode: 'box' } } );
		await page.goto( TAB_URL );

		const tabs = page.locator( SCREEN ).getByRole( 'tablist', { name: 'Placement settings' } ).getByRole( 'tab' );

		await expect( tabs ).toHaveText( [
			/^Search formsOff$/,
			/^The theme's searchOff/,
			/^Keyboard shortcutCtrl\+K and \/$/,
			/^Floating search buttonOn every screen$/,
			/^LookSearch fieldAll content$/,
			/^Shortcodes\[searcio\]\[searcio_products\]$/,
			/^Product rowsSimilarCarousel$/,
			/^Other ways to place it/,
		], LOADED );
		await expect( sectionTab( page, 'Search forms' ) ).toHaveAttribute( 'aria-selected', 'true' );
		await expect( page.locator( SCREEN ).getByText( 'Look of the shortcode and the widgets' ) ).toHaveCount( 0 );

		await openSection( page, 'Look' );
		await expect( page.locator( SCREEN ).getByText( 'Look of the shortcode and the widgets' ) ).toBeVisible();

		// A card separates one region from another: a section with one region
		// has none, and Shortcodes, with two, has two.
		const panel = page.locator( SCREEN ).getByRole( 'tabpanel', { name: /^Look/ } );

		await expect( panel.locator( '.whsc-card' ) ).toHaveCount( 0 );
		await openSection( page, 'Shortcodes' );
		await expect( page.locator( SCREEN ).getByRole( 'tabpanel', { name: /^Shortcodes/ } ).locator( '.whsc-card' ) ).toHaveCount( 2 );
		await openSection( page, 'Look' );
		await expect( page.locator( SCREEN ).getByRole( 'checkbox', { name: 'Use Searcio for the site\'s search forms' } ) ).toHaveCount( 0 );
		expect( new URL( page.url() ).searchParams.get( 'section' ) ).toBe( 'look' );

		await page.reload();
		await expect( sectionTab( page, 'Look' ) ).toHaveAttribute( 'aria-selected', 'true', LOADED );

		// Another tab of the screen has no sections; the address forgets it.
		await page.locator( SCREEN ).getByRole( 'tab', { name: 'Search Config' } ).click();
		await expect.poll( () => new URL( page.url() ).searchParams.get( 'section' ) ).toBeNull();
	} );

	test( 'fits a phone without scrolling sideways, with its sections in a strip of their own', async ( { page } ) => {
		await page.setViewportSize( { width: 375, height: 812 } );
		await page.goto( TAB_URL );
		await expect( page.locator( SCREEN ).getByRole( 'button', { name: 'Save placement' } ) ).toBeVisible( LOADED );

		const overflow = () => page.evaluate( () => document.documentElement.scrollWidth - document.documentElement.clientWidth );

		expect( await overflow() ).toBeLessThanOrEqual( 0 );

		// The last entry is reached by scrolling the strip, not the page.
		await openSection( page, 'Other ways to place it' );
		expect( await overflow() ).toBeLessThanOrEqual( 0 );
		await expect( page.locator( SCREEN ).getByText( 'PHP in a child theme' ) ).toBeVisible();

		// Opened from the address, the open entry is in the strip's view.
		await page.goto( `${ TAB_URL }&section=products` );
		await expect( sectionTab( page, 'Product rows' ) ).toHaveAttribute( 'aria-selected', 'true', LOADED );
		await expect.poll( () => page.evaluate( () => {
			const strip = document.querySelector( '.webhead-search-cloud-sections__nav' ).getBoundingClientRect();
			const entry = document.querySelector( '.webhead-search-cloud-sections__nav [aria-selected="true"]' ).getBoundingClientRect();

			return entry.left >= strip.left - 1 && entry.right <= strip.right + 1;
		} ) ).toBe( true );
	} );
} );

test.describe( 'On the site', () => {
	// What a visitor sees.
	test.use( { storageState: { cookies: [], origins: [] } } );

	let pageUrl;

	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );

		const post = await requestUtils.createPost( { title: 'Placement page', content: ENFOLD_PAGE, status: 'publish' } );

		pageUrl = post.link;
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await savePlacement( requestUtils, {} );
	} );

	test( 'the theme\'s search form becomes Searcio, which opens over it', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { takeover: true, search: { placeholder: 'Search the shop' } } );
		await mockSearchCloud( page );
		await page.goto( pageUrl );

		const box = page.locator( '.webhead-search-cloud-placement .whsc-trigger-box input' );

		await expect( box ).toHaveAttribute( 'placeholder', 'Search the shop' );
		await expect( page.locator( '.webhead-search-cloud-fallback' ) ).toHaveCount( 0 );

		await box.click();
		await expect( page.locator( '.whsc-modal-overlay' ) ).toBeVisible();
	} );

	test( 'the Search block is the block\'s own while the takeover is off', async ( { page } ) => {
		await page.goto( pageUrl );

		await expect( page.locator( '.wp-block-search' ) ).toBeVisible();
		await expect( page.locator( '.webhead-search-cloud-placement' ) ).toHaveCount( 0 );
	} );

	test( 'the theme\'s search icon opens Searcio, and the theme\'s own dropdown stays closed', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { openers: true, selectors: [ '#menu-item-search > a' ] } );
		await mockSearchCloud( page );
		await page.goto( pageUrl );

		await page.locator( '#menu-item-search > a' ).click();

		await expect( page.locator( '.whsc-modal-overlay' ) ).toBeVisible();
		expect( await page.evaluate( () => document.body.classList.contains( 'theme-search-open' ) ) ).toBe( false );
		expect( new URL( page.url() ).search ).toBe( '' );
	} );

	test( 'a link to #searcio and the keyboard shortcut open it', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { shortcut: true } );
		await mockSearchCloud( page );
		await page.goto( pageUrl );

		await page.locator( '#hash-link' ).click();
		await expect( page.locator( '.whsc-modal-overlay' ) ).toBeVisible();

		await page.getByRole( 'button', { name: 'Close search' } ).click();
		await expect( page.locator( '.whsc-modal-overlay' ) ).toHaveCount( 0 );

		await page.keyboard.press( 'ControlOrMeta+k' );
		await expect( page.locator( '.whsc-modal-overlay' ) ).toBeVisible();
	} );

	test( 'the floating button sits in its corner on a phone, and opens the search', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { floating: { enabled: true, offset: 80, style: 'label' } } );
		await mockSearchCloud( page );
		await page.setViewportSize( { width: 375, height: 740 } );
		await page.goto( pageUrl );

		const button = page.getByRole( 'button', { name: 'Search', exact: true } ).and( page.locator( '.whsc-trigger-floating-button' ) );
		const box = await button.boundingBox();

		expect( Math.round( 375 - ( box.x + box.width ) ) ).toBe( 16 );
		expect( Math.round( 740 - ( box.y + box.height ) ) ).toBe( 80 );

		await button.click();
		await expect( page.locator( '.whsc-modal-overlay' ) ).toBeVisible();
	} );

	test( 'the floating button set for phones is not drawn on a desktop', async ( { page, requestUtils } ) => {
		await savePlacement( requestUtils, { floating: { enabled: true } } );
		await mockSearchCloud( page );
		await page.setViewportSize( { width: 1280, height: 800 } );
		await page.goto( pageUrl );

		await expect( page.locator( '[data-whsc-site="floating"]' ) ).toBeAttached();
		await expect( page.locator( '.whsc-trigger-floating-button' ) ).toBeHidden();
	} );
} );
