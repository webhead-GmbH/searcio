import apiFetch from '@wordpress/api-fetch';

/**
 * What the settings screen has read from the server during this visit.
 *
 * A tab draws itself anew each time it is opened, and each asked the server
 * again for what it showed: the search configuration, the indexing mapping,
 * the quizzes, the connection's status. Kept here, a tab opened again shows at
 * once, and two parts of the screen that want the same answer share one
 * request. A save forgets what it changed ({@see forget}), and an answer is
 * kept {@see MAX_AGE} at most, so a screen left open does not go stale.
 */
const MAX_AGE = 5 * 60 * 1000;

/** @type {Map<string, {at: number, promise: Promise<*>}>} */
const kept = new Map();

/**
 * The server's answer to `request`, read once and kept.
 *
 * @param {Object} request An `apiFetch` request: `path`, and `method` for a read sent as POST.
 * @return {Promise<*>} The answer; a request that failed is asked again next time.
 */
export const readOnce = ( request ) => {
	const key = `${ request.method || 'GET' } ${ request.path }`;
	const hit = kept.get( key );

	if ( hit && Date.now() - hit.at < MAX_AGE ) {
		return hit.promise;
	}

	const promise = apiFetch( request ).catch( ( error ) => {
		kept.delete( key );
		throw error;
	} );

	kept.set( key, { at: Date.now(), promise } );

	return promise;
};

/**
 * Forgets every kept answer whose path starts with one of `paths`: the next
 * read asks the server.
 *
 * @param {...string} paths
 */
export const forget = ( ...paths ) => {
	for ( const key of [ ...kept.keys() ] ) {
		const path = key.slice( key.indexOf( ' ' ) + 1 );

		if ( paths.some( ( prefix ) => path.startsWith( prefix ) ) ) {
			kept.delete( key );
		}
	}
};

/** Forgets everything: the site was connected anew, or disconnected. */
export const forgetAll = () => kept.clear();
