import { currentLangFilter, isLanguageSupported } from './language';

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
