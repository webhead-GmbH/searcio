import { currentLangFilter, inLanguage, isLanguageSupported } from './language';

describe( 'isLanguageSupported', () => {
	it( 'treats every language as supported when the site has not restricted any', () => {
		expect( isLanguageSupported( [], 'fr' ) ).toBe( true );
		expect( isLanguageSupported( [], '' ) ).toBe( true );
	} );

	it( 'is true when the current language is in the enabled set', () => {
		expect( isLanguageSupported( [ 'de', 'en' ], 'de' ) ).toBe( true );
	} );

	it( 'is false when the current language is not in the enabled set', () => {
		expect( isLanguageSupported( [ 'de', 'en' ], 'fr' ) ).toBe( false );
	} );
} );

describe( 'currentLangFilter', () => {
	it( 'is empty when the site has not restricted any language', () => {
		expect( currentLangFilter( [], 'de' ) ).toEqual( {} );
	} );

	it( 'is empty when there is no resolvable current language', () => {
		expect( currentLangFilter( [ 'de', 'en' ], '' ) ).toEqual( {} );
	} );

	it( 'is empty for an unsupported language rather than filtering on it', () => {
		expect( currentLangFilter( [ 'de', 'en' ], 'fr' ) ).toEqual( {} );
	} );

	it( 'filters on the current language when it is enabled', () => {
		expect( currentLangFilter( [ 'de', 'en' ], 'de' ) ).toEqual( { lang: 'de' } );
	} );
} );

describe( 'inLanguage', () => {
	const hits = [
		{ id: 'en', source: { lang: 'en' } },
		{ id: 'de', source: { lang: 'de' } },
		{ id: 'none', source: {} },
		{ id: 'empty', source: { lang: '' } },
	];

	it( 'keeps the hits in the language and those without one', () => {
		expect( inLanguage( hits, 'de' ).map( ( hit ) => hit.id ) ).toEqual( [ 'de', 'none', 'empty' ] );
	} );

	it( 'keeps every hit when there is no language to keep to', () => {
		expect( inLanguage( hits, '' ) ).toHaveLength( 4 );
		expect( inLanguage( hits ) ).toHaveLength( 4 );
	} );

	it( 'returns a new list and handles a missing one', () => {
		expect( inLanguage( hits ) ).not.toBe( hits );
		expect( inLanguage( undefined, 'de' ) ).toEqual( [] );
	} );
} );
