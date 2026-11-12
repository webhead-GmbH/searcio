/**
 * The `/search-config` contract mapping. `features` and `merchandising` were
 * added to the API after this tab shipped, so these pin both the reading of a
 * full payload and the narrower shape the tab is allowed to write back.
 */

import {
	changedSince,
	cleanTerms,
	enabledTypeLabels,
	repeatsRedirect,
	errorsUnder,
	FEATURE_KEYS,
	idsToText,
	isBlankRedirect,
	listError,
	normalizeConfig,
	normalizeFacetMatch,
	normalizeFeatures,
	normalizeMerchandising,
	normalizeRedirects,
	termsToText,
	textToIds,
	textToTerms,
	toPayload,
} from './searchConfig';

describe( 'normalizeFeatures', () => {
	it( 'reads every switch the API reports', () => {
		const features = normalizeFeatures( {
			ai_search: { available: true, enabled: true, status: 'ready' },
			visual_tagging: { available: true, enabled: false },
			visual_search: { available: true, enabled: true },
			personalization: { available: true, enabled: true },
		} );

		expect( features.ai_search ).toEqual( { available: true, enabled: true, status: 'ready' } );
		expect( features.visual_tagging ).toEqual( { available: true, enabled: false, status: '' } );
		expect( features.visual_search ).toEqual( { available: true, enabled: true, status: '' } );
		expect( features.personalization ).toEqual( { available: true, enabled: true, status: '' } );
	} );

	/** An older API, or a failed read, must not leave the checkboxes undefined. */
	it( 'defaults every known switch when the key is missing entirely', () => {
		const features = normalizeFeatures( undefined );

		FEATURE_KEYS.forEach( ( key ) => {
			expect( features[ key ] ).toEqual( { available: false, enabled: false, status: '' } );
		} );
	} );
} );

describe( 'normalizeMerchandising', () => {
	it( 'keeps rules whole', () => {
		expect(
			normalizeMerchandising( [
				{ query: 'winter', pinned: [ 'p-1', 'p-2' ], hidden: [ 'p-9' ], banner: 'Sale' },
			] )
		).toEqual( [ {
			query: 'winter',
			filter_field: '',
			filter_value: '',
			pinned: [ 'p-1', 'p-2' ],
			hidden: [ 'p-9' ],
			banner: 'Sale',
			lang: null,
			match: null,
		} ] );
	} );

	// A rule set to "exact" in the Searcio dashboard came back as "contains"
	// once the tab saved its rules: the tab did not keep the option.
	it( 'keeps whether a rule fires on the exact term, and sends it back', () => {
		const config = normalizeConfig( { merchandising: [ { query: 'kopfhörer', match: 'exact' }, { query: 'jacke', match: 'contains' }, { query: 'sale' } ] } );

		expect( config.merchandising.map( ( rule ) => rule.match ) ).toEqual( [ 'exact', null, null ] );

		const payload = toPayload( config );

		expect( payload.merchandising[ 0 ].match ).toBe( 'exact' );
		// "Contains" is the default and goes unsaid, for a service from before the option.
		expect( payload.merchandising[ 1 ] ).not.toHaveProperty( 'match' );
		expect( payload.merchandising[ 2 ] ).not.toHaveProperty( 'match' );
	} );

	it( 'keeps the language a rule fires in, and reads none as every language', () => {
		const [ german, every, older ] = normalizeMerchandising( [ { query: 'jacke', lang: 'de' }, { query: 'sale', lang: null }, { query: 'old' } ] );

		expect( german.lang ).toBe( 'de' );
		expect( every.lang ).toBeNull();
		expect( older.lang ).toBeNull();
	} );

	it( 'sends the language with the rule', () => {
		const payload = toPayload( normalizeConfig( { merchandising: [ { query: 'jacke', lang: 'de' }, { query: 'sale' } ] } ) );

		expect( payload.merchandising.map( ( rule ) => rule.lang ) ).toEqual( [ 'de', null ] );
	} );

	/** The API stores an empty banner as null; a text input cannot take that. */
	it( 'turns a null banner into an empty string', () => {
		expect( normalizeMerchandising( [ { query: '', pinned: [], hidden: [], banner: null } ] )[ 0 ].banner ).toBe( '' );
	} );

	it( 'fills in missing lists so a rule is always editable', () => {
		expect( normalizeMerchandising( [ {} ] )[ 0 ] ).toEqual( {
			query: '',
			filter_field: '',
			filter_value: '',
			pinned: [],
			hidden: [],
			banner: '',
			lang: null,
			match: null,
		} );
	} );

	/** Every pre-existing rule reports the category trigger as null. */
	it( 'turns a null category trigger into empty inputs', () => {
		const [ rule ] = normalizeMerchandising( [ { query: 'winter', filter_field: null, filter_value: null } ] );

		expect( rule.filter_field ).toBe( '' );
		expect( rule.filter_value ).toBe( '' );
	} );

	it( 'keeps a category trigger that is set', () => {
		const [ rule ] = normalizeMerchandising( [
			{ query: 'winter', filter_field: 'category', filter_value: 'shoes' },
		] );

		expect( rule.filter_field ).toBe( 'category' );
		expect( rule.filter_value ).toBe( 'shoes' );
	} );

	it( 'tolerates the key being absent', () => {
		expect( normalizeMerchandising( undefined ) ).toEqual( [] );
	} );
} );

