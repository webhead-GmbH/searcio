/**
 * Thin fetch wrapper around the Search Cloud public search API.
 *
 * Performance model (search speed is the whole point of this plugin):
 * - A tiny in-memory, TTL'd LRU caches identical GET responses for the current
 *   page view, so repeats (clicking the same recent/popular term, typing then
 *   backspacing, re-opening the modal) are instant and never re-hit the server.
 *   The cache is intentionally ephemeral — it lives only in this page's JS
 *   memory, so a reload always starts fresh; entries also expire after a short
 *   TTL, so results/prices are never more than that stale. There is no manual
 *   purge to maintain: navigation and TTL are the only invalidation.
 * - Callers pass an `AbortSignal` so a superseded query (rapid clicks/typing)
 *   is cancelled instead of racing to completion.
 *
 * On any failure the modal falls back to native `?s=` search (see the caller).
 */

import { currentLangFilter as resolveCurrentLangFilter, isLanguageSupported as resolveLanguageSupported } from './language';

const config = window.webheadSearchCloudFrontend || {};

const SEARCH_TTL = 60000; // 60s — results/prices stay fresh within a minute.
const SUGGEST_TTL = 30000; // 30s — autocomplete is cheaper and more transient.
// Card templates are designed in the Search Cloud panel and change rarely —
// per `card-templates.md`, fetch once per page load rather than per query.
const CARD_TEMPLATES_TTL = 600000; // 10 minutes.
// Matches the server's own 15-minute cache window (search.md) — popular
// queries shift slowly over a 30-day window, so there's no reason to poll
// more often than the data itself can actually change.
const POPULAR_TTL = 900000; // 15 minutes.
// Plan capabilities (whether the AI assistant tab may be shown) change only when
// the account's plan does — cache generously for the page view.
const STOREFRONT_CONFIG_TTL = 600000; // 10 minutes.
const CACHE_MAX = 60;

const cache = new Map();

const buildUrl = ( path, params ) => {
	const url = new URL( `${ config.endpoint || '' }${ path }` );

	Object.entries( params ).forEach( ( [ key, value ] ) => {
		if ( value !== undefined && value !== null && value !== '' ) {
			url.searchParams.set( key, value );
		}
	} );

	/*
	 * The search key travels in the query string, never as an `X-Search-Key`
	 * header. A custom header would make every request non-simple, so the
	 * browser would preflight it — and a preflight carries no custom headers,
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

	const response = await fetch( url, { method: 'GET', credentials: 'omit', signal } );

	if ( ! response.ok ) {
		throw new Error( `webhead-search-cloud: ${ path } responded ${ response.status }` );
	}

	const data = await response.json();

	if ( ttl > 0 ) {
		writeCache( url, data );
	}

	return data;
};

/**
 * @param {string} q
 * @param {{type?: string, filters?: Object<string,string>, page?: number, perPage?: number, signal?: AbortSignal}} [options]
 */
export const search = ( q, options = {} ) => {
	const params = { q, type: options.type, page: options.page || 1, per_page: options.perPage || 20 };

	// Filterable fields must already be configured as facet fields server-side
	// (search.md) — an unfiltered chip list never sends a field the API would
	// reject, since every chip only exists because a `/search` response
	// already returned it as a facet.
	Object.entries( options.filters || {} ).forEach( ( [ field, value ] ) => {
		if ( value ) {
			params[ `filter[${ field }]` ] = value;
		}
	} );

	return request( '/search', params, SEARCH_TTL, options.signal );
};

/**
 * @param {string} q
 * @param {{limit?: number, signal?: AbortSignal}} [options]
 */
export const suggest = ( q, options = {} ) => request(
	'/search/suggest',
	{ q, limit: options.limit || 5 },
	SUGGEST_TTL,
	options.signal
);

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
	{ limit: options.limit || 10 },
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
		body: JSON.stringify( { message, history } ),
		signal: options.signal,
	} );

	if ( ! response.ok ) {
		const error = new Error( `webhead-search-cloud: /assistant responded ${ response.status }` );
		error.status = response.status;

		throw error;
	}

	return response.json();
};

/**
 * Fire-and-forget click beacon: tells Search Cloud that a visitor opened a
 * result, so the click-through rate can be attributed to the search that
 * produced it (see docs/api/search.md `POST /search/click`). Uses
 * `navigator.sendBeacon` so it survives the navigation the click triggers and
 * never blocks it. Best-effort — any failure is swallowed.
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
		 * OPTIONS request — and the API answers preflights without any CORS
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
 * `{lang: '<code>'}` merge-in for `search()`'s `filters` option — see
 * `language.js` for when this resolves to no filter at all.
 */
export const currentLangFilter = () =>
	resolveCurrentLangFilter( config.enabledLanguages, config.currentLang );

export const getConfig = () => config;
