/**
 * What the site's plan allows (`/storefront-config` capabilities), remembered
 * for the visit. The window decides its tabs and its photo button by them, and
 * fetched afresh on every page they arrived after it had opened: the tabs
 * appeared above the field and pushed it 62px down under the visitor's thumb.
 * Kept per search key, since sites of one network can share an origin.
 */

const PREFIX = 'webheadSearchCloud.capabilities.';

const NAMES = [ 'assistant', 'quiz', 'visual_search', 'semantic_search' ];

/**
 * @param {string} searchKey
 * @return {Object<string, boolean>} The capabilities seen last on this visit, or none.
 */
export const rememberedCapabilities = ( searchKey ) => {
	try {
		const parsed = JSON.parse( window.sessionStorage.getItem( PREFIX + searchKey ) || 'null' );

		return parsed && 'object' === typeof parsed ? parsed : {};
	} catch ( error ) {
		return {};
	}
};

/**
 * @param {string} searchKey
 * @param {Object} capabilities As `/storefront-config` answered.
 */
export const rememberCapabilities = ( searchKey, capabilities ) => {
	try {
		window.sessionStorage.setItem(
			PREFIX + searchKey,
			JSON.stringify( Object.fromEntries( NAMES.map( ( name ) => [ name, Boolean( capabilities?.[ name ] ) ] ) ) )
		);
	} catch ( error ) {
		// Storage may be unavailable (private mode, quota); the window then
		// waits for the answer, as it did.
	}
};