describe( 'normalizeRedirects', () => {
	it( 'keeps a rule whole', () => {
		expect( normalizeRedirects( [ { query: 'black friday', url: 'https://example.com/bf' } ] ) ).toEqual( [
			{ query: 'black friday', url: 'https://example.com/bf', lang: null },
		] );
	} );

	it( 'tolerates the key being absent on an older payload', () => {
		expect( normalizeRedirects( undefined ) ).toEqual( [] );
	} );

	it( 'fills in a half-written rule so both inputs stay editable', () => {
		expect( normalizeRedirects( [ { query: 'bf' } ] ) ).toEqual( [ { query: 'bf', url: '', lang: null } ] );
	} );

	/**
	 * The API drops a rule missing *either* half rather than rejecting it, so a
	 * half-written row sent anyway would vanish on the next read with nothing
	 * explaining why. Both halves are required for the row to be worth sending.
	 */
	it( 'recognises a row the API would not store', () => {
		expect( isBlankRedirect( { query: '', url: '' } ) ).toBe( true );
		expect( isBlankRedirect( { query: '  ', url: '  ' } ) ).toBe( true );
		expect( isBlankRedirect( { query: 'bf', url: '' } ) ).toBe( true );
		expect( isBlankRedirect( { query: '', url: '/bf' } ) ).toBe( true );
		expect( isBlankRedirect( { query: 'bf', url: '/bf' } ) ).toBe( false );
	} );
} );

describe( 'normalizeConfig', () => {
	it( 'reads a full payload', () => {
		const config = normalizeConfig( {
			searchable_fields: [ { field: 'title', weight: 5 } ],
			type_boosts: [ { type: 'product', boost: 8 } ],
			facet_fields: [ 'brand' ],
			suggest_fields: [ 'title' ],
			synonyms: [ 'sneaker, trainer' ],
			languages: [ 'de' ],
			merchandising: [ { query: 'winter', pinned: [ 'p-1' ], hidden: [], banner: null } ],
			redirects: [ { query: 'black friday', url: '/bf' } ],
			features: { ai_search: { available: true, enabled: true, status: 'indexing' } },
		} );

		expect( config.searchable_fields ).toEqual( [ { field: 'title', weight: 5 } ] );
		expect( config.merchandising ).toHaveLength( 1 );
		expect( config.redirects ).toEqual( [ { query: 'black friday', url: '/bf', lang: null } ] );
		expect( config.features.ai_search.status ).toBe( 'indexing' );
		expect( config.features.visual_tagging.available ).toBe( false );
		expect( config.features.visual_search.available ).toBe( false );
	} );
} );

