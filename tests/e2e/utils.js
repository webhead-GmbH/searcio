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
		redirects = {},
		quiz = false,
		quizzes = [],
		visualSearch = false,
		visualTags = [ 'red', 'silk', 'dress' ],
		visualHits = [ postHit( { title: 'Red Silk Dress', type: 'product' }, 'visual-1' ) ],
		visualStatus = 200,
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
				capabilities: { assistant, semantic_search: false, quiz, visual_search: visualSearch },
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
			// A configured redirect replaces the whole response: no hits, no
			// total, no facets - matched exactly, ignoring case and padding.
			const term = ( url.searchParams.get( 'q' ) || '' ).trim().toLowerCase();
			const target = redirects[ term ];

			if ( target ) {
				return json( { query: term, redirect: target } );
			}
			const list = 'function' === typeof hits ? hits( url ) : hits;
			return json( { search_id: searchId, hits: list, total: list.length, facets, banner } );
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
// browser targets: the tests site (`tests-cli`, :8889 — the default) or the dev
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
	const output = wpEvalFile( 'seed-elementor.php', mode );

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
 * site as connected — the gate the header upgrade CTA checks before its health
 * request. See `seed-connection.php`.
 *
 * @param {boolean} connected
 */
export function setConnected( connected = true ) {
	wpEvalFile( 'seed-connection.php', connected ? 'set' : 'clear' );
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
