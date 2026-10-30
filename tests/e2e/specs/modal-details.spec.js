/**
 * Details of the search window only a browser can measure: what stands in the
 * middle of what, and what a theme's stylesheet can and cannot take away.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
	setCategoryFilter,
	setFacetFields,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const HITS = Array.from( { length: 8 }, ( _, index ) => postHit( { title: `Jacket ${ index }` }, `post-${ index }` ) );

const FACETS = {
	types: [ { value: 'post', count: 8 }, { value: 'product', count: 4 } ],
	categories: [
		{ value: 'Clothing', count: 8 },
		{ value: 'Jackets', count: 6 },
		{ value: 'Rain jackets', count: 3 },
		{ value: 'Shoes', count: 2 },
	],
	attr_shoe_size: [ { value: '38', count: 7 }, { value: '42', count: 9 } ],
	attr_capacity: [ { value: '256 GB', count: 1 }, { value: '512 GB', count: 2 } ],
};

/**
 * What Miniture writes for the Cart and Checkout blocks of WooCommerce, whose
 * buttons are `.components-button`: every icon of the window went white.
 */
const THEME = `.components-button { background: #111111; color: #ffffff !important; }
	.components-button:hover { background: #333333; color: #ffffff !important; }`;

const open = async ( page, requestUtils, attributes = {}, mock = {} ) => {
	await mockSearchCloud( page, {
		hits: HITS,
		total: 8,
		facets: FACETS,
		popular: [ { query: 'winter coat' }, { query: 'boots' } ],
		...mock,
	} );
	await page.goto( await createBlockPost( requestUtils, { mode: 'icon', enableVoice: true, ...attributes } ) );

	const widget = new SearchWidget( page );

	await widget.openModal();

	return widget;
};

/** How far the middle of an element's svg is from the middle of the element. */
const offCentre = ( locator ) => locator.evaluate( ( element ) => {
	const box = element.getBoundingClientRect();
	const icon = element.querySelector( 'svg' ).getBoundingClientRect();

	return {
		x: Math.abs( ( icon.left + icon.right ) / 2 - ( box.left + box.right ) / 2 ),
		y: Math.abs( ( icon.top + icon.bottom ) / 2 - ( box.top + box.bottom ) / 2 ),
	};
} );