describe( 'facet_match', () => {
	it( 'is not offered by a service that does not report it', () => {
		expect( normalizeConfig( { facet_fields: [ 'brand' ] } ).facet_match ).toBeNull();
		// What goes over the wire.
		expect( JSON.parse( JSON.stringify( toPayload( normalizeConfig( { facet_fields: [ 'brand' ] } ) ) ) ) ).not.toHaveProperty( 'facet_match' );
	} );

	it( 'reads the mode of each field, and an empty map PHP writes as a list', () => {
		expect( normalizeFacetMatch( { features: 'all', brand: 'any', color: 'some' } ) ).toEqual( { features: 'all', brand: 'any' } );
		expect( normalizeFacetMatch( [] ) ).toEqual( {} );
	} );

	it( 'writes back every filter field once, any by default, and none that is gone', () => {
		const payload = toPayload( { facet_fields: [ 'brand', 'features' ], facet_match: { features: 'all', removed: 'all' } } );

		expect( payload.facet_match ).toEqual( { brand: 'any', features: 'all' } );
	} );
} );

describe( 'excluded_popular_terms', () => {
	it( 'is not offered by a service that does not report it', () => {
		expect( normalizeConfig( {} ).excluded_popular_terms ).toBeNull();
		// Absent keeps the list Searcio has, so nothing goes over the wire.
		expect( JSON.parse( JSON.stringify( toPayload( normalizeConfig( {} ) ) ) ) ).not.toHaveProperty( 'excluded_popular_terms' );
	} );

	it( 'reads the terms Searcio reports, an empty list included', () => {
		expect( normalizeConfig( { excluded_popular_terms: [ 'free', 7, 'sample' ] } ).excluded_popular_terms ).toEqual( [ 'free', 'sample' ] );
		expect( normalizeConfig( { excluded_popular_terms: [] } ).excluded_popular_terms ).toEqual( [] );
	} );

	/** Searcio trims them and drops a duplicate whatever its capitals. */
	it( 'writes back each term once, trimmed, in the spelling first typed', () => {
		expect( toPayload( { excluded_popular_terms: [ ' Sale ', 'sale', '', 'FREE', 'free ' ] } ).excluded_popular_terms )
			.toEqual( [ 'Sale', 'FREE' ] );
		expect( cleanTerms( undefined ) ).toEqual( [] );
	} );

	it( 'writes back an emptied list, which clears it', () => {
		expect( toPayload( { excluded_popular_terms: [] } ).excluded_popular_terms ).toEqual( [] );
	} );

	it( 'is edited one term per line', () => {
		expect( termsToText( [ 'free', 'sample' ] ) ).toBe( 'free\nsample' );
		expect( termsToText( null ) ).toBe( '' );
		expect( textToTerms( 'free\n\n  sample \n' ) ).toEqual( [ 'free', 'sample' ] );
	} );

	/** A rejected list names the field, or one of its entries. */
	it( 'collects what the API said about the list and about each term', () => {
		const errors = {
			excluded_popular_terms: [ 'At most 200 terms.' ],
			'excluded_popular_terms.3': [ 'At most 255 characters.' ],
			'excluded_popular_terms_other': [ 'Not this one.' ],
		};

		expect( errorsUnder( errors, 'excluded_popular_terms' ) ).toBe( 'At most 200 terms. At most 255 characters.' );
		expect( errorsUnder( {}, 'excluded_popular_terms' ) ).toBeUndefined();
	} );
} );

describe( 'toPayload against what the tab read', () => {
	const read = normalizeConfig( {
		searchable_fields: [ { field: 'title', weight: 5 } ],
		facet_fields: [ 'brand' ],
		facet_match: { brand: 'any' },
		synonyms: [ 'sneaker, trainer' ],
		excluded_popular_terms: [ 'free' ],
		redirects: [ { query: 'bf', url: '/bf' } ],
		features: {
			ai_search: { available: true, enabled: true, status: 'ready' },
			visual_search: { available: true, enabled: false },
		},
	} );

	/**
	 * The same settings can be changed in the Searcio panel while the tab shows
	 * what it read: a key the tab did not change is left out, and Searcio
	 * keeps what it has for it.
	 */
	it( 'sends only the keys the tab changed', () => {
		const payload = toPayload( { ...read, synonyms: [ 'sneaker, trainer', 'hoodie, sweatshirt' ] }, read );

		expect( payload ).toEqual( { synonyms: [ 'sneaker, trainer', 'hoodie, sweatshirt' ] } );
	} );

	it( 'sends nothing for an unchanged tab, or a change the API would drop anyway', () => {
		expect( toPayload( read, read ) ).toEqual( {} );
		expect( toPayload( { ...read, redirects: [ ...read.redirects, { query: '', url: '' } ] }, read ) ).toEqual( {} );
	} );

	it( 'sends one feature switch, not every switch', () => {
		const features = { ...read.features, visual_search: { ...read.features.visual_search, enabled: true } };

		expect( toPayload( { ...read, features }, read ) ).toEqual( { features: { visual_search: { enabled: true } } } );
	} );

	/** A new filter field needs its mode; the service keeps the old map otherwise. */
	it( 'sends the modes with changed filter fields', () => {
		const payload = toPayload( { ...read, facet_fields: [ 'brand', 'color' ] }, read );

		expect( payload ).toEqual( { facet_fields: [ 'brand', 'color' ], facet_match: { brand: 'any', color: 'any' } } );
	} );

	it( 'sends an emptied list, which clears it', () => {
		expect( toPayload( { ...read, excluded_popular_terms: [] }, read ) ).toEqual( { excluded_popular_terms: [] } );
	} );

	it( 'sends everything when it is not told what the tab read', () => {
		expect( toPayload( read ) ).toHaveProperty( 'synonyms' );
		expect( toPayload( read ) ).toHaveProperty( 'searchable_fields' );
	} );
} );

