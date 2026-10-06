/**
 * Server-designed cards. A placement whose card design is "Search Cloud" draws
 * each hit through the template the service compiled for it: markup with
 * `{{field}}` placeholders and a stylesheet of its own. The markup below is
 * what the service's compiler writes - a class per node, an icon as inline SVG
 * with its namespace, a price component, an HTML component with no classes -
 * because that is the markup a browser has to take: the unit tests read it
 * through jsdom, which accepts what a browser does not.
 */

import { test, expect, SearchWidget, mockSearchCloud, configureSearchKey, createBlockPost, postHit } from '../utils';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>';

const TEMPLATE = {
	id: 12,
	type: 'product',
	is_default: true,
	priority: 0,
	conditions: [],
	html: [
		'<a class="sct-12 sct-12-root" href="{{url}}">',
		'<img class="sct-12-img" src="{{image}}" alt="{{title}}" loading="lazy">',
		'<h3 class="sct-12-title">{{title}}</h3>',
		'<span class="sct-12-price" data-sc-price data-sc-price-field="price" data-sc-regular-field="regular_price" data-sc-sale-field="sale_price" data-sc-min-field="price_min" data-sc-max-field="price_max" data-sc-currency="€" data-sc-currency-position="after_space" data-sc-decimals="2" data-sc-decimal-sep="," data-sc-thousand-sep=".">',
		'<span class="sct-12-price-prefix" data-sc-price-part="prefix">from</span>',
		'<span class="sct-12-price-regular" data-sc-price-part="regular">{{regular_price}}</span>',
		'<span class="sct-12-price-current" data-sc-price-part="current">{{price}}</span></span>',
		`<span class="sct-12-icon">${ ICON }</span>`,
		'<h4 class="sct-12-note">Ships tomorrow</h4>',
		'<div class="sct-12-html"><p>Free <strong>returns</strong>.</p><ul><li>30 days</li></ul></div>',
		'</a>',
	].join( '' ),
	css: [
		'.sct-12-root { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid #d1d5db; color: #111827; font-size: 15px; font-weight: 400; text-decoration: none; }',
		'.sct-12-title { margin: 0; font-size: 17px; font-weight: 600; line-height: 23px; }',
		'.sct-12-price-regular { text-decoration: line-through; }',
		'.sct-12-icon { color: #be123c; font-size: 20px; }',
		// What the template's own CSS box lets its author write.
		'.sct-12-icon svg { width: 22px; height: 22px; }',
		'.sct-12-html p { margin: 0 0 4px; color: #1d4ed8; }',
	].join( '\n' ),
};

const PRODUCTS = [
	postHit( { type: 'product', title: 'Merino Base Layer', url: 'https://example.test/merino', regular_price: 89, sale_price: 59, price: 59 }, 'p-1' ),
	postHit( { type: 'product', title: 'Alpine Boots', url: 'javascript:alert(1)', price_min: 99, price_max: 149, price: 99 }, 'p-2' ),
	postHit( { type: 'post', title: 'Size guide', url: 'https://example.test/size-guide' }, 'post-1' ),
];

