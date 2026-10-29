/**
 * The filter bar under the search field.
 *
 * One row of controls at every width: on a tablet or a desktop the type
 * switch, as many group buttons as fit (five at most) and "All filters"; on a
 * phone "Filters" fixed at the start and a row that scrolls. A group opens as
 * a popover, or on a phone as a sheet; "All filters" as a drawer, or a sheet.
 * Every pick applies at once, and closing never undoes one.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
	rightToLeft,
	setFacetFields,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const COLORS = [ 'Black', 'Olive', 'Grey', 'Navy', 'Brown', 'Beige' ];
const SIZES = [ 'XS', 'S', 'M', 'L', 'XL', 'XXL' ];

const product = ( index ) => postHit(
	{
		type: 'product',
		title: `Jacket ${ index }`,
		price: 40 + index * 10,
		categories: [ 'Jackets' ],
		brand: 0 === index % 3 ? 'Bolt' : 'Acme',
		attr_color: [ COLORS[ index % COLORS.length ] ],
		attr_size: [ SIZES[ index % SIZES.length ] ],
	},
	`product-${ index }`
);

const ALL = Array.from( { length: 12 }, ( _, index ) => product( index + 1 ) );

/** The answer narrows by colour, as the service does. */
const matching = ( url ) => {
	const colors = ( url.searchParams.get( 'filter[attr_color]' ) || '' ).split( ',' ).filter( Boolean );

	return 0 === colors.length ? ALL : ALL.filter( ( hit ) => colors.some( ( color ) => hit.source.attr_color.includes( color ) ) );
};

const facetsFor = ( url ) => {
	const hits = matching( url );
	const count = ( field, value ) => hits.filter( ( hit ) => [].concat( hit.source[ field ] ).includes( value ) ).length;

	return {
		types: [ { value: 'product', count: hits.length }, { value: 'post', count: 2 } ],
		categories: Array.from( { length: 61 }, ( _, index ) => ( { value: `Category ${ String( index + 1 ).padStart( 2, '0' ) }`, count: 61 - index } ) ),
		brand: [ { value: 'Acme', count: count( 'brand', 'Acme' ) }, { value: 'Bolt', count: count( 'brand', 'Bolt' ) } ].filter( ( entry ) => entry.count > 0 ),
		attr_color: COLORS.map( ( value ) => ( { value, count: count( 'attr_color', value ) } ) ).filter( ( entry ) => entry.count > 0 ),
		attr_size: SIZES.map( ( value ) => ( { value, count: count( 'attr_size', value ) } ) ).filter( ( entry ) => entry.count > 0 ),
		attr_material: [ { value: 'Wool', count: 4 } ],
		price: [],
	};
};

const mock = ( page, extra = {} ) => mockSearchCloud( page, {
	hits: matching,
	total: ( url ) => matching( url ).length,
	facets: facetsFor,
	...extra,
} );

/**
 * @param {import('@playwright/test').Page} page
 * @param {Object} requestUtils
 * @return {Promise<SearchWidget>}
 */
const openWithResults = async ( page, requestUtils ) => {
	await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

	const widget = new SearchWidget( page );
	await widget.openModal();
	await widget.search( 'jacket' );
	await expect( widget.resultsHeading ).toHaveText( '12 results' );

	return widget;
};

const isPhone = () => 'mobile-chrome' === test.info().project.name;

const groupNames = ( widget ) => widget.modal.locator( '.whsc-filter-btn[data-field]:not([hidden]) .whsc-facet__label' ).allTextContents();