describe( 'toPayload', () => {
	/**
	 * `available` and `status` are reported by the server and ignored on write -
	 * sending them back would be claiming state we do not own.
	 */
	it( 'writes back only the enabled flag of each switch', () => {
		const payload = toPayload( {
			facet_fields: [ 'brand' ],
			features: {
				ai_search: { available: true, enabled: true, status: 'ready' },
				visual_tagging: { available: false, enabled: false, status: '' },
				visual_search: { available: true, enabled: true, status: '' },
				personalization: { available: true, enabled: true, status: '' },
			},
		} );

		expect( payload.features ).toEqual( {
			ai_search: { enabled: true },
			visual_tagging: { enabled: false },
			visual_search: { enabled: true },
			personalization: { enabled: true },
		} );
		expect( payload.facet_fields ).toEqual( [ 'brand' ] );
	} );

	it( 'still sends every switch when the config has none', () => {
		expect( toPayload( {} ).features ).toEqual( {
			ai_search: { enabled: false },
			visual_tagging: { enabled: false },
			visual_search: { enabled: false },
			personalization: { enabled: false },
		} );
	} );

	/**
	 * The inputs hold '' for an unset category trigger, but the API's own shape
	 * for "not set" is null - and both halves only mean anything together.
	 */
	it( 'sends an unset category trigger as null, not an empty string', () => {
		const [ rule ] = toPayload( {
			merchandising: [ { query: 'winter', filter_field: '', filter_value: '', pinned: [], hidden: [], banner: '' } ],
		} ).merchandising;

		expect( rule.filter_field ).toBeNull();
		expect( rule.filter_value ).toBeNull();
	} );

	it( 'sends a complete category trigger through, trimmed', () => {
		const [ rule ] = toPayload( {
			merchandising: [ { query: '', filter_field: ' category ', filter_value: ' shoes ', pinned: [], hidden: [] } ],
		} ).merchandising;

		expect( rule.filter_field ).toBe( 'category' );
		expect( rule.filter_value ).toBe( 'shoes' );
	} );

	/** One half alone cannot fire a rule, so it is not a trigger at all. */
	it( 'drops a half-written category trigger rather than sending one side', () => {
		const [ rule ] = toPayload( {
			merchandising: [ { query: 'winter', filter_field: 'category', filter_value: '', pinned: [], hidden: [] } ],
		} ).merchandising;

		expect( rule.filter_field ).toBeNull();
		expect( rule.filter_value ).toBeNull();
	} );

	/**
	 * The API drops an empty redirect row silently instead of rejecting it, so a
	 * form that sent one would show a row that vanished on the next read.
	 */
	it( 'drops an untouched redirect row before sending', () => {
		expect(
			toPayload( { redirects: [ { query: 'bf', url: '/bf' }, { query: '', url: '' } ] } ).redirects
		).toEqual( [ { query: 'bf', url: '/bf' } ] );
	} );

	it( 'sends an empty redirect list rather than omitting the key, so deleting the last rule sticks', () => {
		expect( toPayload( { redirects: [] } ).redirects ).toEqual( [] );
	} );

	it( 'drops a redirect that names a term but no destination', () => {
		expect( toPayload( { redirects: [ { query: 'bf', url: '' } ] } ).redirects ).toEqual( [] );
	} );

	/**
	 * Re-enabling a feature the plan no longer includes is a 422 on that field -
	 * and since the tab re-sends its whole state, it would reject every
	 * unrelated edit until someone worked out which switch was at fault.
	 */
	it( 'does not try to re-enable a switch the plan no longer includes', () => {
		const payload = toPayload( {
			features: {
				ai_search: { available: false, enabled: true },
				visual_search: { available: true, enabled: true },
			},
		} );

		expect( payload.features.ai_search ).toEqual( { enabled: false } );
		expect( payload.features.visual_search ).toEqual( { enabled: true } );
	} );

	/** A feature the server said nothing about is sent as the tab has it. */
	it( 'still sends a switch whose availability is unknown', () => {
		expect( toPayload( { features: { personalization: { enabled: true } } } ).features.personalization )
			.toEqual( { enabled: true } );
	} );
} );

