/**
 * Responsive layout integrity. Because every spec runs on both the desktop and
 * mobile projects, this focuses on the layout invariants that most often break
 * on small screens: the modal opening and being usable, and the page never
 * gaining a horizontal scrollbar while the modal is open.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const QUIZ = {
	id: 1,
	name: 'Find your fit',
	questions: [
		{
			id: 'style',
			text: "What's your style?",
			options: [ { id: 'casual', label: 'Casual', next_question_id: null, tags_matched: [ { field: 'style', value: 'casual' } ] } ],
		},
	],
};

// Enough cards for several carousel pages at any width.
const MANY_HITS = Array.from( { length: 20 }, ( _, index ) =>
	postHit( { title: `Shirt ${ index + 1 }`, type: 'product' }, `shirt-${ index + 1 }` )
);

test.describe( 'Responsive layout', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'the modal opens, searches, and never causes horizontal overflow', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: [ postHit( { title: 'Waterproof Jacket' } ) ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'jacket' );
		await expect( widget.modal.getByText( 'Waterproof Jacket' ) ).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
		);
		expect( hasHorizontalOverflow ).toBe( false );
	} );

	test( 'the modal covers a large share of a mobile viewport', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' !== testInfo.project.name, 'Mobile-only expectation.' );

		await mockSearchCloud( page );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const box = await widget.modal.boundingBox();
		const viewport = page.viewportSize();
		expect( box.width ).toBeGreaterThan( viewport.width * 0.85 );
	} );

	/**
	 * Three mode tabs outgrow a 320px row. The last one was cut at the edge, and
	 * reaching it slid the whole modal body sideways under its own
	 * `overflow: hidden` - search field and results with it.
	 */
	test( 'at 320px the mode tabs scroll within their row', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 320, height: 568 } );
		await mockSearchCloud( page, { assistant: true, quiz: true, quizzes: [ QUIZ ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const last = widget.modal.getByRole( 'tab', { name: /product finder/i } );
		await last.focus();

		await expect( last ).toBeInViewport( { ratio: 1 } );
		expect( await widget.modal.locator( '.whsc-modal-body' ).evaluate( ( body ) => body.scrollLeft ) ).toBe( 0 );

		// Choosing it brings the close button into the row, narrowing it again;
		// the tab just chosen is the one that has to stay whole.
		await last.click();
		await expect( widget.modal.getByRole( 'button', { name: 'Close search' } ) ).toBeVisible();
		await expect( last ).toBeInViewport( { ratio: 1 } );
	} );

	/**
	 * On a touch screen the arrows are hidden and the dots are the only thing
	 * that pages the carousel; each needs a 24px target, not just the 8px dot.
	 */
	test( 'the carousel page dots are targets a finger can hit', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' !== testInfo.project.name, 'The dots are the touch paging control.' );

		await mockSearchCloud( page, { hits: MANY_HITS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'shirt' );

		const dots = widget.modal.locator( '.whsc-carousel-dot' );
		await expect( dots.first() ).toBeVisible();

		for ( const box of await dots.evaluateAll( ( all ) => all.map( ( dot ) => dot.getBoundingClientRect().toJSON() ) ) ) {
			expect( Math.min( box.width, box.height ) ).toBeGreaterThanOrEqual( 24 );
		}
	} );

	/**
	 * Capped at a fixed height, the phone's chip row became a scroll box inside
	 * the scrolling modal for the last few pixels of its fourth row, and a long
	 * term never truncated, so the box scrolled sideways too.
	 */
	test( 'on a phone the popular searches never scroll inside the modal', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' !== testInfo.project.name, 'The chip layout is the phone one.' );

		await mockSearchCloud( page, {
			popular: [
				{ query: 'hoodie with logo' },
				{ query: 'a much longer popular search that cannot fit on one line of a phone' },
				...[ 'belt', 'cap', 'beanie', 'scarf', 'socks', 'gloves', 'boots', 'jacket' ].map( ( query ) => ( { query } ) ),
			],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		const list = widget.modal.locator( '.whsc-popular-list' );
		await expect( list.locator( '.whsc-popular-item' ) ).toHaveCount( 10 );

		const overflow = await list.evaluate( ( el ) => ( {
			down: el.scrollHeight - el.clientHeight,
			across: el.scrollWidth - el.clientWidth,
		} ) );
		expect( overflow ).toEqual( { down: 0, across: 0 } );
	} );

	/**
	 * Stacked in one column, the recent and popular searches came first and the
	 * results below them - at 320px entirely out of sight, so a submitted search
	 * changed nothing on screen.
	 */
	test( 'on a narrow screen the results come before the recent and popular searches', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 320, height: 568 } );
		await mockSearchCloud( page, {
			hits: MANY_HITS,
			popular: [ 'hoodie', 'belt', 'cap', 'beanie', 'scarf', 'socks', 'gloves', 'boots' ].map( ( query ) => ( { query } ) ),
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		const popularHeading = widget.modal.getByRole( 'heading', { name: 'Popular searches' } );
		await expect( popularHeading ).toBeVisible();

		await widget.search( 'shirt' );

		await expect( widget.resultsHeading ).toHaveText( '20 results' );
		await expect( widget.resultsHeading ).toBeInViewport();
		// First in the DOM, not only on screen: focus follows the DOM.
		const titles = await widget.modal.locator( '.whsc-section-title' ).allTextContents();
		expect( titles[ 0 ] ).toBe( '20 results' );
		expect( titles.indexOf( 'Popular searches' ) ).toBeGreaterThan( 0 );

		// An empty field is browsing again, with the helpers back on top.
		await widget.input.fill( '' );
		await expect( popularHeading ).toBeInViewport();
	} );

	/**
	 * At 320px the field kept 64px for text beside three 44px buttons, so the
	 * placeholder was cut; with the Search button as well it had no room at
	 * all. The button is an icon there, and the field's own padding tighter.
	 */
	test( 'at 320px the search field keeps room for its placeholder', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 320, height: 568 } );
		// The mic only renders where the browser can listen; a stand-in makes
		// the row the three-button one this is about, in any engine.
		await page.addInitScript( () => {
			window.webkitSpeechRecognition = window.webkitSpeechRecognition || function () {};
		} );
		await mockSearchCloud( page, { visualSearch: true } );

		const widget = new SearchWidget( page );
		const room = () => widget.input.evaluate( ( field ) => {
			const style = getComputedStyle( field );
			const context = document.createElement( 'canvas' ).getContext( '2d' );
			context.font = `${ style.fontWeight } ${ style.fontSize } ${ style.fontFamily }`;

			return {
				text: Math.ceil( context.measureText( field.placeholder ).width ),
				room: field.clientWidth - parseFloat( style.paddingLeft ) - parseFloat( style.paddingRight ),
			};
		} );

		// The German placeholder, which the old spacing clipped (64px of room).
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'type', enableVoice: true, placeholder: 'Suchen …' } ) );
		await widget.openModal();
		await expect( widget.modal.locator( '.whsc-voice-btn' ) ).toBeVisible();
		const typeMode = await room();
		expect( typeMode.text ).toBeLessThanOrEqual( typeMode.room );

		await page.goto( await createBlockPost( requestUtils, { mode: 'icon', searchTrigger: 'submit' } ) );
		await widget.openModal();
		const submit = widget.modal.getByRole( 'button', { name: 'Search', exact: true } );
		await expect( submit ).toBeVisible();
		const box = await submit.boundingBox();
		expect( Math.round( box.width ) ).toBe( 44 );
		expect( Math.round( box.height ) ).toBe( 44 );
		expect( ( await room() ).room ).toBeGreaterThanOrEqual( 80 );
	} );

	/** Under 16px, iOS Safari zooms the page in when a field takes focus. */
	test( 'on a touch screen the assistant field is large enough not to zoom', async ( { page, requestUtils }, testInfo ) => {
		test.skip( 'mobile-chrome' !== testInfo.project.name, 'Touch-only rule.' );

		await mockSearchCloud( page, { assistant: true } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await expect( widget.input ).toHaveCSS( 'font-size', '16px' );

		await widget.openTab( 'AI Assistant' );
		await expect( widget.modal.getByRole( 'textbox', { name: /message/i } ) ).toHaveCSS( 'font-size', '16px' );
	} );

	/**
	 * On a narrow screen picking a popular search moves the popular list below
	 * the results, which unmounts the button that was pressed; focus fell to
	 * the page body, outside the modal.
	 */
	test( 'on a narrow screen a picked popular search hands focus to the results', async ( { page, requestUtils } ) => {
		await page.setViewportSize( { width: 375, height: 667 } );
		await mockSearchCloud( page, { hits: MANY_HITS, popular: [ { query: 'shirt' }, { query: 'belt' } ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await widget.modal.locator( '.whsc-popular-item', { hasText: 'shirt' } ).focus();
		await page.keyboard.press( 'Enter' );

		await expect( widget.resultsHeading ).toBeFocused();
		await expect( widget.resultsHeading ).toHaveText( '20 results' );
	} );

	/**
	 * The track changes width without the window resizing - the popular
	 * searches column appearing beside it, the layout switching at a
	 * breakpoint, the Elementor editor resizing its preview frame - and the
	 * page count has to follow it. It followed window resizes only, and after
	 * the editor switched devices showed 23 dots for 7 pages.
	 */
	test( 'the carousel pages follow the track when it changes width on its own', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { hits: MANY_HITS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'shirt' );
		await expect( widget.modal.locator( '.whsc-carousel-dot' ).first() ).toBeAttached();

		// Halve the content without touching the window.
		await widget.modal.evaluate( ( modal ) => {
			const body = modal.querySelector( '.whsc-modal-body' );
			body.style.maxWidth = `${ Math.round( body.getBoundingClientRect().width / 2 ) }px`;
		} );

		// One dot per page of the narrowed track, and more than one page of it.
		await expect
			.poll( () =>
				widget.modal.evaluate( ( modal ) => {
					const track = modal.querySelector( '.whsc-carousel-track' );
					const pages = Math.ceil( track.scrollWidth / track.clientWidth );

					return pages > 1 && modal.querySelectorAll( '.whsc-carousel-dot' ).length === pages;
				} )
			)
			.toBe( true );
	} );

	test( 'the carousel jumps instead of gliding when less motion is asked for', async ( { page, requestUtils } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await mockSearchCloud( page, { hits: MANY_HITS } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.search( 'shirt' );
		await expect( widget.modal.locator( '.whsc-carousel-dot' ).nth( 1 ) ).toBeAttached();

		// Read in the same task as the click: a smooth scroll has not moved yet.
		const scrolled = await widget.modal.evaluate( ( modal ) => {
			modal.querySelectorAll( '.whsc-carousel-dot' )[ 1 ].click();

			return modal.querySelector( '.whsc-carousel-track' ).scrollLeft;
		} );
		expect( scrolled ).toBeGreaterThan( 0 );
	} );
} );
