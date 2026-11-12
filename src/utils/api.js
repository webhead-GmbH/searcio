/**
 * Thin fetch wrapper around the Searcio public search API.
 *
 * Performance model (search speed is the whole point of this plugin):
 * - A tiny in-memory, TTL'd LRU caches identical GET responses for the current
 *   page view, so repeats (clicking the same recent/popular term, typing then
 *   backspacing, re-opening the modal) are instant and never re-hit the server.
 *   Entries expire after a short TTL, so results and prices are never more
 *   than that stale; the TTL is the only invalidation.
 * - What the window asks for whichever page it opens on - the storefront
 *   config, card templates, popular searches, quizzes and the highlights - is
 *   kept in `sessionStorage` as well, under the same TTL, so the window opens
 *   full on the next page of the visit; and two callers that ask for one of
 *   those at the same time share one request ({@see warmUp}). A typed search
 *   is kept in this page's memory only.
 * - `preconnect()` opens the connection to the service as the page loads, so
 *   the first search does not wait for DNS, TCP and TLS.
 * - Callers pass an `AbortSignal` so a superseded query (rapid clicks/typing)
 *   is cancelled instead of racing to completion.
 *
 * On any failure the modal falls back to native `?s=` search (see the caller).
 */

import { currentLangFilter as resolveCurrentLangFilter, inLanguage, isLanguageSupported as resolveLanguageSupported } from './language';
import { buildFilterParams, buildRangeParams } from './facets';

const config = window.searcioFrontend || {};

const SEARCH_TTL = 60000; // 60s - results/prices stay fresh within a minute.
// The highlights (newest or featured products) are the same for every visitor
// and change when the catalogue does: kept a few minutes, across pages too.
const HIGHLIGHTS_TTL = 300000; // 5 minutes.
const SUGGEST_TTL = 30000; // 30s - autocomplete is cheaper and more transient.
// Card templates are designed in the Searcio panel and change rarely -
// per `card-templates.md`, fetch once per page load rather than per query.
const CARD_TEMPLATES_TTL = 600000; // 10 minutes.
// Matches the server's own 15-minute cache window (search.md) - popular
// queries shift slowly over a 30-day window, so there's no reason to poll
// more often than the data itself can actually change.
const POPULAR_TTL = 900000; // 15 minutes.
// Plan capabilities (whether the AI assistant tab may be shown) change only when
// the account's plan does - cache generously for the page view.
const STOREFRONT_CONFIG_TTL = 600000; // 10 minutes.
// The whole question graph arrives in one response, is served from a
// server-side cache and is not metered as a search (quiz.md), so fetch it once
// per page view rather than per question.
const QUIZZES_TTL = 600000; // 10 minutes.
// "More like this" changes only when the catalogue does, and it is not metered
// as a search - so a visitor browsing several products pays for it once.
const SIMILAR_TTL = 600000; // 10 minutes.
// The most `/search/similar` returns in one answer.
const SIMILAR_MAX = 20;
const CACHE_MAX = 60;

// The answers kept across the pages of a visit: what the window shows before
// the visitor types, the same on every page. Keyed by when the plugin last
// changed one of them on Searcio (`cacheVersion`): a quiz published in the
// Product finder tab stayed out of a visit's window for ten minutes.
const KEPT_PATHS = [ '/storefront-config', '/card-templates', '/search/popular', '/quizzes' ];
const STORE_PREFIX = `searcio.cache:${ Number( config.cacheVersion ) || 0 }:`;

const cache = new Map();
// Requests of kept answers on their way, shared by every caller that asks.
const pending = new Map();

const buildUrl = ( path, params ) => {
	const url = new URL( `${ config.endpoint || '' }${ path }` );

	Object.entries( params ).forEach( ( [ key, value ] ) => {
		// A list goes as one parameter per entry, `key[]=a&key[]=b`.
		if ( Array.isArray( value ) ) {
			value.forEach( ( entry ) => url.searchParams.append( key, entry ) );
		} else if ( value !== undefined && value !== null && value !== '' ) {
			url.searchParams.set( key, value );
		}
	} );

	/*
	 * The search key travels in the query string, never as an `X-Search-Key`
	 * header. A custom header would make every request non-simple, so the
	 * browser would preflight it - and a preflight carries no custom headers,
	 * leaving the API with no credential to resolve the site from and no way to
	 * allow the request. The query parameter survives the preflight.
	 */
	url.searchParams.set( 'key', config.searchKey || '' );

	return url.toString();
};

