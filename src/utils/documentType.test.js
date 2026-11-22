/**
 * The type a block, a shortcode, a widget or a placement restricts the search
 * to is a post type; the index knows the type its documents were sent as.
 */
jest.mock( './api', () => ( { getConfig: () => ( {} ) } ) );

// eslint-disable-next-line import/first -- must follow the jest.mock() call above.
import { documentType, postTypeOf } from './documentType';

describe( 'documentType', () => {
	const map = { post: 'artikel', ratgeber: 'anleitung', page: 'page' };

	it( 'names the type a post type is indexed as', () => {
		expect( documentType( 'post', map ) ).toBe( 'artikel' );
		expect( documentType( 'ratgeber', map ) ).toBe( 'anleitung' );
	} );

	it( 'keeps a type it does not know, and nothing for no type', () => {
		expect( documentType( 'artikel', map ) ).toBe( 'artikel' );
		expect( documentType( '', map ) ).toBe( '' );
		expect( documentType( undefined, map ) ).toBe( '' );
		expect( documentType( 'post', [] ) ).toBe( 'post' );
		expect( documentType( 'constructor', map ) ).toBe( 'constructor' );
	} );
} );

describe( 'postTypeOf', () => {
	it( 'reads the post type from a document id', () => {
		expect( postTypeOf( { id: 'product-12' } ) ).toBe( 'product' );
		expect( postTypeOf( { id: 'e-landing-page-7' } ) ).toBe( 'e-landing-page' );
	} );

	it( 'has none for an id without a post id', () => {
		expect( postTypeOf( { id: 'custom' } ) ).toBe( '' );
		expect( postTypeOf( { id: 'a-b' } ) ).toBe( '' );
		expect( postTypeOf( {} ) ).toBe( '' );
	} );
} );
