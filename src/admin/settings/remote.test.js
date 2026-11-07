/**
 * A tab opened again shows what the screen read before, and a save forgets
 * what it changed.
 */
import apiFetch from '@wordpress/api-fetch';

import { forget, forgetAll, readOnce } from './remote';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

beforeEach( () => {
	forgetAll();
	apiFetch.mockReset();
	apiFetch.mockImplementation( ( { path } ) => Promise.resolve( { path } ) );
} );

describe( 'readOnce', () => {
	it( 'asks the server once for the same read', async () => {
		const first = await readOnce( { path: '/searcio/v1/search-config' } );
		const second = await readOnce( { path: '/searcio/v1/search-config' } );

		expect( first ).toEqual( second );
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'shares one request between two that ask at the same time', async () => {
		await Promise.all( [ readOnce( { path: '/searcio/v1/indexing/config' } ), readOnce( { path: '/searcio/v1/indexing/config' } ) ] );

		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps a read sent as POST apart from a GET of the same path', async () => {
		await readOnce( { path: '/searcio/v1/connection/test', method: 'POST' } );
		await readOnce( { path: '/searcio/v1/connection/test' } );

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'asks again after a failure', async () => {
		apiFetch.mockImplementationOnce( () => Promise.reject( new Error( 'offline' ) ) );

		await expect( readOnce( { path: '/searcio/v1/placement' } ) ).rejects.toThrow( 'offline' );
		await readOnce( { path: '/searcio/v1/placement' } );

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'asks again once an answer is five minutes old', async () => {
		const now = jest.spyOn( Date, 'now' ).mockReturnValue( 1000 );

		await readOnce( { path: '/searcio/v1/quizzes' } );
		now.mockReturnValue( 1000 + 5 * 60 * 1000 );
		await readOnce( { path: '/searcio/v1/quizzes' } );

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
		now.mockRestore();
	} );
} );

describe( 'forget', () => {
	it( 'forgets the reads under a path, and only those', async () => {
		await readOnce( { path: '/searcio/v1/quizzes?page=1' } );
		await readOnce( { path: '/searcio/v1/quizzes/facet-values' } );
		await readOnce( { path: '/searcio/v1/search-config' } );

		forget( '/searcio/v1/quizzes' );

		await readOnce( { path: '/searcio/v1/quizzes?page=1' } );
		await readOnce( { path: '/searcio/v1/quizzes/facet-values' } );
		await readOnce( { path: '/searcio/v1/search-config' } );

		expect( apiFetch ).toHaveBeenCalledTimes( 5 );
	} );
} );