const readCache = ( key, ttl ) => {
	const hit = cache.get( key );

	if ( ! hit || Date.now() - hit.at > ttl ) {
		return undefined;
	}

	// Refresh LRU recency.
	cache.delete( key );
	cache.set( key, hit );

	return hit.data;
};

const writeCache = ( key, data ) => {
	cache.set( key, { at: Date.now(), data } );

	// Evict the oldest entry once over the cap (Map preserves insertion order).
	if ( cache.size > CACHE_MAX ) {
		cache.delete( cache.keys().next().value );
	}
};

const isKept = ( path, params ) => KEPT_PATHS.includes( path ) || ( '/search' === path && 'highlights' === params.surface );

// `sessionStorage` can be missing, full or refused (a private window, a
// blocked site): the answer is then asked for again, as it always was.
const readStored = ( key, ttl ) => {
	try {
		const kept = JSON.parse( window.sessionStorage.getItem( STORE_PREFIX + key ) || 'null' );

		return kept && Date.now() - kept.at <= ttl ? kept.data : undefined;
	} catch ( e ) {
		return undefined;
	}
};

const writeStored = ( key, data ) => {
	try {
		window.sessionStorage.setItem( STORE_PREFIX + key, JSON.stringify( { at: Date.now(), data } ) );
	} catch ( e ) {
		// Not kept across pages, still kept in memory.
	}
};

const fetchJson = async ( url, path, signal ) => {
	const response = await fetch( url, { method: 'GET', credentials: 'omit', signal } );

	if ( ! response.ok ) {
		throw new Error( `searcio: ${ path } responded ${ response.status }` );
	}

	return response.json();
};

/**
 * A shared request, as one caller waits for it: the caller's signal stops its
 * own wait, not the request the others wait for too.
 *
 * @param {Promise}     promise
 * @param {AbortSignal} [signal]
 */
const awaitShared = ( promise, signal ) => {
	if ( ! signal ) {
		return promise;
	}

	return new Promise( ( resolve, reject ) => {
		const abort = () => reject( new DOMException( 'The request was aborted.', 'AbortError' ) );

		if ( signal.aborted ) {
			abort();

			return;
		}

		signal.addEventListener( 'abort', abort, { once: true } );
		promise.then( resolve, reject );
	} );
};

/**
 * @param {string}      path
 * @param {Object}      params
 * @param {number}      ttl     Cache lifetime in ms (0 disables caching).
 * @param {AbortSignal} [signal]
 */
const request = async ( path, params, ttl, signal ) => {
	const url = buildUrl( path, params );

	if ( ttl > 0 ) {
		const cached = readCache( url, ttl );

		if ( undefined !== cached ) {
			return cached;
		}
	}

	if ( ttl > 0 && isKept( path, params ) ) {
		const stored = readStored( url, ttl );

		if ( undefined !== stored ) {
			writeCache( url, stored );

			return stored;
		}

		if ( ! pending.has( url ) ) {
			pending.set(
				url,
				fetchJson( url, path )
					.then( ( data ) => {
						writeCache( url, data );
						writeStored( url, data );

						return data;
					} )
					.finally( () => pending.delete( url ) )
			);
		}

		return awaitShared( pending.get( url ), signal );
	}

	const data = await fetchJson( url, path, signal );

	if ( ttl > 0 ) {
		writeCache( url, data );
	}

	return data;
};

/**
 * Opens the connection to the service while the page loads, so the first
 * search a visitor makes does not wait for DNS, TCP and TLS. The requests omit
 * credentials, which is what `crossorigin` (anonymous) prepares for.
 */
export const preconnect = () => {
	let origin;

	try {
		origin = new URL( config.endpoint ).origin;
	} catch ( e ) {
		return;
	}

	if ( origin === window.location.origin || document.querySelector( `link[rel="preconnect"][href="${ origin }"]` ) ) {
		return;
	}

	const link = document.createElement( 'link' );

	link.rel = 'preconnect';
	link.href = origin;
	link.crossOrigin = 'anonymous';
	document.head.appendChild( link );
};

