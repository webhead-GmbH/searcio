/**
 * A site somebody has designed.
 *
 * Most sites this plugin runs on style the elements of the whole page: an
 * Elementor kit's Site Settings (`.elementor-kit-7 button {}`), a theme's
 * `h3 {}` and `a:hover {}`, a designer's own CSS behind an id. The search
 * modal is drawn in `body`, under all of it, and the storefront has to come
 * out as it does on a site with none of it.
 *
 * `seed-site-styles.php` writes such a site. The storefront is walked once
 * without those styles and once with them, and the computed style of every
 * element the plugin draws is kept for each state it was in; the two readings
 * are then compared one part of the surface at a time. It is one test, with a
 * check per part that does not stop the others: the walk is the slow half, and
 * a test that fails starts the next one from the top. The site is shared with
 * the other specs, so it is customized only while it is being walked.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	setSiteStyles,
	clearSiteStyles,
	postHit,
} from '../utils';

/** What a site's rule could change and a visitor could see. */
const PROPS = [
	'display', 'position', 'float', 'z-index', 'box-sizing', 'visibility', 'opacity', 'overflow-x', 'overflow-y',
	'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
	'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
	'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
	'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
	'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
	'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
	'background-color', 'background-image', 'color', 'fill', 'stroke',
	'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-caps', 'line-height', 'letter-spacing', 'word-spacing',
	'text-align', 'text-transform', 'text-decoration-line', 'text-decoration-color', 'text-indent', 'text-shadow', 'text-overflow',
	'white-space', 'vertical-align', 'word-break', 'overflow-wrap',
	'list-style-type', 'cursor', 'pointer-events', 'appearance',
	'outline-style', 'outline-width', 'outline-color', 'outline-offset', 'box-shadow', 'transform', 'filter',
	'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'justify-content', 'order',
	'row-gap', 'column-gap', 'grid-template-columns', 'object-fit', 'aspect-ratio', 'content',
];

const image = ( fill ) =>
	'data:image/svg+xml;utf8,' + encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${ fill }"/></svg>`
	);

const PRODUCTS = [
	postHit( { type: 'product', title: 'Waterproof Trail Jacket', url: '#p1', image: image( '#0f766e' ), price: 129.9, in_stock: true, brand: 'PeakNord' }, 'p-1' ),
	postHit( { type: 'product', title: 'Merino Base Layer', url: '#p2', image: image( '#7c3aed' ), on_sale: true, regular_price: 89, sale_price: 59, price: 59, in_stock: true, brand: 'FrostGuard' }, 'p-2' ),
	postHit( { type: 'product', title: 'Alpine Boots', url: '#p3', product_type: 'variable', price_min: 99, price_max: 149, price: 99, in_stock: false, brand: 'PeakNord' }, 'p-3' ),
	...Array.from( { length: 9 }, ( _, index ) =>
		postHit( { type: 'product', title: `Trail Shirt ${ index + 1 }`, url: `#s${ index }`, image: image( '#334155' ), price: 19 + index, in_stock: true }, `shirt-${ index + 1 }` )
	),
	postHit( { type: 'post', title: 'How to layer for a winter hike', url: '#b1', image: image( '#be123c' ), content: 'Three layers do most of the work.', date: '2026-09-01' }, 'post-1' ),
];

const QUIZ = {
	id: 4,
	name: 'Find your fit',
	questions: [
		{
			id: 'style',
			text: "What's your style?",
			options: [
				{ id: 'casual', label: 'Casual', next_question_id: null, tags_matched: [ { field: 'style', value: 'casual' } ] },
				{ id: 'formal', label: 'Formal', next_question_id: null, tags_matched: [ { field: 'style', value: 'formal' } ] },
			],
		},
	],
};

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>';

/** A card as the service compiles one: see `server-cards.spec.js`. */
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
		'<p class="sct-12-brand">{{brand}}</p>',
		`<span class="sct-12-icon">${ ICON }</span>`,
		'<hr class="sct-12-rule">',
		'<div class="sct-12-html"><h4>Care</h4><p>Free <strong>returns</strong> for <em>30 days</em>.</p><ul><li>Wash cold</li></ul></div>',
		'</a>',
	].join( '' ),
	css: [
		'.sct-12-root { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid #d1d5db; color: #111827; text-decoration: none; }',
		'.sct-12-title { font-size: 17px; font-weight: 600; }',
		'.sct-12-icon { color: #be123c; }',
	].join( '\n' ),
};

