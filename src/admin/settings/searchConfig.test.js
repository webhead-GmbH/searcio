/**
 * The `/search-config` contract mapping. `features` and `merchandising` were
 * added to the API after this tab shipped, so these pin both the reading of a
 * full payload and the narrower shape the tab is allowed to write back.
 */

import {
	FEATURE_KEYS,
	idsToText,
	normalizeConfig,
	normalizeFeatures,
	normalizeMerchandising,
	textToIds,
	toPayload,
} from './searchConfig';

describe( 'normalizeFeatures', () => {
	it( 'reads every switch the API reports', () => {
		const features = normalizeFeatures( {
			ai_search: { available: true, enabled: true, status: 'ready' },
			visual_tagging: { available: true, enabled: false },
			personalization: { available: true, enabled: true },
		} );

		expect( features.ai_search ).toEqual( { available: true, enabled: true, status: 'ready' } );
		expect( features.visual_tagging ).toEqual( { available: true, enabled: false, status: '' } );
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
		).toEqual( [ { query: 'winter', pinned: [ 'p-1', 'p-2' ], hidden: [ 'p-9' ], banner: 'Sale' } ] );
	} );

	/** The API stores an empty banner as null; a text input cannot take that. */
	it( 'turns a null banner into an empty string', () => {
		expect( normalizeMerchandising( [ { query: '', pinned: [], hidden: [], banner: null } ] )[ 0 ].banner ).toBe( '' );
	} );

	it( 'fills in missing lists so a rule is always editable', () => {
		expect( normalizeMerchandising( [ {} ] )[ 0 ] ).toEqual( {
			query: '',
			pinned: [],
			hidden: [],
			banner: '',
		} );
	} );

	it( 'tolerates the key being absent', () => {
		expect( normalizeMerchandising( undefined ) ).toEqual( [] );
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
			features: { ai_search: { available: true, enabled: true, status: 'indexing' } },
		} );

		expect( config.searchable_fields ).toEqual( [ { field: 'title', weight: 5 } ] );
		expect( config.merchandising ).toHaveLength( 1 );
		expect( config.features.ai_search.status ).toBe( 'indexing' );
		expect( config.features.visual_tagging.available ).toBe( false );
	} );
} );

describe( 'toPayload', () => {
	/**
	 * `available` and `status` are reported by the server and ignored on write —
	 * sending them back would be claiming state we do not own.
	 */
	it( 'writes back only the enabled flag of each switch', () => {
		const payload = toPayload( {
			facet_fields: [ 'brand' ],
			features: {
				ai_search: { available: true, enabled: true, status: 'ready' },
				visual_tagging: { available: false, enabled: false, status: '' },
				personalization: { available: true, enabled: true, status: '' },
			},
		} );

		expect( payload.features ).toEqual( {
			ai_search: { enabled: true },
			visual_tagging: { enabled: false },
			personalization: { enabled: true },
		} );
		expect( payload.facet_fields ).toEqual( [ 'brand' ] );
	} );

	it( 'still sends every switch when the config has none', () => {
		expect( toPayload( {} ).features ).toEqual( {
			ai_search: { enabled: false },
			visual_tagging: { enabled: false },
			personalization: { enabled: false },
		} );
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