test.describe( 'the filter bar', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
		setFacetFields( [ 'attr_size', 'attr_color', 'brand', 'categories', 'price', 'attr_material' ] );
	} );

	test.afterAll( () => {
		setFacetFields();
	} );

	test( 'lays the groups out in the order Search Config gives, five at most, and a pick never reorders them', async ( { page, requestUtils } ) => {
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const order = [ 'Size', 'Color', 'Brand', 'Categories', 'Price' ];

		await expect.poll( () => groupNames( widget ) ).toEqual( order );

		const panel = await widget.openGroup( 'Color' );
		await panel.getByRole( 'checkbox', { name: /^Black/ } ).check();
		await expect( widget.resultsHeading ).toHaveText( '2 results' );

		await expect.poll( () => groupNames( widget ) ).toEqual( [ 'Size', 'Color: Black', 'Brand', 'Categories', 'Price' ] );
	} );

	test( 'keeps an active group on its button and counts every value on "All filters"', async ( { page, requestUtils } ) => {
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const panel = await widget.openGroup( 'Color' );

		await panel.getByRole( 'checkbox', { name: /^Black/ } ).check();
		await panel.getByRole( 'checkbox', { name: /^Olive/ } ).check();
		// Closed, or on a phone the sheet keeps the bar out of reach.
		await page.keyboard.press( 'Escape' );
		await expect( page.locator( '.whsc-pop, .whsc-sheet' ) ).toHaveCount( 0 );

		// Read out whole, shown as "Color: Black +1".
		await expect( widget.groupButton( 'Color' ) ).toHaveAccessibleName( 'Color: Black, Olive' );
		await expect( widget.groupButton( 'Color' ).locator( '.whsc-filter-btn__more' ) ).toHaveText( '+1' );
		await expect( widget.allFilters.locator( '.whsc-badge' ) ).toHaveText( '2' );
		await expect( widget.allFilters ).toHaveAccessibleName( /, 2 active$/ );
	} );

	test( 'applies a pick with its panel still open, and its button says what the results say', async ( { page, requestUtils } ) => {
		const searches = [];

		await mock( page, { onSearch: ( url ) => searches.push( url ) } );

		const widget = await openWithResults( page, requestUtils );
		const panel = await widget.openGroup( 'Color' );

		await panel.getByRole( 'checkbox', { name: /^Black/ } ).check();

		await expect.poll( () => searches.some( ( url ) => 'Black' === url.searchParams.get( 'filter[attr_color]' ) ) ).toBe( true );
		await expect( widget.resultsHeading ).toHaveText( '2 results' );
		await expect( panel ).toBeVisible();
		await expect( panel.getByRole( 'button', { name: 'Show 2 results' } ) ).toBeVisible();
		// Announced once the results are there.
		await expect( widget.status ).toHaveText( '2 results found.' );
	} );

	test( 'closes only the popover on Escape, keeping the pick, and the search on the next Escape', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone opens a group as a sheet; see the sheet test.' );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const panel = await widget.openGroup( 'Color' );

		await panel.getByRole( 'checkbox', { name: /^Black/ } ).check();
		await page.keyboard.press( 'Escape' );

		await expect( widget.popover ).toHaveCount( 0 );
		await expect( widget.modal ).toBeVisible();
		await expect( widget.groupButton( 'Color' ) ).toBeFocused();
		await expect( widget.groupButton( 'Color' ) ).toHaveText( /Color: Black/ );

		await page.keyboard.press( 'Escape' );

		await expect( widget.modal ).toHaveCount( 0 );
	} );

	test( 'closes only the popover on a press on the dimmed page', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone opens a group as a sheet.' );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );

		await widget.openGroup( 'Color' );

		const frame = await widget.modal.boundingBox();

		await page.mouse.click( frame.x + 20, frame.y + frame.height + 40 );

		await expect( widget.popover ).toHaveCount( 0 );
		await expect( widget.modal ).toBeVisible();
	} );

	test( 'moves on to the next button of the bar when Tab leaves the popover', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone opens a group as a sheet.' );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const panel = await widget.openGroup( 'Size' );

		// The first value has focus; the last control is the footer's button.
		await expect( panel.getByRole( 'checkbox' ).first() ).toBeFocused();
		await panel.getByRole( 'button', { name: 'Show 12 results' } ).focus();
		await page.keyboard.press( 'Tab' );

		await expect( widget.popover ).toHaveCount( 0 );
		await expect( widget.groupButton( 'Color' ) ).toBeFocused();
	} );

	test( 'never lets a popover end below the scroll area', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone opens a group as a sheet.' );
		await page.setViewportSize( { width: 1280, height: 640 } );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const scroller = widget.modal.locator( '.components-modal__content' );

		for ( const name of [ 'Size', 'Color', 'Brand', 'Categories', 'Price' ] ) {
			const panel = await widget.openGroup( name );
			const more = panel.locator( '.whsc-more' );

			if ( await more.count() ) {
				await more.click();
			}

			const area = await scroller.boundingBox();
			const box = await panel.boundingBox();

			expect( box.y + box.height, name ).toBeLessThanOrEqual( area.y + area.height + 0.5 );
			await page.keyboard.press( 'Escape' );
		}
	} );

	test( 'opens "All filters" in a dialog of its own that keeps focus, closes alone on Escape and gives focus back', async ( { page, requestUtils } ) => {
		await mock( page );

		const widget = await openWithResults( page, requestUtils );

		await widget.allFilters.click();

		const dialog = page.getByRole( 'dialog', { name: isPhone() ? 'Filters' : 'All filters' } );

		await expect( dialog ).toBeVisible();
		await expect( widget.sheet ).toHaveClass( isPhone() ? /whsc-sheet--sheet/ : /whsc-sheet--drawer/ );

		// One section per group; the first is open when nothing is picked.
		await expect( dialog.locator( '.whsc-acc__btn' ) ).toHaveCount( 6 );
		await expect( dialog.locator( '.whsc-acc__btn' ).first() ).toHaveAttribute( 'aria-expanded', 'true' );

		// Tab goes round inside it.
		for ( let index = 0; index < 20; index++ ) {
			await page.keyboard.press( 'Tab' );
			expect( await dialog.evaluate( ( node ) => node.contains( document.activeElement ) ) ).toBe( true );
		}

		await dialog.getByRole( 'checkbox', { name: /^M/ } ).check();
		await page.keyboard.press( 'Escape' );

		await expect( dialog ).toHaveCount( 0 );
		await expect( widget.modal ).toBeVisible();
		await expect( widget.allFilters ).toBeFocused();
		await expect( widget.allFilters.locator( '.whsc-badge' ) ).toHaveText( '1' );
	} );

	test( 'on a phone opens a group as a sheet, and its close button keeps the pick', async ( { page, requestUtils } ) => {
		test.skip( ! isPhone(), 'A desktop opens a group as a popover.' );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const sheet = await widget.openGroup( 'Color' );

		await expect( sheet ).toHaveClass( /whsc-sheet--sheet/ );
		await sheet.getByRole( 'checkbox', { name: /^Black/ } ).check();
		await sheet.getByRole( 'button', { name: 'Close filters' } ).click();

		await expect( widget.sheet ).toHaveCount( 0 );
		await expect( widget.groupButton( 'Color' ) ).toHaveText( /Color: Black/ );
		await expect( widget.groupButton( 'Color' ) ).toBeFocused();
	} );

	for ( const width of [ 390, 320 ] ) {
		test( `on a ${ width }px phone keeps every control 44px and one row of filters between the field and the results`, async ( { page, requestUtils } ) => {
			test.skip( ! isPhone(), 'The phone layout.' );
			await page.setViewportSize( { width, height: 800 } );
			await mock( page );

			const widget = await openWithResults( page, requestUtils );
			const small = await widget.modal.evaluate( ( modal ) => [ ...modal.querySelectorAll( '.whsc-filterbar button, .whsc-modal-header button' ) ]
				.filter( ( node ) => node.getClientRects().length > 0 )
				.map( ( node ) => [ node.textContent.trim() || node.getAttribute( 'aria-label' ), node.getBoundingClientRect() ] )
				.filter( ( [ , box ] ) => box.width < 44 || box.height < 44 )
				.map( ( [ name, box ] ) => `${ name } ${ Math.round( box.width ) }x${ Math.round( box.height ) }` ) );

			// The field's own clear button is the field's part, not a control of the row.
			expect( small.filter( ( entry ) => ! entry.startsWith( 'Clear' ) ) ).toEqual( [] );

			const bar = await widget.filterBar.boundingBox();
			const field = await widget.input.boundingBox();
			const heading = await widget.resultsHeading.boundingBox();

			expect( bar.height ).toBeLessThanOrEqual( 52 );
			expect( bar.y ).toBeGreaterThan( field.y + field.height );
			expect( heading.y ).toBeGreaterThan( bar.y + bar.height );
			expect( await page.evaluate( () => document.documentElement.scrollWidth - document.documentElement.clientWidth ) ).toBe( 0 );
		} );
	}

	test( 'keeps the placeholder whole on a 320px phone', async ( { page, requestUtils } ) => {
		test.skip( ! isPhone(), 'The phone layout.' );
		await page.setViewportSize( { width: 320, height: 700 } );
		await mockSearchCloud( page, { assistant: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', placeholder: 'Search products …', enableVoice: true } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.input ).toHaveAttribute( 'placeholder', 'Search products …' );

		const fits = await widget.input.evaluate( ( input ) => {
			const probe = document.createElement( 'span' );
			const style = window.getComputedStyle( input );

			probe.textContent = input.placeholder;
			probe.style.font = style.font;
			probe.style.whiteSpace = 'pre';
			probe.style.position = 'absolute';
			document.body.appendChild( probe );

			const width = probe.getBoundingClientRect().width;

			probe.remove();

			return width <= input.clientWidth - parseFloat( style.paddingLeft ) - parseFloat( style.paddingRight );
		} );

		expect( fits ).toBe( true );
	} );

	test( 'lines a popover up with its button\'s right edge in a right-to-left page', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone opens a group as a sheet.' );
		await rightToLeft( page );
		await mock( page );

		const widget = await openWithResults( page, requestUtils );
		const button = widget.groupButton( 'Color' );

		await widget.openGroup( 'Color' );

		const from = await button.boundingBox();
		const box = await widget.popover.boundingBox();

		expect( Math.abs( box.x + box.width - ( from.x + from.width ) ) ).toBeLessThanOrEqual( 1 );
		expect( await page.evaluate( () => document.documentElement.scrollWidth - document.documentElement.clientWidth ) ).toBe( 0 );
	} );

	test( 'never wraps the bar: what does not fit goes under "All filters"', async ( { page, requestUtils } ) => {
		test.skip( isPhone(), 'A phone scrolls its row.' );
		setFacetFields();

		try {
			const long = [ 'attr_a_very_long_attribute_name_one', 'attr_a_very_long_attribute_name_two', 'attr_a_very_long_attribute_name_three', 'attr_a_very_long_attribute_name_four' ];

			await mockSearchCloud( page, {
				hits: [ postHit( { type: 'product', ...Object.fromEntries( long.map( ( field ) => [ field, [ 'Value' ] ] ) ) } ) ],
				facets: { types: [ { value: 'product', count: 9 }, { value: 'post', count: 2 } ], ...Object.fromEntries( long.map( ( field ) => [ field, [ { value: 'Value', count: 1 } ] ] ) ) },
			} );
			await page.setViewportSize( { width: 900, height: 800 } );
			await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

			const widget = new SearchWidget( page );
			await widget.openModal();
			await widget.search( 'jacket' );
			await expect( widget.allFilters ).toBeVisible();

			const bar = await widget.filterBar.boundingBox();
			const shown = await groupNames( widget );

			expect( bar.height ).toBeLessThanOrEqual( 44 );
			expect( shown.length ).toBeLessThan( long.length );

			await widget.allFilters.click();
			await expect( page.getByRole( 'dialog', { name: 'All filters' } ).locator( '.whsc-acc__btn' ) ).toHaveCount( long.length );
		} finally {
			setFacetFields( [ 'attr_size', 'attr_color', 'brand', 'categories', 'price', 'attr_material' ] );
		}
	} );

	test( 'shows recent and popular searches only at rest and when nothing was found', async ( { page, requestUtils } ) => {
		await mock( page, { popular: [ { query: 'jacket' }, { query: 'boots' } ] } );

		const widget = await openWithResults( page, requestUtils );
		const popular = widget.modal.getByRole( 'heading', { name: 'Popular searches' } );

		await expect( popular ).toHaveCount( 0 );

		await mockSearchCloud( page, { hits: [], total: 0, facets: { types: [] }, popular: [ { query: 'jacket' }, { query: 'boots' } ] } );
		await widget.search( 'nothing at all' );

		await expect( widget.modal.locator( '.whsc-no-results' ) ).toBeVisible();
		await expect( popular ).toBeVisible();
		await expect( widget.modal.locator( '.whsc-popular-item', { hasText: 'boots' } ) ).toBeVisible();
	} );

	test( 'leaves a gap between everything it stacks', async ( { page, requestUtils } ) => {
		await mock( page );

		const widget = await openWithResults( page, requestUtils );

		await widget.openGroup( 'Color' );
		await page.keyboard.press( 'Escape' );

		const touching = await widget.modal.evaluate( ( modal ) => {
			const containers = [
				modal.querySelector( '.whsc-modal-body' ),
				modal.querySelector( '.whsc-modal-header' ),
				modal.querySelector( '.whsc-browse__main' ),
				modal.querySelector( '.whsc-results' ),
			].filter( Boolean );
			const name = ( node ) => `${ node.tagName.toLowerCase() }.${ String( node.className ).split( ' ' )[ 0 ] }`;

			return containers.flatMap( ( container ) => {
				const boxes = [ ...container.children ]
					.filter( ( child ) => ! [ 'absolute', 'fixed' ].includes( window.getComputedStyle( child ).position ) )
					.map( ( child ) => ( { child, box: child.getBoundingClientRect() } ) )
					.filter( ( { box } ) => box.width > 0 && box.height > 0 );

				return boxes.slice( 1 ).flatMap( ( { child, box }, index ) => {
					const above = boxes[ index ];

					if ( box.top < above.box.bottom - 1 ) {
						return [];
					}

					return box.top - above.box.bottom < 3.5 ? [ `${ name( child ) } touches ${ name( above.child ) } in ${ name( container ) }` ] : [];
				} );
			} );
		} );

		expect( touching ).toEqual( [] );
	} );
} );