const MOCK = {
	hits: PRODUCTS,
	total: 45,
	facets: {
		types: [ { value: 'product', count: 12 }, { value: 'post', count: 1 } ],
		brand: [ { value: 'PeakNord', count: 7 }, { value: 'FrostGuard', count: 4 } ],
		price: [],
	},
	popular: [ 'hoodie', 'belt', 'cap', 'beanie' ].map( ( query ) => ( { query } ) ),
	suggestions: [ 'shirt', 'shirt dress' ],
	assistant: true,
	assistantReply: 'Here are **two options**:\n\n- a shell for wet days\n- a warm *base layer*\n\nThe [size guide](/size-guide/) helps, and so does [the maker](https://example.org/care).',
	assistantProducts: PRODUCTS.slice( 0, 3 ),
	quiz: true,
	quizzes: [ QUIZ ],
	visualSearch: true,
	// This month's photo searches are spent: the one way to an error that
	// leaves the modal open.
	visualStatus: 429,
	banner: 'Winter sale - up to 40% off',
	similar: PRODUCTS.slice( 0, 6 ),
	templates: [ TEMPLATE ],
};

// A one-pixel PNG, for the photo search that is refused.
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let photo;

/**
 * The page the storefront is walked on: every placement, and a button of the
 * site's own, short enough to fit a phone under any rule the site has for it.
 */
const CONTENT = [
	'<!-- wp:html --><button type="button" class="whsc-e2e-probe">Go</button><!-- /wp:html -->',
	'<!-- wp:webhead-search-cloud/search {"mode":"icon","enableVoice":true} /-->',
	'<!-- wp:webhead-search-cloud/search {"mode":"box","placeholder":"Search the shop","cardSource":"server"} /-->',
	'<!-- wp:webhead-search-cloud/products {"source":"similar","heading":"You may also like","layout":"carousel"} /-->',
].join( '\n' );

/** The computed style of every element the plugin draws, keyed by where it is. */
const read = ( page ) => page.evaluate( ( props ) => {
	// A class that is not the same from one page load to the next.
	const passing = /^(css-|e[0-9a-z]{5,}\d+$|whsc-instance-|is-busy$)/;
	const label = ( node ) => {
		const classes = [ ...node.classList ].filter( ( name ) => ! passing.test( name ) ).sort().join( '.' );
		const twins = node.parentElement ? [ ...node.parentElement.children ].filter( ( sibling ) => sibling.tagName === node.tagName ) : [ node ];

		return `${ node.tagName.toLowerCase() }${ classes ? '.' + classes : '' }[${ twins.indexOf( node ) }]`;
	};
	const styleOf = ( node, pseudo ) => {
		const style = window.getComputedStyle( node, pseudo );

		return Object.fromEntries( props.map( ( prop ) => [ prop, style.getPropertyValue( prop ) ] ) );
	};
	const roots = [
		...document.querySelectorAll( '[data-whsc-trigger], [data-whsc-list], .whsc-modal-overlay, .components-tooltip, .components-popover' ),
	];
	const found = {};

	roots.forEach( ( root, index ) => {
		const walk = ( node, trail ) => {
			// Text that is there to be read out and is clipped to nothing: how it
			// is set is not something a visitor sees.
			if ( node.matches( '.components-visually-hidden, .screen-reader-text' ) ) {
				return;
			}

			const key = `${ trail } > ${ label( node ) }`;

			found[ key ] = styleOf( node );

			[ '::before', '::after' ].forEach( ( pseudo ) => {
				const content = window.getComputedStyle( node, pseudo ).getPropertyValue( 'content' );

				if ( content && 'none' !== content && 'normal' !== content ) {
					found[ `${ key }${ pseudo }` ] = styleOf( node, pseudo );
				}
			} );

			if ( 'INPUT' === node.tagName || 'TEXTAREA' === node.tagName ) {
				found[ `${ key }::placeholder` ] = styleOf( node, '::placeholder' );
			}

			[ ...node.children ].forEach( ( child ) => walk( child, key ) );
		};

		walk( root, `#${ index }` );
	} );

	return found;
}, PROPS );

/**
 * Every state the storefront is read in, by name.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          url
 * @return {Promise<Object<string, Object>>} The styles `read()` found, per state.
 */
