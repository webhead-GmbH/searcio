/**
 * Shared end-to-end helpers.
 *
 * The search UI talks to the hosted Search Cloud API, so these tests never hit
 * the real service: `mockSearchCloud()` intercepts every `…/api/v1/*` request
 * and answers with canned, deterministic data (with CORS headers, since the
 * front-end fetches cross-origin). `configureSearchKey()` makes the plugin
 * report itself as connected so the front-end runs a real query instead of
 * falling back to native search, and the content helpers place the block (or an
 * Elementor widget) on a published page. `SearchWidget` is a small page object
 * over the trigger and modal so specs read as user actions.
 */

import { execSync } from 'node:child_process';

import { test as base, expect } from '@wordpress/e2e-test-utils-playwright';

export { expect };
export const test = base;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const PREFLIGHT_CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export const SEARCH_KEY = 'sk_e2e_test_key';

/**
 * One post hit shaped like a Search Cloud `/search` result.
 *
 * @param {Object} source Overrides merged into `hit.source`.
 * @param {string} id     Hit id.
 */
export const postHit = ( source = {}, id = 'post-1' ) => ( {
	id,
	score: 1,
	source: { type: 'post', title: 'Hello World', url: 'https://example.test/hello-world', ...source },
} );

/**
 * Intercept the Search Cloud API for this page. All fields are optional; the
 * `/search` response defaults to a single "Hello World" post hit.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {Array|Function} [options.hits]        `/search` hits, or a `(URL) => hits` function.
 * @param {Object}         [options.facets]      `/search` facets ({ types: [...] , field: [...] }).
 * @param {Array}          [options.suggestions] `/search/suggest` suggestions.
 * @param {Array}          [options.popular]     `/search/popular` items ({ query }).
 * @param {Array}          [options.templates]   `/card-templates` templates.
 * @param {number}         [options.searchStatus] Force a non-200 `/search` status.
 * @param {?number|Function} [options.total]     `/search` total, or a `(URL) => total` function; defaults to the number of hits returned.
 * @param {boolean}        [options.semanticSearch] Advertise semantic search, which changes what `total` means.
 * @param {Function}       [options.onSearch]    Called with the `/search` request URL.
 * @param {?string}        [options.banner]      Merchandising banner returned with `/search`.
 * @param {Array}          [options.similar]     `/search/similar` results.
 * @param {number}         [options.similarStatus] Force a non-200 `/search/similar` status.
 * @param {Object}         [options.redirects]   `{term: url}` - a `/search` for an exact
 *                                               (case-insensitive) match answers with the
 *                                               redirect shape instead of results.
 * @param {boolean}        [options.quiz]        Advertise the quiz capability.
 * @param {Array}          [options.quizzes]     `/quizzes` payload.
 * @param {boolean}        [options.visualSearch] Advertise the photo-search capability.
 * @param {Array}          [options.visualTags]  Tags the vision model "saw".
 * @param {Array}          [options.visualHits]  `/search/visual` hits.
 * @param {number}         [options.visualStatus] Force a non-200 `/search/visual` status.
 * @param {number}         [options.visualDelay]  Hold the `/search/visual` answer this many ms.
 */