describe( 'listError', () => {
	/**
	 * The live API rejects an oversized id with the key
	 * `merchandising.0.pinned.0` - per entry, while the UI edits the whole list
	 * as one field. Without collecting these the message would never be shown.
	 */
	it( 'collects a per-entry error onto the field that owns the list', () => {
		expect(
			listError( { 'merchandising.0.pinned.0': [ 'The id is too long.' ] }, 'merchandising', 0, 'pinned' )
		).toBe( 'The id is too long.' );
	} );

	it( 'joins errors from several entries of the same list', () => {
		expect(
			listError(
				{
					'merchandising.1.hidden.0': [ 'First bad.' ],
					'merchandising.1.hidden.3': [ 'Second bad.' ],
				},
				'merchandising',
				1,
				'hidden'
			)
		).toBe( 'First bad. Second bad.' );
	} );

	it( 'also reads an error on the list itself', () => {
		expect(
			listError( { 'merchandising.0.pinned': [ 'Too many ids.' ] }, 'merchandising', 0, 'pinned' )
		).toBe( 'Too many ids.' );
	} );

	/** A neighbouring rule's error must not leak onto this field. */
	it( 'ignores other rules and other columns', () => {
		const errors = {
			'merchandising.1.pinned.0': [ 'Other rule.' ],
			'merchandising.0.hidden.0': [ 'Other column.' ],
		};

		expect( listError( errors, 'merchandising', 0, 'pinned' ) ).toBeUndefined();
	} );

	it( 'is undefined when nothing failed', () => {
		expect( listError( {}, 'merchandising', 0, 'pinned' ) ).toBeUndefined();
		expect( listError( undefined, 'merchandising', 0, 'pinned' ) ).toBeUndefined();
	} );
} );

describe( 'document id lists', () => {
	it( 'round-trips through the comma-separated input', () => {
		expect( textToIds( idsToText( [ 'p-1', 'p-2' ] ) ) ).toEqual( [ 'p-1', 'p-2' ] );
	} );

	it( 'drops blanks and surrounding whitespace', () => {
		expect( textToIds( ' p-1 , , p-2 ,' ) ).toEqual( [ 'p-1', 'p-2' ] );
	} );

	it( 'reads an empty field as no ids', () => {
		expect( textToIds( '' ) ).toEqual( [] );
	} );
} );

/**
 * A boost is matched against the type the documents carry. Keyed by the post
 * type, the tester's boost of 100 for posts asked for "post" while posts were
 * "artikel", and moved nothing.
 */
describe( 'enabledTypeLabels', () => {
	it( 'names each indexed content type by the type its documents carry', () => {
		const catalog = {
			post_types: [
				{ slug: 'post', label: 'Beiträge', config: { enabled: true, type: 'artikel' } },
				{ slug: 'page', label: 'Seiten', config: { enabled: true, type: 'page' } },
				{ slug: 'ratgeber', label: 'Ratgeber', config: { enabled: true } },
				{ slug: 'faq', label: 'FAQ', config: { enabled: false, type: 'faq' } },
			],
		};

		expect( enabledTypeLabels( catalog ) ).toEqual( { artikel: 'Beiträge', page: 'Seiten', ratgeber: 'Ratgeber' } );
		expect( enabledTypeLabels( null ) ).toEqual( {} );
	} );
} );

