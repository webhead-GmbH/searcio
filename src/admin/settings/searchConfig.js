/**
 * Mapping between Search Cloud's `/search-config` payload and the shape the
 * Search Config tab edits. Kept out of the component so the contract can be
 * tested directly — every field here is defined by `docs/api/search-config.md`.
 */

/**
 * Site-level switches reported as `{ available, enabled }` (plus `status` for
 * AI search). `available` and `status` are server-owned and ignored on write.
 */
export const FEATURE_KEYS = [ 'ai_search', 'visual_tagging', 'personalization' ];

/**
 * @param {Object} raw `features` from the API.
 * @return {Object} One entry per known feature, defaulted rather than missing.
 */
export const normalizeFeatures = ( raw ) => {
	const features = {};

	FEATURE_KEYS.forEach( ( key ) => {
		const value = raw?.[ key ] || {};

		features[ key ] = {
			available: Boolean( value.available ),
			enabled: Boolean( value.enabled ),
			status: 'string' === typeof value.status ? value.status : '',
		};
	} );

	return features;
};

/**
 * @param {Array} raw `merchandising` from the API.
 * @return {Array} Rules with every field present.
 */
export const normalizeMerchandising = ( raw ) => ( Array.isArray( raw ) ? raw : [] ).map( ( rule ) => ( {
	query: 'string' === typeof rule?.query ? rule.query : '',
	pinned: Array.isArray( rule?.pinned ) ? rule.pinned : [],
	hidden: Array.isArray( rule?.hidden ) ? rule.hidden : [],
	// The API stores an empty banner as `null`; the input wants a string.
	banner: 'string' === typeof rule?.banner ? rule.banner : '',
} ) );

/**
 * @param {Object} raw The `/search-config` response.
 * @return {Object} The tab's working copy.
 */
export const normalizeConfig = ( raw ) => ( {
	searchable_fields: Array.isArray( raw?.searchable_fields )
		? raw.searchable_fields.map( ( row ) => ( {
			field: typeof row?.field === 'string' ? row.field : '',
			weight: Number.isFinite( Number( row?.weight ) ) ? Number( row.weight ) : 1,
		} ) )
		: [],
	type_boosts: Array.isArray( raw?.type_boosts )
		? raw.type_boosts.map( ( row ) => ( {
			type: typeof row?.type === 'string' ? row.type : '',
			boost: Number.isFinite( Number( row?.boost ) ) ? Number( row.boost ) : 1,
		} ) )
		: [],
	facet_fields: Array.isArray( raw?.facet_fields ) ? raw.facet_fields : [],
	suggest_fields: Array.isArray( raw?.suggest_fields ) ? raw.suggest_fields : [],
	synonyms: Array.isArray( raw?.synonyms ) ? raw.synonyms : [],
	languages: Array.isArray( raw?.languages ) ? raw.languages : [],
	merchandising: normalizeMerchandising( raw?.merchandising ),
	features: normalizeFeatures( raw?.features ),
} );

/**
 * The payload for `PUT /search-config`. Feature switches are reduced to their
 * `enabled` flag — `available` and `status` are the server's to report, and
 * echoing them back would be describing state we do not own.
 *
 * @param {Object} config The tab's working copy.
 * @return {Object} Request body.
 */
export const toPayload = ( config ) => ( {
	...config,
	features: Object.fromEntries(
		FEATURE_KEYS.map( ( key ) => [ key, { enabled: Boolean( config.features?.[ key ]?.enabled ) } ] )
	),
} );

/** Comma-separated document ids, as the merchandising inputs show them. */
export const idsToText = ( ids ) => ( Array.isArray( ids ) ? ids.join( ', ' ) : '' );

export const textToIds = ( text ) => text
	.split( ',' )
	.map( ( id ) => id.trim() )
	.filter( ( id ) => '' !== id );

/**
 * A merchandising rule's id lists are validated per entry
 * (`merchandising.0.pinned.2`), but the UI edits the whole list as one
 * comma-separated field — so collect every entry's error onto that field
 * rather than dropping the ones that have no input of their own.
 *
 * @param {Object} errors  The API's `errors` envelope.
 * @param {string} section e.g. `merchandising`.
 * @param {number} index   Rule index.
 * @param {string} column  e.g. `pinned`.
 * @return {string|undefined} Joined messages, or undefined when clean.
 */
export const listError = ( errors, section, index, column ) => {
	const prefix = `${ section }.${ index }.${ column }`;
	const messages = Object.entries( errors || {} )
		.filter( ( [ key ] ) => key === prefix || key.startsWith( `${ prefix }.` ) )
		.flatMap( ( [ , value ] ) => ( Array.isArray( value ) ? value : [] ) );

	return messages.length > 0 ? messages.join( ' ' ) : undefined;
};
