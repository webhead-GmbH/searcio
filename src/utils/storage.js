/**
 * localStorage-backed recent-searches list (client-side only, per browser).
 */

const STORAGE_KEY = 'searcio.recentSearches';
// Where a visitor's recent searches were kept until 1.4.0, read once and moved.
const LEGACY_KEY = 'webheadSearchCloud.recentSearches';
const MAX_ITEMS = 8;

const readStorage = () => {
	try {
		let raw = window.localStorage.getItem( STORAGE_KEY );

		if ( null === raw ) {
			raw = window.localStorage.getItem( LEGACY_KEY );

			if ( null !== raw ) {
				window.localStorage.setItem( STORAGE_KEY, raw );
				window.localStorage.removeItem( LEGACY_KEY );
			}
		}

		const parsed = raw ? JSON.parse( raw ) : [];

		return Array.isArray( parsed ) ? parsed.filter( ( item ) => typeof item === 'string' ) : [];
	} catch ( error ) {
		return [];
	}
};

const writeStorage = ( items ) => {
	try {
		window.localStorage.setItem( STORAGE_KEY, JSON.stringify( items ) );
	} catch ( error ) {
		// Storage may be unavailable (private mode, quota); recent searches are
		// a convenience, not a requirement.
	}
};

export const getRecentSearches = () => readStorage();

export const addRecentSearch = ( query ) => {
	const trimmed = query.trim();

	if ( '' === trimmed ) {
		return getRecentSearches();
	}

	const next = [ trimmed, ...readStorage().filter( ( item ) => item.toLowerCase() !== trimmed.toLowerCase() ) ].slice( 0, MAX_ITEMS );

	writeStorage( next );

	return next;
};

export const removeRecentSearch = ( query ) => {
	const next = readStorage().filter( ( item ) => item.toLowerCase() !== query.toLowerCase() );

	writeStorage( next );

	return next;
};

export const clearRecentSearches = () => {
	writeStorage( [] );

	return [];
};