export async function mockSearchCloud( page, options = {} ) {
	const {
		hits = [ postHit() ],
		facets = { types: [] },
		suggestions = [],
		popular = [],
		templates = [],
		searchStatus = 200,
		searchId = 'search-e2e',
		total = null,
		banner = null,
		similar = [],
		similarStatus = 200,
		assistant = false,
		assistantReply = 'Here are a few options.',
		assistantProducts = [],
		assistantStatus = 200,
		assistantDelay = 0,
		onAssistant,
		onSearch,
		searchDelay = 0,
		redirects = {},
		quiz = false,
		quizzes = [],
		visualSearch = false,
		semanticSearch = false,
		visualTags = [ 'red', 'silk', 'dress' ],
		visualHits = [ postHit( { title: 'Red Silk Dress', type: 'product' }, 'visual-1' ) ],
		visualStatus = 200,
		visualDelay = 0,
	} = options;

	await page.route( '**/api/v1/**', async ( route ) => {
		// Cross-origin JSON POSTs (the assistant) trigger a CORS preflight.
		if ( 'OPTIONS' === route.request().method() ) {
			return route.fulfill( { status: 204, headers: PREFLIGHT_CORS } );
		}

		const url = new URL( route.request().url() );
		const path = url.pathname.replace( /.*\/api\/v1/, '' );
		const json = ( body, status = 200 ) => route.fulfill( { status, headers: CORS, body: JSON.stringify( body ) } );

		if ( '/storefront-config' === path ) {
			return json( {
				capabilities: { assistant, semantic_search: semanticSearch, quiz, visual_search: visualSearch },
				facets: [],
				languages: [],
			} );
		}
		if ( '/search/similar' === path ) {
			if ( 200 !== similarStatus ) {
				return json( {}, similarStatus );
			}

			return json( { similar } );
		}
		if ( '/quizzes' === path ) {
			return json( { quizzes } );
		}
		if ( '/search/visual' === path ) {
			if ( visualDelay > 0 ) {
				await new Promise( ( resolve ) => setTimeout( resolve, visualDelay ) );
			}
			if ( 200 !== visualStatus ) {
				return json( {}, visualStatus );
			}

			return json( {
				query: visualTags.join( ' ' ) || null,
				tags: visualTags,
				total: visualHits.length,
				hits: visualHits,
				facets: {},
			} );
		}
		if ( '/assistant' === path ) {
			// `onAssistant` returns the status for this call, so a spec can fail
			// the first attempt and answer the retry.
			const status = onAssistant ? onAssistant() : assistantStatus;

			if ( assistantDelay > 0 ) {
				await new Promise( ( resolve ) => setTimeout( resolve, assistantDelay ) );
			}

			if ( 200 !== status ) {
				return json( {}, status );
			}

			return json( { reply: assistantReply, products: assistantProducts } );
		}
		if ( '/search' === path ) {
			if ( onSearch ) {
				onSearch( url );
			}
			if ( 200 !== searchStatus ) {
				return json( {}, searchStatus );
			}
			// Holding one search open is how a spec gets two of them in flight
			// at once - a function form so it can delay, say, only page two.
			const held = 'function' === typeof searchDelay ? searchDelay( url ) : searchDelay;

			if ( held > 0 ) {
				await new Promise( ( resolve ) => setTimeout( resolve, held ) );
			}
			// A configured redirect replaces the whole response: no hits, no
			// total, no facets - matched exactly, ignoring case and padding.
			const term = ( url.searchParams.get( 'q' ) || '' ).trim().toLowerCase();
			const target = redirects[ term ];

			if ( target ) {
				return json( { query: term, redirect: target } );
			}
			const list = 'function' === typeof hits ? hits( url ) : hits;
			// A real `total` is what the index matched, which is only the same as
			// the page's length when everything fits on one page.
			return json( {
				search_id: searchId,
				hits: list,
				total: null === total ? list.length : ( 'function' === typeof total ? total( url ) : total ),
				page: Number( url.searchParams.get( 'page' ) || 1 ),
				per_page: Number( url.searchParams.get( 'per_page' ) || 20 ),
				facets,
				banner,
			} );
		}
		if ( '/search/click' === path ) {
			return json( { recorded: true }, 202 );
		}
		if ( '/search/suggest' === path ) {
			return json( { suggestions } );
		}
		if ( '/search/popular' === path ) {
			return json( { popular } );
		}
		if ( '/card-templates' === path ) {
			return json( { templates } );
		}

		return json( {}, 404 );
	} );
}

/**
 * Set (or clear) the plugin's public search key through its own REST settings
 * endpoint, so the localized front-end config reports as connected.
 *
 * @param {import('@wordpress/e2e-test-utils-playwright').RequestUtils} requestUtils
 * @param {string} key
 */
export async function configureSearchKey( requestUtils, key = SEARCH_KEY ) {
	await requestUtils.rest( {
		path: '/webhead-search-cloud/v1/settings',
		method: 'POST',
		data: { settings: { search_key: key } },
	} );
}

/**
 * Publish a page containing the search block and return its permalink.
 *
 * @param {import('@wordpress/e2e-test-utils-playwright').RequestUtils} requestUtils
 * @param {Object} attributes Block attributes (mode, enableVoice, …).
 */
export async function createBlockPost( requestUtils, attributes = {} ) {
	const attrs = Object.keys( attributes ).length ? ' ' + JSON.stringify( attributes ) : '';
	const post = await requestUtils.createPost( {
		title: 'Search block page',
		content: `<!-- wp:webhead-search-cloud/search${ attrs } /-->`,
		status: 'publish',
	} );

	return post.link;
}

/**
 * Whether a plugin is active on the site, via the core plugins REST route.
 *
 * @param {import('@wordpress/e2e-test-utils-playwright').RequestUtils} requestUtils
 * @param {string} plugin Plugin slug, e.g. `elementor`.
 */
export async function isPluginActive( requestUtils, plugin ) {
	try {
		const plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );

		return plugins.some(
			( item ) => item.status === 'active' && ( item.plugin === `${ plugin }/${ plugin }` || item.textdomain === plugin )
		);
	} catch ( e ) {
		return false;
	}
}