async function walk( page, url ) {
	const seen = {};
	const widget = new SearchWidget( page );
	const triggers = page.locator( '[data-whsc-trigger]' );
	const away = () => page.mouse.move( 1, 1 );
	const keep = async ( name ) => {
		seen[ name ] = await read( page );
	};
	// From the keyboard, which is what draws a ring round the control.
	const reach = async ( locator ) => {
		await locator.focus();
		await page.keyboard.press( 'Shift' );
	};

	await page.goto( url );
	// The searches of the walk before this one would be listed as recent ones.
	await page.evaluate( () => window.localStorage.clear() );
	await page.reload();
	// A state is read as soon as it is reached, so nothing may still be on its way there.
	await page.addStyleTag( { content: '*, *::before, *::after { transition: none !important; animation: none !important; }' } );

	await expect( triggers.nth( 1 ).locator( 'input' ) ).toBeVisible();
	await expect( page.locator( '[data-whsc-list] .whsc-card' ).first() ).toBeVisible();
	await page.evaluate( () => document.fonts.ready );

	// A phone lays a page that is wider than its screen out on a wider one, the
	// modal with it, and the two readings would be of two different screens. So
	// the site's own page has to fit, styled or not; the plugin's part of it is
	// in that width too.
	expect(
		await page.evaluate( () => document.documentElement.scrollWidth - document.documentElement.clientWidth ),
		'the page is no wider than the screen'
	).toBe( 0 );

	seen.probe = await page.locator( '.whsc-e2e-probe' ).evaluate( ( node ) => {
		const style = window.getComputedStyle( node );

		return [ style.fontStyle, style.textTransform ];
	} );

	await away();
	await keep( 'page' );
	await triggers.nth( 0 ).locator( 'button' ).hover();
	await keep( 'page, pointer on the icon' );
	await page.locator( '[data-whsc-list] .whsc-card' ).first().hover();
	await keep( 'page, pointer on a card of the row' );
	await away();
	await reach( triggers.nth( 1 ).locator( 'input' ) );
	await keep( 'page, focus in the box' );

	// The modal, as it opens: the popular searches and the highlights.
	await triggers.nth( 0 ).locator( 'button' ).click();
	await expect( widget.modal.locator( '.whsc-popular-item' ).first() ).toBeVisible();
	await expect( widget.cards.first() ).toBeVisible();
	await away();
	await keep( 'modal' );
	await widget.modal.locator( '.whsc-submit-btn' ).hover();
	await keep( 'modal, pointer on the search button' );
	await widget.modal.locator( '.whsc-popular-item' ).first().hover();
	await keep( 'modal, pointer on a popular search' );
	await widget.cards.first().hover();
	await keep( 'modal, pointer on a card' );
	await away();
	await reach( widget.closeButton );
	await keep( 'modal, focus on the close button' );
	await reach( widget.modal.locator( '.whsc-modal-tab:not(.is-active)' ).first() );
	await keep( 'modal, focus on a tab' );

	await widget.input.fill( 'shi' );
	await expect( widget.modal.getByRole( 'listbox', { name: 'Search suggestions' } ) ).toBeVisible();
	await keep( 'suggestions' );
	await page.keyboard.press( 'ArrowDown' );
	await expect( widget.modal.getByRole( 'option', { selected: true } ) ).toHaveCount( 1 );
	await keep( 'suggestions, a key on the first one' );

	// Results: the banner, the filters, a price range, the cards, the next page.
	await widget.search( 'shirt' );
	await expect( widget.resultsHeading ).toBeVisible();
	await expect( widget.modal.locator( '.whsc-facet' ).nth( 1 ) ).toBeVisible();
	await expect( widget.cards.first() ).toBeVisible();
	await widget.input.blur();
	await away();
	await keep( 'results' );
	await widget.modal.locator( '.whsc-facet' ).nth( 1 ).hover();
	await keep( 'results, pointer on a filter' );
	await away();
	await reach( widget.modal.locator( '.whsc-range__input' ).first() );
	await keep( 'results, focus in a price bound' );
	await reach( widget.loadMore );
	await keep( 'results, focus on load more' );

	await widget.searchByPhoto( photo );
	await expect( widget.modal.getByRole( 'alert' ) ).toBeVisible();
	await widget.input.blur();
	await away();
	await keep( 'an error' );

	await widget.openTab( /assistant/i );
	await page.locator( '.whsc-assistant__input' ).fill( 'a warm jacket for wet days' );
	await page.locator( '.whsc-assistant__input' ).press( 'Enter' );
	await expect( page.locator( '.whsc-assistant__grid .whsc-card' ).first() ).toBeVisible();
	await away();
	await keep( 'assistant' );
	await page.locator( '.whsc-assistant__compare-toggle' ).hover();
	await keep( 'assistant, pointer on the compare switch' );
	await page.locator( '.whsc-assistant__bubble a' ).first().hover();
	await keep( 'assistant, pointer on a link of the reply' );
	await away();
	await reach( page.locator( '.whsc-assistant__bubble a' ).last() );
	await keep( 'assistant, focus on a link of the reply' );
	await away();

	await widget.openTab( /product finder/i );
	await expect( widget.quizQuestion ).toBeVisible();
	await keep( 'product finder' );
	await widget.quizOptions.first().hover();
	await keep( 'product finder, pointer on an answer' );
	await away();

	// The second placement, whose cards are designed in Search Cloud.
	await widget.close();
	await expect( widget.modal ).toBeHidden();
	await triggers.nth( 1 ).locator( 'input' ).click();
	await expect( widget.modal ).toBeVisible();
	await widget.search( 'shirt' );
	await expect( widget.modal.locator( '.whsc-card--server' ).first() ).toBeVisible();
	await widget.input.blur();
	await away();
	await keep( 'designed cards' );
	await widget.modal.locator( '.whsc-card--server a' ).first().hover();
	await keep( 'designed cards, pointer on a card' );

	return seen;
}

