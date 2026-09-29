/**
 * Elementor widget tests. The Elementor widget shares the exact same front-end
 * runtime and modal as the block (covered exhaustively by the other specs), so
 * this proves the Elementor embed point renders a working trigger end-to-end,
 * and that what only Elementor adds - its Style-tab typography - reaches the
 * storefront. It skips when Elementor is not active.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createElementorPost,
	createThemedElementorPost,
	isPluginActive,
	postHit,
} from '../utils';

/**
 * The typography `seed-elementor-themed.php` saves on the widget, per element.
 * Each size, weight and line height differs from the storefront stylesheet's
 * own, which is written at a higher specificity than Elementor's plain
 * `.whsc-instance-{id} .target` selectors - so each one only shows up here if
 * the widget's selector outranks it.
 */
const TYPOGRAPHY = {
	'.whsc-search-input__field': [ '22px', '700', '30px', 'uppercase' ],
	'.whsc-section-title': [ '19px', '300', '27px', 'lowercase' ],
	'.whsc-popular-item': [ '18px', '700', '26px', 'uppercase' ],
	'.whsc-facet__label': [ '17px', '800', '25px', 'uppercase' ],
	'.whsc-facet__count': [ '16px', '700', '24px', 'uppercase' ],
	'.whsc-card__title': [ '23px', '300', '31px', 'uppercase' ],
	'.whsc-card__price': [ '21px', '800', '29px', 'none' ],
	// The amount carries its own weight; the price control has to reach it too.
	'.whsc-card__price-current': [ '21px', '800', '29px', 'none' ],
	'.whsc-card__price-from': [ '15px', '700', '19px', 'uppercase' ],
};

/** @param {import('@playwright/test').Locator} locator */
const typographyOf = ( locator ) =>
	locator.evaluate( ( el ) => {
		const style = window.getComputedStyle( el );

		return [ style.fontSize, style.fontWeight, style.lineHeight, style.textTransform ];
	} );

test.use( { storageState: { cookies: [], origins: [] } } );

test.describe( 'Elementor widget', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'renders a trigger that opens the modal', async ( { page, requestUtils } ) => {
		test.skip( ! ( await isPluginActive( requestUtils, 'elementor' ) ), 'Elementor is not active.' );

		await mockSearchCloud( page );
		await page.goto( createElementorPost( 'icon' ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.modal ).toBeVisible();

		// The Elementor widget shares the block's runtime, so a real query works too.
		await widget.search( 'jacket' );
		await expect( widget.modal.locator( '.whsc-card' ).first() ).toBeVisible();
	} );

	test( 'applies the Style tab typography over the storefront stylesheet', async ( { page, requestUtils } ) => {
		test.skip( ! ( await isPluginActive( requestUtils, 'elementor' ) ), 'Elementor is not active.' );

		await mockSearchCloud( page, {
			// A variable price renders the "from" label beside the amount.
			hits: [ postHit( { type: 'product', title: 'Zip Hoodie', price_min: 20, price_max: 40 } ) ],
			facets: { types: [ { value: 'product', count: 1 }, { value: 'post', count: 1 } ] },
			popular: [ { query: 'hoodies' } ],
		} );
		await page.goto( createThemedElementorPost( 'box' ) );

		const widget = new SearchWidget( page );
		const triggerInput = widget.trigger.locator( 'input' );

		await expect( triggerInput ).toBeVisible();
		// Polled: a theme transition on inputs would otherwise be measured mid-way.
		await expect.poll( () => typographyOf( triggerInput ) ).toEqual( [ '20px', '700', '28px', 'uppercase' ] );

		await widget.openModal();
		await widget.search( 'hoodie' );
		await expect( widget.cards.first() ).toBeVisible();

		for ( const [ selector, expected ] of Object.entries( TYPOGRAPHY ) ) {
			const element = widget.modal.locator( selector ).first();

			await expect( element, selector ).toBeVisible();
			await expect.poll( () => typographyOf( element ), { message: selector } ).toEqual( expected );
		}
	} );
} );