const styleOf = ( locator, ...props ) =>
	locator.evaluate( ( el, names ) => {
		const style = window.getComputedStyle( el );

		return names.map( ( name ) => style.getPropertyValue( name ) );
	}, props );

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Server-designed cards', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'draws each hit through the template the service compiled', async ( { page, requestUtils } ) => {
		const errors = [];

		page.on( 'pageerror', ( error ) => errors.push( error.message ) );

		await mockSearchCloud( page, { hits: PRODUCTS, templates: [ TEMPLATE ] } );
		await page.goto( await createBlockPost( requestUtils, { cardSource: 'server' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'layer' );

		const cards = widget.modal.locator( '.whsc-card--server' );

		await expect( cards ).toHaveCount( 2 );
		expect( errors ).toEqual( [] );

		// The placeholders, and the link the card is.
		await expect( cards.nth( 0 ).locator( '.sct-12-title' ) ).toHaveText( 'Merino Base Layer' );
		await expect( cards.nth( 0 ).locator( '.sct-12-root' ) ).toHaveAttribute( 'href', 'https://example.test/merino' );

		// The price component works its state out per hit: on sale, then a range.
		await expect( cards.nth( 0 ).locator( '.sct-12-price-regular' ) ).toHaveText( '89,00 €' );
		await expect( cards.nth( 0 ).locator( '.sct-12-price-current' ) ).toHaveText( '59,00 €' );
		await expect( cards.nth( 0 ).locator( '.sct-12-price-prefix' ) ).toBeHidden();
		await expect( cards.nth( 1 ).locator( '.sct-12-price-prefix' ) ).toBeVisible();
		await expect( cards.nth( 1 ).locator( '.sct-12-price-current' ) ).toHaveText( '99,00 €' );
		await expect( cards.nth( 1 ).locator( '.sct-12-price-regular' ) ).toBeHidden();

		// A scheme that runs script does not reach the page.
		await expect( cards.nth( 1 ).locator( '.sct-12-root' ) ).not.toHaveAttribute( 'href', /.*/ );

		// A hit of a type no template is for keeps the plugin's own card.
		await expect( widget.modal.locator( '.whsc-card:not(.whsc-card--server)' ) ).toHaveCount( 1 );
	} );

	test( "draws the template in the template's own styles", async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: PRODUCTS, templates: [ TEMPLATE ] } );
		await page.goto( await createBlockPost( requestUtils, { cardSource: 'server' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'layer' );

		const card = widget.modal.locator( '.whsc-card--server' ).first();

		await expect( card ).toBeVisible();

		// A node of the template, which has a class.
		expect( await styleOf( card.locator( '.sct-12-title' ), 'font-size', 'font-weight', 'line-height', 'margin-top' ) )
			.toEqual( [ '17px', '600', '23px', '0px' ] );
		expect( await styleOf( card.locator( '.sct-12-price-regular' ), 'text-decoration-line' ) ).toEqual( [ 'line-through' ] );

		// The icon, at the size and in the colour the template gives it.
		expect( await styleOf( card.locator( '.sct-12-icon svg' ), 'width', 'height', 'fill' ) )
			.toEqual( [ '22px', '22px', 'rgb(190, 18, 60)' ] );

		// What the template writes for markup that has no class.
		expect( await styleOf( card.locator( '.sct-12-html p' ), 'color', 'margin-bottom' ) )
			.toEqual( [ 'rgb(29, 78, 216)', '4px' ] );
	} );

	test( 'starts the template from what the panel draws it on', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: PRODUCTS, templates: [ TEMPLATE ] } );
		await page.goto( await createBlockPost( requestUtils, { cardSource: 'server' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'layer' );

		const card = widget.modal.locator( '.whsc-card--server' ).first();

		await expect( card ).toBeVisible();

		// The template draws the card's frame; the plugin does not add its own.
		expect( await styleOf( card, 'padding-top', 'border-top-width', 'background-color', 'row-gap' ) )
			.toEqual( [ '0px', '0px', 'rgba(0, 0, 0, 0)', '0px' ] );

		const frame = await card.locator( '.sct-12-root' ).evaluate( ( root ) => {
			const inner = root.getBoundingClientRect();
			const outer = root.parentElement.getBoundingClientRect();

			return [ inner.x - outer.x, inner.y - outer.y, outer.width - inner.width, outer.height - inner.height ].map( Math.round );
		} );

		expect( frame ).toEqual( [ 0, 0, 0, 0 ] );

		// A heading, a list and an image the template says nothing about: not
		// a browser's own, and not the site's.
		expect( await styleOf( card.locator( '.sct-12-note' ), 'font-size', 'font-weight', 'margin-top', 'margin-bottom' ) )
			.toEqual( [ '15px', '400', '0px', '0px' ] );
		expect( await styleOf( card.locator( '.sct-12-html ul' ), 'list-style-type', 'padding-left', 'margin-top' ) )
			.toEqual( [ 'none', '0px', '0px' ] );
		expect( await styleOf( card.locator( '.sct-12-img' ), 'display', 'max-width' ) ).toEqual( [ 'block', '100%' ] );
	} );
} );