test.describe( 'the details of the search window', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
		setFacetFields( [ 'categories', 'attr_shoe_size', 'attr_capacity' ] );
	} );

	test.afterAll( () => {
		setFacetFields();
		setCategoryFilter( 'clear' );
	} );

	test( 'the microphone stands in the middle of its button', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils );
		const { x, y } = await offCentre( widget.modal.locator( '.whsc-voice-btn' ) );

		expect( x ).toBeLessThanOrEqual( 0.5 );
		expect( y ).toBeLessThanOrEqual( 0.5 );
	} );

	test( 'the sparkle stands in the middle of its circle', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils, {}, { assistant: true } );

		await widget.modal.getByRole( 'tab', { name: /assistant/i } ).click();

		const box = await widget.modal.locator( '.whsc-assistant__avatar--lg svg path' ).evaluate( ( path ) => {
			const { x, y, width, height } = path.getBBox();

			return { x: x + width / 2, y: y + height / 2 };
		} );

		expect( box ).toEqual( { x: 12, y: 12 } );
	} );

	test( 'the words of a filter stand in its middle: on a whole pixel, and trimmed to their capitals', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );

		const { y } = await widget.modal.locator( '.whsc-filterbar' ).boundingBox();

		expect( y ).toBe( Math.round( y ) );

		const label = widget.modal.locator( '.whsc-filterbar .whsc-filter-btn .whsc-facet__label' ).first();

		await expect( label ).toHaveCSS( 'text-box-trim', 'trim-both' );
	} );

	test( 'a count under a size that is a number is in brackets, and a capacity is not cut', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );

		const panel = await widget.openGroup( 'Shoe size' );
		const count = panel.locator( '.whsc-tile .whsc-facet__count' ).first();

		expect( await count.evaluate( ( element ) => getComputedStyle( element, '::before' ).content ) ).toBe( '"("' );

		await page.keyboard.press( 'Escape' );

		const capacity = await widget.openGroup( 'Capacity' );
		const label = capacity.locator( '.whsc-tile .whsc-facet__label' ).first();

		expect( await label.evaluate( ( element ) => element.scrollWidth - element.clientWidth ) ).toBeLessThanOrEqual( 0 );
	} );

	test( 'a popular search has its arrow at the start', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils );
		const item = widget.modal.locator( '.whsc-popular-item' ).first();

		await expect( item ).toContainText( 'winter coat' );

		const [ icon, label ] = await Promise.all( [
			item.locator( 'svg' ).boundingBox(),
			item.locator( '.whsc-popular-item__label' ).boundingBox(),
		] );

		expect( icon.x + icon.width ).toBeLessThanOrEqual( label.x );
	} );

	test( 'a theme that styles the buttons of WooCommerce\'s blocks does not reach the window\'s', async ( { page, requestUtils } ) => {
		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );
		await page.addStyleTag( { content: `${ THEME }
			.whsc-modal-overlay, .whsc-modal {
				--whsc-voice-color: rgb(1, 2, 3);
				--whsc-visual-color: rgb(1, 2, 3);
				--whsc-close-color: rgb(1, 2, 3);
				--whsc-clearbtn-color: rgb(1, 2, 3);
				--whsc-arrow-color: rgb(1, 2, 3);
			}` } );

		for ( const selector of [ '.whsc-voice-btn', '.whsc-modal-close', '.whsc-search-input__clear', '.whsc-carousel-arrow--next' ] ) {
			const control = widget.modal.locator( selector ).first();

			await expect( control, selector ).not.toHaveClass( /components-button/ );
			await expect( control, selector ).toHaveCSS( 'color', 'rgb(1, 2, 3)' );

			// A phone has no arrows to hover.
			if ( ! await control.isVisible() ) {
				continue;
			}

			await control.hover( { force: true } );
			await expect( control, `${ selector } on hover` ).toHaveCSS( 'color', 'rgb(1, 2, 3)' );
		}
	} );

	test( 'a filter draws the images and the two colours a swatches plugin gives its values', async ( { page, requestUtils } ) => {
		const IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

		// What `Facet_Config` hands over for such an attribute, which the
		// integration suite reads from each plugin's term meta.
		await page.route( '**/*', async ( route ) => {
			if ( 'document' !== route.request().resourceType() ) {
				return route.fallback();
			}

			const response = await route.fetch();
			const body = ( await response.text() )
				.replace( '"field":"attr_shoe_size","order":1,"display":"auto"', `"field":"attr_shoe_size","order":1,"display":"auto","images":{"38":"${ IMAGE }","42":"${ IMAGE }"}` )
				.replace( '"field":"attr_capacity","order":2,"display":"auto"', '"field":"attr_capacity","order":2,"display":"auto","colors":{"256 GB":"#000000","512 GB":"#111111"},"secondColors":{"256 GB":"#ffffff"}' );

			return route.fulfill( { response, body } );
		} );

		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );

		const images = await widget.openGroup( 'Shoe size' );

		await expect( images.locator( '.whsc-swatch img' ) ).toHaveCount( 2 );
		await expect( images.locator( '.whsc-swatch' ).first() ).toContainText( '42' );

		await page.keyboard.press( 'Escape' );

		const colors = await widget.openGroup( 'Capacity' );
		const dot = colors.locator( '.whsc-swatch', { hasText: '256 GB' } ).locator( '.whsc-swatch__dot' );

		expect( await dot.evaluate( ( element ) => getComputedStyle( element ).backgroundImage ) ).toContain( 'linear-gradient' );
	} );

	test( 'the colour of the box field\'s line reaches the line that is drawn', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: HITS, total: 8, facets: FACETS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'box' } ) );
		await page.addStyleTag( { content: '.whsc-trigger-box { --whsc-trigger-box-border: rgb(1, 2, 3); }' } );

		await expect( page.locator( '.whsc-trigger-box .components-input-control__backdrop' ) ).toHaveCSS( 'border-top-color', 'rgb(1, 2, 3)' );
	} );

	test( 'the category filter lists the categories as the shop\'s tree', async ( { page, requestUtils } ) => {
		setCategoryFilter( 'nested', 2 );

		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );

		const panel = await widget.openGroup( 'Categories' );
		const items = panel.locator( '.whsc-opts__item' );

		await expect( items ).toHaveCount( 3 );
		await expect( items.nth( 0 ) ).toContainText( 'Clothing' );
		await expect( items.nth( 1 ) ).toContainText( 'Jackets' );
		await expect( items.nth( 2 ) ).toContainText( 'Shoes' );

		const [ main, sub ] = await Promise.all( [ items.nth( 0 ).locator( 'input' ).boundingBox(), items.nth( 1 ).locator( 'input' ).boundingBox() ] );

		expect( sub.x - main.x ).toBe( 20 );
	} );

	test( 'the category filter can show the main categories alone', async ( { page, requestUtils } ) => {
		setCategoryFilter( 'main' );

		const widget = await open( page, requestUtils );

		await widget.search( 'jacket' );

		const panel = await widget.openGroup( 'Categories' );

		await expect( panel.locator( '.whsc-opts__item' ) ).toHaveText( [ /Clothing/, /Shoes/ ] );
	} );
} );
