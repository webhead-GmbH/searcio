/**
 * The searcio logo the search window ends with, linked to searcio.com: small,
 * at the end of the last line, below everything the window holds. A Free plan
 * always shows it; on any other plan Support Searcio decides, and it is on
 * until the shop turns it off.
 *
 * Runs on the desktop and mobile projects.
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
	setPlanTier,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const setSupport = ( requestUtils, value ) => requestUtils.rest( {
	path: '/webhead-search-cloud/v1/settings',
	method: 'POST',
	data: { settings: { support_searcio: value } },
} );

/**
 * Where the logo sits against the window's content box, and whether anything
 * the window holds lies below it or under it.
 *
 * @param {import('@playwright/test').Locator} modal
 */
const measure = ( modal ) => modal.evaluate( ( frame ) => {
	const body = frame.querySelector( '.whsc-modal-body' );
	const credit = body.querySelector( '.whsc-credit' );
	const style = getComputedStyle( body );
	const box = body.getBoundingClientRect();
	const mark = credit.getBoundingClientRect();
	const content = {
		left: box.left + parseFloat( style.paddingLeft ),
		right: box.right - parseFloat( style.paddingRight ),
	};
	const others = [ ...body.querySelectorAll( '*' ) ]
		.filter( ( el ) => ! credit.contains( el ) && ! el.closest( '.whsc-visually-hidden' ) )
		.map( ( el ) => el.getBoundingClientRect() )
		.filter( ( r ) => r.width > 0 && r.height > 0 );

	return {
		height: mark.height,
		fromRight: Math.round( content.right - mark.right ),
		fromLeft: Math.round( mark.left - content.left ),
		below: others.filter( ( r ) => r.bottom > mark.top + 0.5 && r.top < mark.bottom - 0.5 && r.right > mark.left && r.left < mark.right ).length,
		lowestOther: Math.max( ...others.map( ( r ) => r.bottom ) ),
		top: mark.top,
	};
} );

test.describe( 'The searcio logo in the search window', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		setPlanTier( 'clear' );
		await setSupport( requestUtils, true );
	} );

	test( 'ends the window, small, in its corner, and links to searcio in a new tab', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, {
			hits: [ postHit( { title: 'Blue Sneakers' } ), postHit( { title: 'Red Boots' }, 'post-2' ) ],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'footwear' );
		await expect( widget.cards ).toHaveCount( 2 );

		const credit = widget.modal.getByRole( 'link', { name: 'Search by searcio (opens in a new tab)' } );

		await expect( credit ).toBeVisible();
		await expect( credit ).toHaveAttribute( 'href', 'https://searcio.com/' );
		await expect( credit ).toHaveAttribute( 'target', '_blank' );
		await expect( credit ).toHaveAttribute( 'rel', /\bnoopener\b/ );

		await credit.scrollIntoViewIfNeeded();
		const at = await measure( widget.modal );

		expect( at.height ).toBeLessThanOrEqual( 20 );
		// At the end of the line, below everything else and over nothing.
		expect( at.fromRight ).toBeLessThanOrEqual( 1 );
		expect( at.below ).toBe( 0 );
		expect( at.top ).toBeGreaterThanOrEqual( at.lowestOther - 0.5 );
	} );

	test( 'is faded until it is pointed at, and rings when the keyboard reaches it', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const credit = widget.modal.locator( '.whsc-credit' );

		await expect( credit ).toHaveCSS( 'opacity', '0.6' );
		await credit.hover();
		await expect( credit ).toHaveCSS( 'opacity', '1' );
		await page.mouse.move( 0, 0 );
		await expect( credit ).toHaveCSS( 'opacity', '0.6' );

		// The keyboard, not a script: only a focus the keyboard moved is
		// `:focus-visible`. The window keeps focus inside it, so the logo,
		// its last control, is reached however many controls come before it.
		for ( let step = 0; step < 40; step++ ) {
			if ( await credit.evaluate( ( el ) => el === document.activeElement ) ) {
				break;
			}

			await page.keyboard.press( 'Tab' );
		}

		await expect( credit ).toBeFocused();
		await expect( credit ).toHaveCSS( 'opacity', '1' );
		await expect( credit ).toHaveCSS( 'outline-style', 'solid' );
	} );

	test( 'a paid plan that turned Support Searcio off shows none', async ( { page, requestUtils } ) => {
		setPlanTier( 'paid' );
		await setSupport( requestUtils, false );
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.modal ).toBeVisible();
		await expect( widget.modal.locator( '.whsc-credit' ) ).toHaveCount( 0 );
	} );

	test( 'a Free plan shows it even with Support Searcio off', async ( { page, requestUtils } ) => {
		setPlanTier( 'free' );
		await setSupport( requestUtils, false );
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( widget.modal.getByRole( 'link', { name: 'Search by searcio (opens in a new tab)' } ) ).toBeVisible();
	} );

	test( 'sits at the left end in a right-to-left page', async ( { page, requestUtils } ) => {
		await rightToLeft( page );
		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const credit = widget.modal.locator( '.whsc-credit' );

		await expect( credit ).toBeVisible();
		await credit.scrollIntoViewIfNeeded();
		expect( ( await measure( widget.modal ) ).fromLeft ).toBeLessThanOrEqual( 1 );
	} );
} );
