/**
 * The document fields this site indexes, as the Search Config tab offers and
 * checks them. The list is computed on the server from the saved Indexing
 * mapping (`Index_Config::indexed_fields()`, reported in the
 * `/indexing/config` catalog), the same code that decides which fields a
 * document is written with - so a field is suggested here exactly when a
 * document can carry it, and never under a name the indexer does not use.
 */

/**
 * @param {?Object} catalog The `/indexing/config` response.
 * @return {?Array<string>} Field names, or null when the catalog does not say.
 */
export const indexedFields = ( catalog ) => {
	if ( ! Array.isArray( catalog?.indexed_fields ) ) {
		return null;
	}

	return Array.from(
		new Set( catalog.indexed_fields.filter( ( field ) => 'string' === typeof field && '' !== field ) )
	);
};

/**
 * Configured fields no document from this site has. A facet on one of these
 * is always empty and a filter on it matches nothing, with no error from the
 * API to say why - which is how a facet on `category` (the indexer writes
 * `categories`) went unnoticed.
 *
 * @param {Array<string>}  fields  Configured field names.
 * @param {?Array<string>} indexed From `indexedFields()`; null when unknown.
 * @return {Array<string>} The configured names not in `indexed`, deduplicated,
 *                         in their configured order. Empty when `indexed` is
 *                         unknown, so an unreadable catalog raises no false
 *                         warning.
 */
export const unindexedFields = ( fields, indexed ) => {
	if ( ! Array.isArray( indexed ) || ! Array.isArray( fields ) ) {
		return [];
	}

	const known = new Set( indexed );

	return Array.from(
		new Set(
			fields
				.map( ( field ) => ( 'string' === typeof field ? field.trim() : '' ) )
				.filter( ( field ) => '' !== field && ! known.has( field ) )
		)
	);
};