let warmed = false;

/**
 * The type the shop's products carry in the index (the Indexing tab can name
 * it), or '' on a site that indexes none. What is about products - the
 * highlights, the product rows, the product finder and photo search - asks
 * for this type where there is one: the index holds the posts and pages too,
 * and the newest products listed the site's oldest pages, and the similar
 * products of a jacket two articles.
 *
 * @return {string} The type, or ''.
 */
export const productType = () => {
	if ( ! config.hasProducts ) {
		return '';
	}

	const types = config.documentTypes && 'object' === typeof config.documentTypes ? config.documentTypes : {};

	return Object.prototype.hasOwnProperty.call( types, 'product' ) && 'string' === typeof types.product && '' !== types.product
		? types.product
		: 'product';
};

/**
 * The highlights row: the newest products, or the featured ones, in the page's
 * language, with the filters the visitor has picked. The window asks for it
 * as it opens and whenever a filter changes with the field empty, and
 * {@see warmUp} asks for the same address, so the two share one answer.
 * Without a type of its own it shows the shop's products ({@see productType}).
 *
 * The featured ones only where `featured` is one of the site's filters:
 * Searcio refused the filter otherwise (422), and the row stayed empty.
 *
 * The newest are asked for with `sort=newest`, by the date each document
 * carries (`published_at`): without it they came in the index's order, the
 * oldest first. A service from before the parameter ignores it.
 *
 * @param {{type?: string, source?: string, facets?: Object, ranges?: Object, signal?: AbortSignal}} [options]
 */
export const fetchHighlights = ( { type = '', source = 'newest', facets = {}, ranges = {}, signal } = {} ) => {
	const featured = 'featured' === source && false !== config.hasFeatured;
	const forced = { ...currentLangFilter(), ...( featured ? { featured: 'true' } : {} ) };

	return search( '', {
		type: type || productType(),
		filters: buildFilterParams( facets, forced ),
		ranges: buildRangeParams( ranges ),
		perPage: 12,
		surface: 'highlights',
		sort: featured ? undefined : 'newest',
		signal,
	} );
};

/**
 * Asks for what the window shows as it opens, a moment before the visitor
 * opens it: as the pointer reaches a search control, it takes focus or a
 * finger touches it (search-cloud #164). The storefront config, the popular
 * searches and the highlights row of the control it reached; the highlights
 * are kept for the visit, so they are asked for at most every few minutes.
 * Once per page.
 *
 * @param {{type?: string, source?: string}} [instance] The search control's scope and highlights source.
 */
export const warmUp = ( instance = {} ) => {
	if ( warmed || ! isConfigured() || ! isLanguageSupported() ) {
		return;
	}

	warmed = true;
	fetchStorefrontConfig().catch( () => {} );
	fetchPopularSearches().catch( () => {} );
	fetchHighlights( { type: instance.type || '', source: instance.source || 'newest' } ).catch( () => {} );
};

/** How a settled search was started, as the service records it (`origin` on `/search`). */
export const ORIGINS = [ 'typed', 'suggestion', 'popular', 'recent', 'voice', 'filter' ];

/** Where the results of a `/search` are shown (`surface`). */
export const SURFACES = [ 'overlay', 'highlights', 'category', 'quiz' ];

/**
 * Whether this page is a page builder's editor. Its searches are the editor's,
 * not a visitor's: the service meters them but does not record them
 * (`preview`). The plugin tells the editors it knows from the page's address
 * (`Frontend_Config`), and Elementor's frontend says so itself.
 *
 * @return {boolean} Whether the requests of this page are an editor's.
 */
export const isPreview = () => {
	if ( config.preview ) {
		return true;
	}

	try {
		return Boolean( window.elementorFrontend?.isEditMode?.() );
	} catch ( e ) {
		return false;
	}
};

