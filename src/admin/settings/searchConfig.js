/**
 * Mapping between Searcio's `/search-config` payload and the shape the
 * Search Config tab edits. Kept out of the component so the contract can be
 * tested directly - every field here is defined by `docs/api/search-config.md`.
 */

/**
 * Site-level switches reported as `{ available, enabled }` (plus `status` for
 * AI search). `available` and `status` are server-owned and ignored on write.
 */
export const FEATURE_KEYS = [ 'ai_search', 'visual_tagging', 'visual_search', 'personalization' ];

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
	// The optional category trigger: fire the rule when this facet filter is
	// active, so a category listing page can be curated and not just a typed
	// search. `null` for every rule that does not use it, and the inputs want
	// strings.
	filter_field: 'string' === typeof rule?.filter_field ? rule.filter_field : '',
	filter_value: 'string' === typeof rule?.filter_value ? rule.filter_value : '',
	pinned: Array.isArray( rule?.pinned ) ? rule.pinned : [],
	hidden: Array.isArray( rule?.hidden ) ? rule.hidden : [],
	// The API stores an empty banner as `null`; the input wants a string.
	banner: 'string' === typeof rule?.banner ? rule.banner : '',
	// The one language the rule fires in, or `null` for every language. A
	// service from before rules had a language leaves the key out.
	lang: 'string' === typeof rule?.lang && '' !== rule.lang ? rule.lang : null,
} ) );

/**
 * Search-term redirects: an exact match on `query` sends the visitor to `url`
 * instead of running a search at all.
 *
 * @param {Array} raw `redirects` from the API.
 * @return {Array} Rules with every field present.
 */
export const normalizeRedirects = ( raw ) => ( Array.isArray( raw ) ? raw : [] ).map( ( rule ) => ( {
	query: 'string' === typeof rule?.query ? rule.query : '',
	url: 'string' === typeof rule?.url ? rule.url : '',
} ) );

/**
 * A rule the API will not store. It drops a row missing *either* half rather
 * than rejecting it, so sending one means the merchant watches their row
 * disappear on the next read with nothing explaining why - better to drop it
 * here, where the form still shows what they typed.
 */
export const isBlankRedirect = ( rule ) =>
	'' === ( rule?.query || '' ).trim() || '' === ( rule?.url || '' ).trim();

/**
 * @param {Object} raw The `/search-config` response.
 * @return {Object} The tab's working copy.
 */
/** How a filter combines the values picked in it: OR, the default, or AND. */
export const FACET_MATCHES = [ 'any', 'all' ];

/**
 * Per filter field, whether a result has to carry any of the values picked in
 * it (`any`) or all of them (`all`), as Searcio reports it in `facet_match`.
 *
 * Null when Searcio leaves the key out, as a service without the setting
 * does: the tab then offers no choice the service would not keep. An empty
 * map arrives as a list from PHP, and is a service that has the setting.
 *
 * @param {*} raw `facet_match` from `GET /search-config`.
 * @return {Object<string,string>|null} Field => `any` or `all`.
 */
export const normalizeFacetMatch = ( raw ) => {
	if ( Array.isArray( raw ) ) {
		return {};
	}

	if ( ! raw || 'object' !== typeof raw ) {
		return null;
	}

	return Object.fromEntries( Object.entries( raw ).filter( ( [ , mode ] ) => FACET_MATCHES.includes( mode ) ) );
};

/**
 * The search terms Searcio never offers as popular searches, as it reports
 * them in `excluded_popular_terms`.
 *
 * Null when Searcio leaves the key out, as a service without the list does:
 * the tab then offers no list the service would not keep.
 *
 * @param {*} raw `excluded_popular_terms` from `GET /search-config`.
 * @return {string[]|null} The terms, or null.
 */
export const normalizeExcludedTerms = ( raw ) => ( Array.isArray( raw )
	? raw.filter( ( term ) => 'string' === typeof term )
	: null );

/**
 * The terms as Searcio keeps them: trimmed, without empty lines, and each
 * once whatever its capitals, in the spelling first typed. Searcio does the
 * same on save; doing it here as well sends what the tab will read back.
 *
 * @param {string[]} terms
 * @return {string[]}
 */