/**
 * What is not the same in two readings of the same states.
 *
 * @param {Object}   plain  The reading without the site's styles.
 * @param {Object}   styled The reading with them.
 * @param {string[]} states The states to compare.
 * @return {string[]} One line per difference, as `state | element | property: plain -> styled`.
 */
function differences( plain, styled, states ) {
	const lines = [];

	states.forEach( ( state ) => {
		const before = plain[ state ] || {};
		const after = styled[ state ] || {};

		Object.keys( before ).forEach( ( key ) => {
			// The last two elements of the trail say which one it is.
			const where = key.split( ' > ' ).slice( -2 ).join( ' > ' );

			if ( ! after[ key ] ) {
				lines.push( `${ state } | ${ where } | not drawn on the designed site` );

				return;
			}

			PROPS.forEach( ( prop ) => {
				if ( before[ key ][ prop ] !== after[ key ][ prop ] ) {
					lines.push( `${ state } | ${ where } | ${ prop }: ${ before[ key ][ prop ] } -> ${ after[ key ][ prop ] }` );
				}
			} );
		} );

		Object.keys( after ).filter( ( key ) => ! before[ key ] ).forEach( ( key ) => {
			lines.push( `${ state } | ${ key.split( ' > ' ).slice( -2 ).join( ' > ' ) } | drawn on the designed site only` );
		} );
	} );

	return lines;
}

test.use( { storageState: { cookies: [], origins: [] } } );

/** The parts of the surface, and the states each was read in. */
const PARTS = {
	'the triggers and a row of products': [
		'page',
		'page, pointer on the icon',
		'page, pointer on a card of the row',
		'page, focus in the box',
	],
	'the modal as it opens': [
		'modal',
		'modal, pointer on the search button',
		'modal, pointer on a popular search',
		'modal, pointer on a card',
		'modal, focus on the close button',
		'modal, focus on a tab',
		'suggestions',
		'suggestions, a key on the first one',
	],
	'the results and their filters': [
		'results',
		'results, pointer on a filter',
		'results, focus in a price bound',
		'results, focus on load more',
		'an error',
	],
	'the assistant': [
		'assistant',
		'assistant, pointer on the compare switch',
		'assistant, pointer on a link of the reply',
		'assistant, focus on a link of the reply',
	],
	'the product finder': [ 'product finder', 'product finder, pointer on an answer' ],
	'a card designed in Search Cloud': [ 'designed cards', 'designed cards, pointer on a card' ],
};

test.describe( 'On a site that styles every element', () => {
	test.beforeAll( () => {
		photo = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'whsc-' ) ), 'dress.png' );
		fs.writeFileSync( photo, Buffer.from( PIXEL, 'base64' ) );
	} );

	test.afterAll( () => {
		clearSiteStyles();
	} );

	test( 'draws the storefront as it does on a site that styles none', async ( { page, requestUtils } ) => {
		test.setTimeout( 300000 );

		await configureSearchKey( requestUtils );

		// A page: a post would bring the theme's comment form, which the site's
		// rules for a field make wider than a phone.
		const post = await requestUtils.createPage( { title: 'Site styles', status: 'publish', content: CONTENT } );
		let plain = {};
		let styled = {};

		// The microphone is drawn only where the browser can listen.
		await page.addInitScript( () => {
			window.webkitSpeechRecognition = window.webkitSpeechRecognition || function () {};
		} );
		await mockSearchCloud( page, MOCK );

		try {
			clearSiteStyles();
			plain = await walk( page, post.link );
			setSiteStyles();
			styled = await walk( page, post.link );
		} finally {
			clearSiteStyles();
		}

		// A button of the site's own took the site's rules; were it not so,
		// everything below would compare a plain site with itself.
		expect( plain.probe ).not.toEqual( [ 'italic', 'uppercase' ] );
		expect( styled.probe ).toEqual( [ 'italic', 'uppercase' ] );

		Object.entries( PARTS ).forEach( ( [ part, states ] ) => {
			states.forEach( ( state ) => {
				expect( Object.keys( plain[ state ] || {} ).length, `"${ state }" was read` ).toBeGreaterThan( 0 );
			} );

			const lines = differences( plain, styled, states );

			expect.soft( lines.slice( 0, 40 ), `${ part }: ${ lines.length } differences` ).toEqual( [] );
		} );
	} );
} );