describe( 'repeatsRedirect', () => {
	it( 'flags a later redirect whose term an earlier one has, whatever its capitals and spaces', () => {
		const rules = [ { query: 'versand' }, { query: 'Retoure' }, { query: 'VERSAND ' }, { query: '' }, { query: '' } ];

		expect( repeatsRedirect( rules, 0 ) ).toBe( false );
		expect( repeatsRedirect( rules, 1 ) ).toBe( false );
		expect( repeatsRedirect( rules, 2 ) ).toBe( true );
		expect( repeatsRedirect( rules, 4 ) ).toBe( false );
	} );

	// Searcio follows the first redirect that matches the term and the page's language.
	it( 'flags it only where an earlier one is followed in its language too', () => {
		const rules = [
			{ query: 'versand', lang: 'de' },
			{ query: 'versand', lang: 'en' },
			{ query: 'versand', lang: 'de' },
			{ query: 'retoure', lang: null },
			{ query: 'retoure', lang: 'en' },
			{ query: 'agb', lang: 'de' },
			{ query: 'agb', lang: null },
		];

		expect( repeatsRedirect( rules, 1 ) ).toBe( false );
		expect( repeatsRedirect( rules, 2 ) ).toBe( true );
		expect( repeatsRedirect( rules, 4 ) ).toBe( true );
		expect( repeatsRedirect( rules, 6 ) ).toBe( false );
	} );
} );

describe( 'a redirect\'s language', () => {
	// A save from the tab took the language off every redirect given one in the dashboard.
	it( 'keeps the language Searcio returns, and sends it only for one language', () => {
		const read = normalizeConfig( {
			redirects: [
				{ query: 'versand', url: '/de/versand', lang: 'de' },
				{ query: 'shipping', url: '/en/shipping', lang: null },
				{ query: 'agb', url: '/agb' },
			],
		} );

		expect( read.redirects.map( ( rule ) => rule.lang ) ).toEqual( [ 'de', null, null ] );
		expect( toPayload( { ...read, redirects: [ ...read.redirects, { query: 'faq', url: '/faq', lang: 'en' } ] }, read ).redirects ).toEqual( [
			{ query: 'versand', url: '/de/versand', lang: 'de' },
			{ query: 'shipping', url: '/en/shipping' },
			{ query: 'agb', url: '/agb' },
			{ query: 'faq', url: '/faq', lang: 'en' },
		] );
	} );
} );

describe( 'changedSince', () => {
	const persisted = {
		type_boosts: [ { type: 'product', boost: 1 }, { type: 'ratgeber', boost: 1 } ],
		searchable_fields: [ { field: 'title', weight: 5 }, { field: 'content', weight: 1 } ],
		synonyms: [],
		features: { visual_search: { enabled: false }, assistant: { enabled: true } },
	};

	// A boost changed in the Searcio dashboard went back to 1 when the tab
	// saved its boosts, read ten minutes before.
	it( 'names a section the save would write that changed since the tab read it', () => {
		const live = { ...persisted, type_boosts: [ { type: 'product', boost: 1 }, { type: 'ratgeber', boost: 3 } ] };

		expect( changedSince( { type_boosts: persisted.type_boosts }, live, persisted ) ).toEqual( [ 'type_boosts' ] );
	} );

	it( 'lets through a save of sections nobody changed meanwhile', () => {
		const live = { ...persisted, searchable_fields: [ { field: 'title', weight: 5 }, { field: 'content', weight: 2 } ] };

		expect( changedSince( { synonyms: [ [ 'hoodie', 'sweater' ] ] }, live, persisted ) ).toEqual( [] );
	} );

	it( 'looks only at the feature switches the save sends', () => {
		const live = { ...persisted, features: { visual_search: { enabled: false }, assistant: { enabled: false } } };

		expect( changedSince( { features: { visual_search: { enabled: true } } }, live, persisted ) ).toEqual( [] );
		expect( changedSince( { features: { assistant: { enabled: true } } }, live, persisted ) ).toEqual( [ 'features' ] );
	} );
} );