/**
 * The analytics hints of a `/search` (`docs/api/search.md`). They feed the
 * site's search statistics and never change the results.
 *
 * - `live`: a search as you type that the visitor has not settled on. The
 *   service leaves it out of the counts unless one of its results is clicked.
 * - `origin`: how a settled search was started.
 * - `surface`: where its results are shown.
 * - `preview`: made in a page builder's editor.
 *
 * Only the first page of a search with a query is counted, so `live` and
 * `origin` are left off a listing without one and off "load more"; `origin`
 * is left off a live search as well.
 *
 * @param {string} q
 * @param {number} page
 * @param {{live?: boolean, origin?: string, surface?: string}} options
 * @return {Object<string, (number|string|undefined)>} The parameters to add.
 */
export const searchHints = ( q, page, options ) => {
	const counted = '' !== String( q ?? '' ).trim() && 1 === page;
	const live = counted && Boolean( options.live );

	return {
		live: live ? 1 : undefined,
		origin: counted && ! live && ORIGINS.includes( options.origin ) ? options.origin : undefined,
		surface: SURFACES.includes( options.surface ) ? options.surface : undefined,
		preview: isPreview() ? 1 : undefined,
	};
};

/**
 * A filter's value is the comma-joined values or, when one of them holds a
 * comma, the list of them ({@see filterValue}), sent as `filter[field][]`.
 *
 * `sort` is `newest`, `price_asc` or `price_desc`; without it the results
 * come by relevance.
 *
 * @param {string} q
 * @param {{type?: string, filters?: Object<string,(string|Array<string>)>, ranges?: Object<string,string>, keywords?: Array<string>, page?: number, perPage?: number, live?: boolean, origin?: string, surface?: string, sort?: string, signal?: AbortSignal}} [options]
 */
export const search = ( q, options = {} ) => {
	const page = options.page || 1;
	// The hints are part of the address, so a settled search never answers
	// from the cache a live request for the same words left behind: it goes
	// out, and the service counts it.
	// `highlight=0`: the window never shows a hit's highlighted fragments, and
	// highlighting is the most expensive part of a search for the engine
	// (search-cloud #164: about 40% of its time on the demo shop's index).
	const params = { q, type: options.type, page, per_page: options.perPage || 20, highlight: 0, sort: options.sort || undefined, ...searchHints( q, page, options ) };

	// Filterable fields must already be configured as facet fields server-side
	// (search.md) - an unfiltered chip list never sends a field the API would
	// reject, since every chip only exists because a `/search` response
	// already returned it as a facet.
	Object.entries( options.filters || {} ).forEach( ( [ field, value ] ) => {
		if ( Array.isArray( value ) ) {
			if ( value.length > 0 ) {
				params[ `filter[${ field }][]` ] = value;
			}
		} else if ( value ) {
			params[ `filter[${ field }]` ] = value;
		}
	} );

	// `range[field]=min:max` - the same allow-list applies, so these fields
	// also only ever come from a facet the response already returned. Either
	// bound may be blank ("50:" is "at least 50").
	Object.entries( options.ranges || {} ).forEach( ( [ field, value ] ) => {
		if ( value ) {
			params[ `range[${ field }]` ] = value;
		}
	} );

	// `keywords[]` - words every result must contain, one group per quiz
	// answer that asked for some (comma-separated alternatives, any of which
	// may match). Indexed, so PHP reads them back as a list.
	( options.keywords || [] ).filter( Boolean ).forEach( ( words, index ) => {
		params[ `keywords[${ index }]` ] = words;
	} );

	return request( '/search', params, 'highlights' === params.surface ? HIGHLIGHTS_TTL : SEARCH_TTL, options.signal );
};

/**
 * Titles that start with what was typed, in the language of the page on a
 * multilingual site, as a search is (`filter[lang]`), and of the type a window
 * restricted to one asks for (`type`, which a service before it ignores).
 *
 * @param {string} q
 * @param {{limit?: number, type?: string, signal?: AbortSignal}} [options]
 */
export const suggest = ( q, options = {} ) => {
	const { lang } = currentLangFilter();

	return request(
		'/search/suggest',
		{ q, limit: options.limit || 5, type: options.type || undefined, 'filter[lang]': lang },
		SUGGEST_TTL,
		options.signal
	);
};

/**
 * @param {string} [type]
 * @param {{signal?: AbortSignal}} [options]
 */
export const fetchCardTemplates = ( type, options = {} ) => request(
	'/card-templates',
	{ type },
	CARD_TEMPLATES_TTL,
	options.signal
);

/**
 * @param {{limit?: number, signal?: AbortSignal}} [options]
 */
