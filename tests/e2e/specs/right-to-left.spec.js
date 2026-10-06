/**
 * The storefront in a page written right to left. The stylesheet is flipped by
 * the build, which a browser then lays out; what the build cannot flip is what
 * the script does with a position, and a carousel is all positions: its track
 * starts at the right edge there and scrolls into negative numbers.
 */

import { test, expect, SearchWidget, mockSearchCloud, configureSearchKey, createBlockPost, rightToLeft, postHit } from '../utils';

const MANY_HITS = Array.from( { length: 24 }, ( _, index ) =>
	postHit( { type: 'product', title: `Trail Shirt ${ index + 1 }`, url: `#s${ index }`, price: 19 + index }, `shirt-${ index + 1 }` )
);

/** How far the track has moved from the edge it starts at. */
const travelled = ( track ) => track.evaluate( ( el ) => Math.round( Math.abs( el.scrollLeft ) ) );

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'In a right-to-left page', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test.beforeEach( async ( { page } ) => {
		// The carousel then jumps to a page instead of gliding there.
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await rightToLeft( page );
		await mockSearchCloud( page, { hits: MANY_HITS } );
	} );

	test( 'the carousel starts at its right edge and its dots follow it', async ( { page, requestUtils } ) => {
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'shirt' );

		const track = widget.modal.locator( '.whsc-carousel-track' );
		const dots = widget.modal.locator( '.whsc-carousel-dot' );

		await expect( track ).toHaveCSS( 'direction', 'rtl' );
		await expect( dots.nth( 2 ) ).toBeAttached();
		await expect( dots.nth( 0 ) ).toHaveAttribute( 'aria-selected', 'true' );

		// The first card is the one against the right edge of the track.
		const edges = await track.evaluate( ( el ) => {
			const card = el.querySelector( '.whsc-carousel-item' ).getBoundingClientRect();
			const box = el.getBoundingClientRect();

			return Math.round( box.right - card.right );
		} );

		expect( edges ).toBeLessThanOrEqual( 4 );

		// A dot goes to its page, and is then the one that is marked.
		await dots.nth( 2 ).click();

		const page2 = await track.evaluate( ( el ) => 2 * el.clientWidth );

		await expect.poll( () => travelled( track ) ).toBeGreaterThan( page2 * 0.9 );
		expect( await track.evaluate( ( el ) => el.scrollLeft ) ).toBeLessThan( 0 );
		await expect( dots.nth( 2 ) ).toHaveAttribute( 'aria-selected', 'true' );

		await dots.nth( 0 ).click();
		await expect.poll( () => travelled( track ) ).toBe( 0 );
		await expect( dots.nth( 0 ) ).toHaveAttribute( 'aria-selected', 'true' );
	} );

	test( 'the arrows of the carousel move it on and back', async ( { page, requestUtils } ) => {
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );

		await widget.openModal();
		await widget.search( 'shirt' );

		const track = widget.modal.locator( '.whsc-carousel-track' );
		const previous = widget.modal.locator( '.whsc-carousel-arrow--prev' );
		const next = widget.modal.locator( '.whsc-carousel-arrow--next' );

		await expect( widget.modal.locator( '.whsc-carousel-dot' ).nth( 1 ) ).toBeAttached();

		// A phone has no arrows: the track is dragged there.
		test.skip( ! ( await next.isVisible() ), 'The carousel has no arrows where there is no pointer to hover with.' );

		// Nothing comes before the first card, and there is more after it.
		await expect( previous ).toBeDisabled();
		await expect( next ).toBeEnabled();

		// Onwards is to the left: that is the side the next arrow is on.
		const sides = await track.evaluate( ( el ) => {
			const centre = ( node ) => {
				const box = node.getBoundingClientRect();

				return box.left + ( box.width / 2 );
			};

			return [
				centre( el.parentElement.querySelector( '.whsc-carousel-arrow--next' ) ),
				centre( el ),
				centre( el.parentElement.querySelector( '.whsc-carousel-arrow--prev' ) ),
			];
		} );

		expect( sides[ 0 ] ).toBeLessThan( sides[ 1 ] );
		expect( sides[ 2 ] ).toBeGreaterThan( sides[ 1 ] );

		await next.click();
		await expect.poll( () => travelled( track ) ).toBeGreaterThan( 100 );
		await expect( previous ).toBeEnabled();

		await previous.click();
		await expect.poll( () => travelled( track ) ).toBe( 0 );
		await expect( previous ).toBeDisabled();

		// An arrow key moves the track the way the arrow points.
		await track.focus();
		await page.keyboard.press( 'ArrowLeft' );
		await expect.poll( () => travelled( track ) ).toBeGreaterThan( 100 );
		await page.keyboard.press( 'ArrowRight' );
		await expect.poll( () => travelled( track ) ).toBe( 0 );
	} );
} );
