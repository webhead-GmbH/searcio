import { rememberCapabilities, rememberedCapabilities } from './capabilities';

describe( 'remembered capabilities', () => {
	beforeEach( () => window.sessionStorage.clear() );

	it( 'are none before the site has answered', () => {
		expect( rememberedCapabilities( 'sk_one' ) ).toEqual( {} );
	} );

	it( 'keep what the site answered, as booleans and nothing else', () => {
		rememberCapabilities( 'sk_one', { assistant: 1, quiz: false, visual_search: true, extra: 'x' } );

		expect( rememberedCapabilities( 'sk_one' ) ).toEqual( { assistant: true, quiz: false, visual_search: true, semantic_search: false } );
	} );

	it( 'are kept apart for two sites on one origin', () => {
		rememberCapabilities( 'sk_one', { assistant: true } );

		expect( rememberedCapabilities( 'sk_two' ) ).toEqual( {} );
	} );

	it( 'read as none when what is stored is not an object', () => {
		window.sessionStorage.setItem( 'searcio.capabilities.sk_one', '{not json' );

		expect( rememberedCapabilities( 'sk_one' ) ).toEqual( {} );
	} );
} );
