/**
 * Search-term redirects (see `docs/api/search-config.md`, "Search redirects").
 *
 * When a visitor's term exactly matches a rule the merchant configured, the
 * `/search` response replaces the usual payload with
 * `{query, redirect}` — no `hits`, no `total`, no `facets` — and the visitor
 * should be sent to that URL instead of being shown a results list.
 */
import { safeHref } from './url';

/**
 * A redirect response is recognised by the presence of the key, not by the
 * absence of `hits`: an empty result set is a perfectly normal search.
 *
 * @param {Object} response A `/search` response.
 * @return {boolean}
 */
export const isRedirect = ( response ) => 'string' === typeof response?.redirect && '' !== response.redirect;

/**
 * The destination, or an empty string when it is not one we will navigate to.
 *
 * The value is the merchant's own, written through their Search Cloud account,
 * and the API already constrains it to `http://`, `https://` or `/`. We check
 * again here because this string is about to be assigned to
 * `window.location.href`: a scheme that slipped through anywhere upstream
 * would otherwise execute in the visitor's page.
 *
 * Protocol-relative (`//host/path`) is not accepted. It passes a naive
 * "starts with /" check while actually pointing at another host, and a
 * merchant who means an external destination can write the scheme - which is
 * what the documented example does. `safeHref()` holds the rule, which a link
 * in an assistant's reply is held to as well.
 *
 * @param {Object} response A `/search` response.
 * @return {string}
 */
export const redirectTarget = ( response ) => ( isRedirect( response ) ? safeHref( response.redirect ) : '' );