export const fetchPopularSearches = ( options = {} ) => request(
	'/search/popular',
	// What was searched on pages in this language, on a multilingual site.
	{ limit: options.limit || 10, 'filter[lang]': currentLangFilter().lang },
	POPULAR_TTL,
	options.signal
);

/**
 * What this site's plan and setup allow (see docs/api/search.md
 * `GET /storefront-config`). Read `capabilities.assistant` to decide whether to
 * render the AI chat tab at all.
 *
 * @param {{signal?: AbortSignal}} [options]
 */
export const fetchStorefrontConfig = ( options = {} ) =>
	request( '/storefront-config', {}, STOREFRONT_CONFIG_TTL, options.signal );

/**
 * Every published guided quiz, each with its full question graph (see
 * `docs/api/quiz.md`). A site with no published quiz answers `{quizzes: []}`
 * rather than an error, so an empty list means "hide the entry point", not
 * "something went wrong".
 *
 * @param {{signal?: AbortSignal}} [options]
 * @return {Promise<{quizzes: Array<Object>}>}
 */
export const fetchQuizzes = ( options = {} ) =>
	// The quizzes in the page's language and those for every language, on a
	// multilingual site.
	request( '/quizzes', { 'filter[lang]': currentLangFilter().lang }, QUIZZES_TTL, options.signal );

/**
 * Products similar to a given one, for a "you may also like" row (see
 * `docs/api/search.md` `GET /search/similar`). Similarity is semantic: it uses
 * the source product's own embedding, so a site without AI search answers with
 * an empty list rather than an error and the row simply does not render.
 *
 * Not metered as a search, and it changes only when the catalogue does, so it
 * is cached for the page view like the card templates. The response carries a
 * `search_id` for its clicks (a service without it answers with none, and a
 * click then sends nothing).
 *
 * On a shop only the products are asked for ({@see productType}): the index
 * holds the posts as well, and a jacket's similar products were two articles.
 * A row on an article still shows the products like it. Searcio filters by
 * the type inside its search, and the hits are kept to it here as well, for
 * a service from before it took the type. On a multilingual site only those
 * in the page's language are kept. The most the service answers is asked
 * for, so the row still fills where the service filters nothing.
 *
 * @param {string}                            id        The source product's document id.
 * @param {{limit?: number, signal?: AbortSignal}} [options]
 * @return {Promise<{similar: Array<Object>}>}
 */
export const fetchSimilar = async ( id, options = {} ) => {
	const limit = options.limit || 6;
	const { lang } = currentLangFilter();
	const type = productType();
	const response = await request(
		'/search/similar',
		{ id, limit: SIMILAR_MAX, type: type || undefined, 'filter[lang]': lang, preview: isPreview() ? 1 : undefined },
		SIMILAR_TTL,
		options.signal
	);
	const similar = inLanguage( response?.similar, lang ).filter( ( hit ) => '' === type || type === hit?.source?.type );

	return { ...response, similar: similar.slice( 0, limit ) };
};

/**
 * Search by photo (see `docs/api/visual-search.md`). A vision model describes
 * the image as tags and those tags run as an ordinary search, so the response
 * carries the same `hits`/`facets` shape as `/search` plus the `tags` it saw.
 *
 * It carries a `search_id` whenever the vision model found tags, which the
 * clicks on its results are attributed to like those of a typed search, and
 * never a `redirect` (a synthetic query never triggers a merchant's
 * typed-term redirect).
 *
 * Not cached - the same photo picked twice is a new upload either way, and the
 * cache is keyed by URL, which a multipart body never varies.
 *
 * On a shop only the products are asked for ({@see productType}): a photo of
 * a bag also found the pages. The hits are kept to the type here as well, for
 * a service from before it took the type.
 *
 * @param {File}                   file      The image to search with (≤ 8 MB).
 * @param {{signal?: AbortSignal}} [options]
 * @return {Promise<{query: ?string, tags: Array<string>, total: number, hits: Array<Object>, facets: Object}>}
 */