export const cleanTerms = ( terms ) => {
	const seen = new Set();

	return ( Array.isArray( terms ) ? terms : [] )
		.map( ( term ) => String( term ).trim() )
		.filter( ( term ) => {
			const key = term.toLowerCase();

			if ( '' === term || seen.has( key ) ) {
				return false;
			}

			seen.add( key );

			return true;
		} );
};

/** One term per line, as the textarea shows them. */
export const termsToText = ( terms ) => ( Array.isArray( terms ) ? terms.join( '\n' ) : '' );

export const textToTerms = ( text ) => String( text )
	.split( '\n' )
	.map( ( line ) => line.trim() )
	.filter( ( line ) => '' !== line );

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
	facet_match: normalizeFacetMatch( raw?.facet_match ),
	suggest_fields: Array.isArray( raw?.suggest_fields ) ? raw.suggest_fields : [],
	excluded_popular_terms: normalizeExcludedTerms( raw?.excluded_popular_terms ),
	synonyms: Array.isArray( raw?.synonyms ) ? raw.synonyms : [],
	languages: Array.isArray( raw?.languages ) ? raw.languages : [],
	merchandising: normalizeMerchandising( raw?.merchandising ),
	redirects: normalizeRedirects( raw?.redirects ),
	features: normalizeFeatures( raw?.features ),
} );

/**
 * The whole configuration as `PUT /search-config` takes it. Feature switches
 * are reduced to their `enabled` flag - `available` and `status` are the
 * server's to report, and echoing them back would be describing state we do
 * not own.
 *
 * @param {Object} config The tab's working copy.
 * @return {Object} Request body.
 */
const fullPayload = ( config ) => ( {
	...config,
	// An unset category trigger is `null` on the wire, not the empty string the
	// text inputs hold - and both halves only mean anything together, so a row
	// with just one filled in sends neither.
	merchandising: ( config.merchandising || [] ).map( ( rule ) => {
		const field = ( rule.filter_field || '' ).trim();
		const value = ( rule.filter_value || '' ).trim();
		const paired = '' !== field && '' !== value;

		return { ...rule, filter_field: paired ? field : null, filter_value: paired ? value : null };
	} ),
	// A half-filled row is dropped by the API rather than rejected, which would
	// silently lose it on the next read; drop it here so the form shows what was
	// actually stored.
	redirects: ( config.redirects || [] ).filter( ( rule ) => ! isBlankRedirect( rule ) ),
	// Every filter field once, and none that is no longer one; left out for a
	// service that does not report the setting.
	facet_match: config.facet_match
		? Object.fromEntries( ( config.facet_fields || [] ).map( ( field ) => [ field, 'all' === config.facet_match[ field ] ? 'all' : 'any' ] ) )
		: undefined,
	// Present replaces the list and absent keeps it, so a service without
	// the list is sent none.
	excluded_popular_terms: Array.isArray( config.excluded_popular_terms )
		? cleanTerms( config.excluded_popular_terms )
		: undefined,
	/*
	 * Only switches this plan can actually carry. Enabling a feature the plan
	 * does not include is a 422 on `features.<name>.enabled` - and because the
	 * tab re-sends its whole state on every save, one such switch left on after
	 * a downgrade would reject every unrelated edit until someone worked out
	 * which field the error meant. Turning a feature *off* is always allowed,
	 * so an unavailable-but-enabled switch is still sent as false.
	 */
	features: Object.fromEntries(
		FEATURE_KEYS.map( ( key ) => {
			const feature = config.features?.[ key ] || {};
			const enabled = Boolean( feature.enabled ) && false !== feature.available;

			return [ key, { enabled } ];
		} )
	),
} );

/**
 * The payload for `PUT /search-config`: what the tab changed since it read the
 * configuration, and nothing else.
 *
 * Searcio keeps every key a PUT leaves out and replaces every key it holds.
 * The tab may show what it read some minutes ago (the read is kept), and the
 * same settings can be changed in the Searcio panel meanwhile: sending the
 * whole configuration put back, on any save, what the panel had changed since.
 * So a key goes only when the tab changed it, a feature switch only when that
 * switch changed, and `facet_match` when it or the filter fields changed.
 *
 * @param {Object} config    The tab's working copy.
 * @param {Object} [persisted] The configuration as the tab read it. Without it
 *                             the whole configuration is sent.
 * @return {Object} Request body.
 */