/**
 * Publish an Elementor page holding a single Search Cloud widget and return its
 * permalink. Elementor renders the front end from `_elementor_data`, which is
 * not writable over REST, so this seeds the page through WP-CLI in the wp-env
 * container (see `seed-elementor.php`). Requires Elementor to be active.
 *
 * @param {string} mode Trigger mode: 'icon' or 'box'.
 */
// Run a seed script (tests/e2e/*.php) through WP-CLI on the same wp-env site the
// browser targets: the tests site (`tests-cli`, :8889 - the default) or the dev
// site (`cli`, :8888) when WP_BASE_URL points there.
function wpEvalFile( file, ...args ) {
	const port = new URL( process.env.WP_BASE_URL || 'http://localhost:8889' ).port;
	const container = '8888' === port ? 'cli' : 'tests-cli';
	const seed = `wp-content/plugins/webhead-search-cloud/tests/e2e/${ file }`;

	return execSync(
		`npx wp-env run ${ container } wp eval-file ${ seed } ${ args.join( ' ' ) }`.trim(),
		{ encoding: 'utf-8', stdio: [ 'ignore', 'pipe', 'ignore' ] }
	);
}

export function createElementorPost( mode = 'icon' ) {
	return seededUrl( wpEvalFile( 'seed-elementor.php', mode ) );
}

/**
 * Like `createElementorPost()`, but the widget has its Style-tab controls set,
 * typography included (see `seed-elementor-themed.php` for the values).
 *
 * @param {string} mode Trigger mode: 'icon' or 'box'.
 */
export function createThemedElementorPost( mode = 'icon' ) {
	return seededUrl( wpEvalFile( 'seed-elementor-themed.php', mode ) );
}

/**
 * Give the site the styles of one somebody has designed - an Elementor kit's
 * Site Settings where there is a kit, and a stylesheet of the site's own - so a
 * spec can read the storefront under them (see `seed-site-styles.php` for what
 * is written). The site is shared with every other spec: whoever calls this
 * calls `clearSiteStyles()` when it is done, in a `finally`.
 *
 * @param {string} scope 'elements' styles the site's elements, 'body' sets its own type, 'all' does both.
 */
export function setSiteStyles( scope = 'elements' ) {
	wpEvalFile( 'seed-site-styles.php', 'set', scope );
}

/** Put the site's styles back as `setSiteStyles()` found them. Safe to call when nothing was set. */
export function clearSiteStyles() {
	wpEvalFile( 'seed-site-styles.php', 'clear' );
}

/**
 * Serve every page as WordPress does on a site whose language is written right
 * to left: `dir="rtl"` on the document, `rtl` on the body, and the storefront's
 * `-rtl` stylesheet in place of the other. The test site has no such language,
 * and switching it to one would change the site under every other spec.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function rightToLeft( page ) {
	await page.route( /\/public\/style-bundle\.search\.css/, ( route ) => {
		const url = new URL( route.request().url() );

		url.pathname = url.pathname.replace( 'style-bundle.search.css', 'style-bundle.search-rtl.css' );

		return route.continue( { url: url.toString() } );
	} );

	await page.route( '**/*', async ( route ) => {
		if ( 'document' !== route.request().resourceType() ) {
			return route.fallback();
		}

		// No limit of its own. A fetch is given ten seconds here, a busy test
		// site takes longer than that to serve a page now and then, and the
		// navigation that asked for the page has a limit already.
		const response = await route.fetch( { timeout: 0 } );
		const body = ( await response.text() )
			.replace( '<html ', '<html dir="rtl" ' )
			.replace( '<body class="', '<body class="rtl ' );

		return route.fulfill( { response, body } );
	} );
}