export const visualSearch = async ( file, options = {} ) => {
	const body = new FormData();

	body.append( 'photo', file );

	const type = productType();
	const response = await fetch( buildUrl( '/search/visual', { type: type || undefined, 'filter[lang]': currentLangFilter().lang } ), {
		method: 'POST',
		credentials: 'omit',
		body,
		signal: options.signal,
	} );

	if ( ! response.ok ) {
		// 403 (not turned on for this site), 422 (missing/not an image/too
		// large) and 429 (monthly allowance or the endpoint's own rate limit)
		// each need their own message, so carry the status to the caller.
		const error = new Error( `searcio: /search/visual responded ${ response.status }` );
		error.status = response.status;

		throw error;
	}

	const result = await response.json();
	const hits = inLanguage( result?.hits, currentLangFilter().lang ).filter( ( hit ) => '' === type || type === hit?.source?.type );

	return { ...result, hits };
};

/**
 * `{ filter: { lang } }` for an assistant request on a multilingual site, or
 * nothing.
 *
 * @return {Object} The keys to add to the request body.
 */
const assistantFilter = () => {
	const { lang } = currentLangFilter();

	return lang ? { filter: { lang } } : {};
};

/**
 * The conversational shopping assistant (see docs/api/search.md `POST
 * /assistant`). Stateless: pass recent turns back as `history` to continue a
 * conversation. Resolves to `{ reply, products }`; on a non-2xx it throws an
 * Error whose `status` lets the caller branch on 403 (not on plan), 429 (AI cap
 * reached) and 502 (provider down → fall back to search).
 *
 * @param {string}                                                  message
 * @param {Array<{role: string, content: string}>}                  [history]
 * @param {{signal?: AbortSignal}}                                   [options]
 * @return {Promise<{reply: string, products: Array<Object>}>}
 */
export const askAssistant = async ( message, history = [], options = {} ) => {
	const response = await fetch( buildUrl( '/assistant', {} ), {
		method: 'POST',
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json' },
		// The page's language keeps the products it searches for to that
		// language, and the reply in it, on a multilingual site.
		body: JSON.stringify( { message, history, ...assistantFilter() } ),
		signal: options.signal,
	} );

	if ( ! response.ok ) {
		const error = new Error( `searcio: /assistant responded ${ response.status }` );
		error.status = response.status;

		throw error;
	}

	const result = await response.json();

	return { ...result, products: inLanguage( result?.products, currentLangFilter().lang ) };
};

/**
 * The events of a `text/event-stream` body, as they arrive: `{ event, data }`
 * per block, `data` parsed from JSON. An event's lines end at a blank line,
 * and a chunk of the body can end anywhere, inside a line too.
 *
 * @param {ReadableStream} body
 * @return {AsyncGenerator<{event: string, data: Object}>} The events.
 */
async function* serverEvents( body ) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	const parse = ( block ) => {
		let event = 'message';
		const data = [];

		block.split( /\r?\n/ ).forEach( ( line ) => {
			if ( line.startsWith( 'event:' ) ) {
				event = line.slice( 6 ).trim();
			} else if ( line.startsWith( 'data:' ) ) {
				data.push( line.slice( 5 ).replace( /^ /, '' ) );
			}
		} );

		if ( 0 === data.length ) {
			return null;
		}

		try {
			return { event, data: JSON.parse( data.join( '\n' ) ) };
		} catch ( e ) {
			return null;
		}
	};

	for ( ;; ) {
		const { value, done } = await reader.read();

		buffer += done ? decoder.decode() : decoder.decode( value, { stream: true } );

		const blocks = buffer.split( /\r?\n\r?\n/ );
		buffer = done ? '' : blocks.pop();

		for ( const block of blocks ) {
			const parsed = parse( block );

			if ( parsed ) {
				yield parsed;
			}
		}

		if ( done ) {
			return;
		}
	}
}

/**
 * The shopping assistant, its reply shown as it is written
 * (`docs/api/search.md`, `POST /assistant/stream`). The products come first,
 * once the assistant has searched (`onProducts`, the whole list so far each
 * time), then the reply in pieces (`onDelta`). Resolves to `{ reply,
 * products }` when the turn is complete, as `askAssistant()` does.
 *
 * A refusal comes before the stream, with the status `askAssistant()` throws
 * with. A service without the endpoint (404), a browser that cannot read a
 * response as a stream, or an answer that is not a stream is answered by
 * `askAssistant()` instead, without the pieces.
 *
 * @param {string}                                                  message
 * @param {Array<{role: string, content: string}>}                  [history]
 * @param {{signal?: AbortSignal, onProducts?: Function, onDelta?: Function}} [options]
 * @return {Promise<{reply: string, products: Array<Object>}>}
 */