export const toPayload = ( config, persisted ) => {
	const next = fullPayload( config );

	if ( ! persisted ) {
		return next;
	}

	const before = fullPayload( persisted );
	const same = ( key ) => JSON.stringify( next[ key ] ) === JSON.stringify( before[ key ] );
	const payload = {};

	Object.keys( next ).forEach( ( key ) => {
		if ( 'features' !== key && 'facet_match' !== key && ! same( key ) ) {
			payload[ key ] = next[ key ];
		}
	} );

	if ( undefined !== next.facet_match && ( ! same( 'facet_match' ) || ! same( 'facet_fields' ) ) ) {
		payload.facet_match = next.facet_match;
	}

	const features = Object.fromEntries(
		Object.entries( next.features ).filter( ( [ key, value ] ) => JSON.stringify( value ) !== JSON.stringify( before.features[ key ] ) )
	);

	if ( Object.keys( features ).length > 0 ) {
		payload.features = features;
	}

	return payload;
};

/** Comma-separated document ids, as the merchandising inputs show them. */
export const idsToText = ( ids ) => ( Array.isArray( ids ) ? ids.join( ', ' ) : '' );

export const textToIds = ( text ) => text
	.split( ',' )
	.map( ( id ) => id.trim() )
	.filter( ( id ) => '' !== id );

/**
 * A merchandising rule's id lists are validated per entry
 * (`merchandising.0.pinned.2`), but the UI edits the whole list as one
 * comma-separated field - so collect every entry's error onto that field
 * rather than dropping the ones that have no input of their own.
 *
 * @param {Object} errors  The API's `errors` envelope.
 * @param {string} section e.g. `merchandising`.
 * @param {number} index   Rule index.
 * @param {string} column  e.g. `pinned`.
 * @return {string|undefined} Joined messages, or undefined when clean.
 */
export const listError = ( errors, section, index, column ) =>
	errorsUnder( errors, `${ section }.${ index }.${ column }` );

/**
 * Every message the API gave for a list field or one of its entries.
 *
 * @param {Object} errors The API's `errors` envelope.
 * @param {string} prefix e.g. `excluded_popular_terms`.
 * @return {string|undefined} Joined messages, or undefined when clean.
 */
export const errorsUnder = ( errors, prefix ) => {
	const messages = Object.entries( errors || {} )
		.filter( ( [ key ] ) => key === prefix || key.startsWith( `${ prefix }.` ) )
		.flatMap( ( [ , value ] ) => ( Array.isArray( value ) ? value : [] ) );

	return messages.length > 0 ? messages.join( ' ' ) : undefined;
};

/**
 * The content types this site indexes, by the type their documents carry -
 * what a boost is matched against. The Indexing tab lets an admin name it
 * ("artikel" for posts); keyed by the post type, the boost asked for "post"
 * and moved nothing.
 *
 * @param {?Object} catalog The `/indexing/config` response.
 * @return {Object<string,string>} Document type => label.
 */
export const enabledTypeLabels = ( catalog ) => {
	const labels = {};

	( catalog?.post_types || [] ).forEach( ( postType ) => {
		if ( postType.config?.enabled ) {
			const type = String( postType.config?.type || '' ).trim() || postType.slug;

			labels[ type ] ??= postType.label;
		}
	} );

	return labels;
};

/**
 * Whether a redirect's term is one an earlier redirect has, as Searcio matches
 * a term: whatever its capitals and the spaces around it. "versand" and
 * "VERSAND " were both saved, each with its own target, and nothing said
 * that one of them would never be followed.
 *
 * @param {Array<{query?: string}>} rules
 * @param {number}                  index
 * @return {boolean}
 */
export const repeatsRedirect = ( rules, index ) => {
	const term = ( rule ) => String( rule?.query ?? '' ).trim().toLocaleLowerCase();
	const own = term( rules?.[ index ] );

	return '' !== own && ( rules || [] ).slice( 0, index ).some( ( rule ) => term( rule ) === own );
};
