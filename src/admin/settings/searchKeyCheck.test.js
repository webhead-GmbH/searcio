/**
 * The search key is checked from the browser: Searcio refuses a search-key
 * request from the site's server, and a key works only on its own site.
 */
import { checkSearchKey } from './searchKeyCheck';

const CONNECTED = { ok: true, site_id: 7, search_key: { key: 'sk_live', endpoint: 'https://searcio.test/api/v1/' } };

const answering = ( status ) => jest.fn().mockResolvedValue( { status } );

describe( 'checkSearchKey', () => {
	it( 'asks the storefront config with the key, as a page of the site does', async () => {
		const request = answering( 200 );

		const result = await checkSearchKey( CONNECTED, request );

		expect( request ).toHaveBeenCalledWith( 'https://searcio.test/api/v1/storefront-config?key=sk_live', { credentials: 'omit' } );
		expect( result.search_key ).toEqual( { ok: true, message: '' } );
		expect( result.site_id ).toBe( 7 );
	} );

	// "falscher-key 123" was saved and the test said "Connected".
	it( 'says when Searcio does not know the key', async () => {
		const result = await checkSearchKey( CONNECTED, answering( 401 ) );

		expect( result.search_key.ok ).toBe( false );
		expect( result.search_key.message ).toContain( 'does not know the search key' );
	} );

	it( 'says when Searcio refuses the key from this address, as on a copy of the site', async () => {
		const result = await checkSearchKey( CONNECTED, answering( 403 ) );

		expect( result.search_key.ok ).toBe( false );
		expect( result.search_key.message ).toContain( 'only on the domain it was connected with' );
	} );

	it( 'says when no key is saved, without asking', async () => {
		const request = answering( 200 );

		const result = await checkSearchKey( { ...CONNECTED, search_key: { key: '', endpoint: 'https://searcio.test/api/v1' } }, request );

		expect( request ).not.toHaveBeenCalled();
		expect( result.search_key.message ).toContain( 'No search key is saved' );
	} );

	it( 'says nothing against the key when Searcio cannot be reached', async () => {
		const result = await checkSearchKey( CONNECTED, jest.fn().mockRejectedValue( new TypeError( 'Failed to fetch' ) ) );

		expect( result.search_key ).toEqual( { ok: true, message: '' } );
	} );

	it( 'leaves a failed test, and one without a key to check, as it is', async () => {
		const request = answering( 401 );
		const failed = { ok: false, message: 'Could not reach Searcio.' };
		const decided = { ok: true, search_key: { ok: false, message: 'Already said.' } };

		expect( await checkSearchKey( failed, request ) ).toBe( failed );
		expect( await checkSearchKey( decided, request ) ).toBe( decided );
		expect( await checkSearchKey( null, request ) ).toBeNull();
		expect( request ).not.toHaveBeenCalled();
	} );
} );