function seededUrl( output ) {
	// Restrict to URL-safe characters so WP-CLI's trailing status glyph (printed
	// right after the URL) can't be captured as part of it.
	const match = output.match( /WHSC_URL:(https?:\/\/[\w./?#&=:%~+-]+)/ );

	if ( ! match ) {
		throw new Error( `Could not resolve the Elementor page URL from WP-CLI output:\n${ output }` );
	}

	return match[ 1 ];
}

/**
 * Store (or clear) dummy connection credentials so the settings page reports the
 * site as connected - the gate the header upgrade CTA checks before its health
 * request. See `seed-connection.php`.
 *
 * @param {boolean} connected
 */
export function setConnected( connected = true ) {
	wpEvalFile( 'seed-connection.php', connected ? 'set' : 'clear' );
}

/**
 * Set the plan tier the site keeps - 'free', 'paid', or 'clear' for none - which
 * the storefront decides on the searcio logo from. See `seed-plan.php`.
 *
 * @param {string} tier
 */
export function setPlanTier( tier = 'clear' ) {
	wpEvalFile( 'seed-plan.php', tier );
}

/**
 * Page object over the search trigger and its portalled modal.
 */
export class SearchWidget {
	/** @param {import('@playwright/test').Page} page */
	constructor( page ) {
		this.page = page;
		this.trigger = page.locator( '[data-whsc-trigger]' ).first();
		this.modal = page.locator( '.whsc-modal' );
		this.input = this.modal.locator( '.whsc-search-input__field' );
		this.cards = this.modal.locator( '.whsc-card' );
		this.closeButton = this.modal.locator( '.whsc-modal-close' );
		this.photoInput = this.modal.locator( '.whsc-visual-input' );
		this.photoButton = this.modal.locator( '.whsc-visual-btn' );
		this.photoTags = this.modal.locator( '.whsc-visual-tag' );
		this.quizQuestion = this.modal.locator( '.whsc-quiz__question' );
		this.quizOptions = this.modal.locator( '.whsc-quiz__option' );
		this.quizAnswers = this.modal.locator( '.whsc-quiz__answer' );
		this.quizCards = this.modal.locator( '.whsc-quiz__grid .whsc-card' );
		this.rangeGroups = this.modal.locator( '.whsc-range' );
		this.loadMore = this.modal.locator( '.whsc-load-more__button' );
		this.resultsHeading = this.modal.locator( '.whsc-browse__main .whsc-section-title' );
	}

	async openModal() {
		// The server renders an empty `[data-whsc-trigger]` placeholder; waiting
		// for it to be visible waits for React to hydrate a real, sized control
		// into it. The interactive child is an icon button or (box mode) an input.
		await this.trigger.waitFor( { state: 'visible' } );
		await this.trigger.locator( 'button, input' ).first().click();
		await this.modal.waitFor( { state: 'visible' } );
	}

	async search( query ) {
		await this.input.fill( query );
		// `fill` leaves the field focused; press via the keyboard rather than the
		// element so a submit that navigates away (the native-search fallback when
		// the plugin is unconfigured) doesn't fail an element-actionability recheck
		// as the input detaches.
		await this.page.keyboard.press( 'Enter' );
	}

	async close() {
		await this.closeButton.click();
	}

	/** Switch to one of the modal's tabs by its visible name. */
	async openTab( name ) {
		await this.modal.getByRole( 'tab', { name } ).click();
	}

	/** Upload a photo through the hidden input the camera button opens. */
	async searchByPhoto( filePath ) {
		await this.photoInput.setInputFiles( filePath );
	}

	/** Answer the question currently on screen. */
	async answerQuiz( label ) {
		await this.quizOptions.filter( { hasText: label } ).first().click();
	}
}

/**
 * What an admin screen stacks without a gap, as a list of sentences; empty
 * when nothing touches.
 *
 * `Card.Content` does not space what is put in it, and neither does a fragment:
 * two elements written one after the other sit flush against each other unless
 * a `Stack` with a `gap`, or the shell's own content area, holds them. That
 * cannot be seen in the source, so it is measured: the children of the shell's
 * content, of each tab panel and what it wraps, and of each part of a card that
 * carries the plugin's card class. The inside of a control or a table is the
 * component's own business.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function touchingInShell( page ) {
	return page.locator( '.webhead-search-cloud-admin-page' ).evaluate( ( element ) => {
		const panels = [ ...element.querySelectorAll( '[role="tabpanel"]' ) ];
		const containers = [
			element.querySelector( '.webhead-search-cloud-admin-page__content' ),
			...panels,
			// A panel animates what it holds in one wrapper; the tab's own
			// column is the first thing inside that.
			...panels.map( ( panel ) => panel.firstElementChild?.firstElementChild ),
			...[ ...element.querySelectorAll( '.whsc-card' ) ].flatMap( ( card ) => [ ...card.children ] ),
		].filter( Boolean );

		const name = ( node ) => `${ node.tagName.toLowerCase() }.${ String( node.className ).split( ' ' )[ 0 ] }`;

		return containers.flatMap( ( container ) => {
			const boxes = [ ...container.children ]
				.filter( ( child ) => ! [ 'absolute', 'fixed' ].includes( window.getComputedStyle( child ).position ) )
				.map( ( child ) => ( { child, box: child.getBoundingClientRect() } ) )
				.filter( ( { box } ) => box.width > 0 && box.height > 0 );

			return boxes.slice( 1 ).flatMap( ( { child, box }, index ) => {
				const above = boxes[ index ];

				// Beside the one before it, not under it.
				if ( box.top < above.box.bottom - 1 ) {
					return [];
				}

				// 4px is the smallest gap token there is.
				return box.top - above.box.bottom < 3.5
					? [ `${ name( child ) } touches ${ name( above.child ) } in ${ name( container ) }` ]
					: [];
			} );
		} );
	} );
}