export const streamAssistant = async ( message, history = [], options = {} ) => {
	if ( 'function' !== typeof TextDecoder ) {
		return askAssistant( message, history, options );
	}

	const { lang } = currentLangFilter();
	const response = await fetch( buildUrl( '/assistant/stream', {} ), {
		method: 'POST',
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
		body: JSON.stringify( { message, history, ...assistantFilter() } ),
		signal: options.signal,
	} );

	if ( 404 === response.status ) {
		return askAssistant( message, history, options );
	}

	if ( ! response.ok ) {
		const error = new Error( `searcio: /assistant/stream responded ${ response.status }` );
		error.status = response.status;

		throw error;
	}

	if ( ! ( response.headers?.get?.( 'Content-Type' ) || '' ).includes( 'text/event-stream' ) || ! response.body?.getReader ) {
		const result = await response.json();

		return { ...result, products: inLanguage( result?.products, lang ) };
	}

	let products = [];

	for await ( const { event, data } of serverEvents( response.body ) ) {
		if ( 'products' === event ) {
			products = inLanguage( data?.products, lang );
			options.onProducts?.( products );
		} else if ( 'delta' === event && 'string' === typeof data?.text ) {
			options.onDelta?.( data.text );
		} else if ( 'done' === event ) {
			return {
				reply: 'string' === typeof data?.reply ? data.reply : '',
				products: Array.isArray( data?.products ) ? inLanguage( data.products, lang ) : products,
			};
		} else if ( 'error' === event ) {
			// The turn failed part-way, and nothing was metered.
			throw new Error( `searcio: /assistant/stream failed: ${ data?.error || '' }` );
		}
	}

	// The stream ended without a `done`: the connection was cut part-way.
	throw new Error( `searcio: /assistant/stream ended before the reply did` );
};

/**
 * Fire-and-forget click beacon: tells Searcio that a visitor opened a
 * result, so the click-through rate can be attributed to the search that
 * produced it (see docs/api/search.md `POST /search/click`). Uses
 * `navigator.sendBeacon` so it survives the navigation the click triggers and
 * never blocks it. Best-effort - any failure is swallowed.
 *
 * @param {string}        searchId   The `search_id` from the search response.
 * @param {string}        documentId The clicked hit's id.
 * @param {number}        position   1-based position in the list the visitor saw.
 */
export const trackClick = ( searchId, documentId, position ) => {
	if (
		! searchId ||
		! documentId ||
		! isConfigured() ||
		'undefined' === typeof navigator ||
		'function' !== typeof navigator.sendBeacon
	) {
		return;
	}

	try {
		/*
		 * Form-encoded, not JSON. `application/json` is not a CORS-safelisted
		 * content type, so the browser has to preflight the beacon with an
		 * OPTIONS request - and the API answers preflights without any CORS
		 * headers (it emits them per site from the search-key middleware, which
		 * a preflight never reaches). The beacon was therefore blocked before it
		 * was ever sent and no click was ever recorded. A `URLSearchParams` body
		 * is safelisted, needs no preflight, and Laravel reads it exactly the
		 * same way.
		 */
		const body = new URLSearchParams( {
			search_id: searchId,
			document_id: documentId,
			position: String( position ),
		} );

		navigator.sendBeacon( buildUrl( '/search/click', {} ), body );
	} catch ( e ) {
		// Analytics must never affect the visitor.
	}
};

export const isConfigured = () => Boolean( config.endpoint && config.searchKey );

// Decision logic lives in `language.js`; this just supplies live config values.
export const isLanguageSupported = () =>
	resolveLanguageSupported( config.enabledLanguages, config.currentLang );

/**
 * `{lang: '<code>'}` merge-in for `search()`'s `filters` option - see
 * `language.js` for when this resolves to no filter at all.
 */
export const currentLangFilter = () =>
	resolveCurrentLangFilter( config.enabledLanguages, config.currentLang );

export const getConfig = () => config;
