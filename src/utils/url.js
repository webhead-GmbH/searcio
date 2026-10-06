/**
 * Addresses that did not come from this plugin's own code: a redirect a
 * merchant configured in Search Cloud, a link the assistant wrote into a reply.
 * Each is about to become an `href` or be handed to `window.location`, where a
 * scheme other than the web's would run in the visitor's page.
 */

/**
 * The address, or an empty string when it is not one to follow.
 *
 * Two shapes are followed: an absolute `http://` or `https://` address, and a
 * path on this site, which starts with one slash.
 *
 * A path that starts with two is not accepted. `//host/path` passes a naive
 * "starts with /" check while pointing at another host, and so does
 * `/\host/path`, because a browser reads a backslash in a web address as a
 * slash.
 *
 * @param {*} value
 * @return {string}
 */
export const safeHref = ( value ) => {
	const url = 'string' === typeof value ? value.trim() : '';

	if ( /^https?:\/\//i.test( url ) ) {
		return url;
	}

	if ( /^\/(?![/\\])/.test( url ) ) {
		return url;
	}

	return '';
};

/**
 * Whether an address `safeHref()` accepted leaves this site.
 *
 * @param {string} href
 * @return {boolean}
 */
export const leavesSite = ( href ) => {
	try {
		return new URL( href, window.location.href ).origin !== window.location.origin;
	} catch ( error ) {
		return true;
	}
};
