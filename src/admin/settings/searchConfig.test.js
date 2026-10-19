/**
 * The `/search-config` contract mapping. `features` and `merchandising` were
 * added to the API after this tab shipped, so these pin both the reading of a
 * full payload and the narrower shape the tab is allowed to write back.
 */

import {
	FEATURE_KEYS,
	idsToText,
	isBlankRedirect,
	listError,
	normalizeConfig,
	normalizeFeatures,
	normalizeMerchandising,
	normalizeRedirects,
	textToIds,
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
		} ] );
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
			{ query: 'black friday', url: 'https://example.com/bf' },
		] );
	} );

	it( 'tolerates the key being absent on an older payload', () => {
		expect( normalizeRedirects( undefined ) ).toEqual( [] );
	} );

	it( 'fills in a half-written rule so both inputs stay editable', () => {
		expect( normalizeRedirects( [ { query: 'bf' } ] ) ).toEqual( [ { query: 'bf', url: '' } ] );
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
		expect( config.redirects ).toEqual( [ { query: 'black friday', url: '/bf' } ] );
		expect( config.features.ai_search.status ).toBe( 'indexing' );
		expect( config.features.visual_tagging.available ).toBe( false );
		expect( config.features.visual_search.available ).toBe( false );
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
