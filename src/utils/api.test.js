/**
 * `api.js` captures `window.webheadSearchCloudFrontend` and keeps its
 * request cache in module-level state, so each test resets the module
 * registry and re-requires it fresh rather than sharing one import across
 * the file (real cache state would otherwise leak between tests).
 */

const setConfig = ( overrides = {} ) => {
	window.webheadSearchCloudFrontend = {
		endpoint: 'https://search-cloud.test/api/v1',
		searchKey: 'sk_test',
		enabledLanguages: [],
		currentLang: '',
		...overrides,
	};
};

const jsonResponse = ( body, ok = true, status = 200 ) => ( {
	ok,
	status,
	json: () => Promise.resolve( body ),
} );

const loadApi = () => {
	jest.resetModules();

	return require( './api' );
};

beforeEach( () => {
	jest.useFakeTimers( { doNotFake: [ 'queueMicrotask' ] } );
	setConfig();
	global.fetch = jest.fn().mockResolvedValue( jsonResponse( { hits: [] } ) );
} );

afterEach( () => {
	jest.useRealTimers();
	delete global.fetch;
	delete window.webheadSearchCloudFrontend;
} );

describe( 'isConfigured', () => {
	it( 'is true when both endpoint and searchKey are set', () => {
		const api = loadApi();

		expect( api.isConfigured() ).toBe( true );
	} );

	it( 'is false when either endpoint or searchKey is missing', () => {
		setConfig( { searchKey: '' } );
		expect( loadApi().isConfigured() ).toBe( false );

		setConfig( { endpoint: '' } );
		expect( loadApi().isConfigured() ).toBe( false );
	} );
} );

describe( 'isLanguageSupported / currentLangFilter', () => {
	it( 'delegate to the live config values from window.webheadSearchCloudFrontend', () => {
		setConfig( { enabledLanguages: [ 'de' ], currentLang: 'de' } );
		const api = loadApi();

		expect( api.isLanguageSupported() ).toBe( true );
		expect( api.currentLangFilter() ).toEqual( { lang: 'de' } );
	} );

	it( 'reflect an unsupported current language', () => {
		setConfig( { enabledLanguages: [ 'de' ], currentLang: 'en' } );
		const api = loadApi();

		expect( api.isLanguageSupported() ).toBe( false );
		expect( api.currentLangFilter() ).toEqual( {} );
	} );
} );

describe( 'search', () => {
	it( 'requests the search endpoint with the query, key, and defaults', async () => {
		const api = loadApi();

		await api.search( 'shirt' );

		const [ url, requestOptions ] = global.fetch.mock.calls[ 0 ];

		expect( url ).toContain( '/search?' );
		expect( url ).toContain( 'q=shirt' );
		expect( url ).toContain( 'page=1' );
		expect( url ).toContain( 'per_page=20' );
		expect( url ).toContain( 'key=sk_test' );
		expect( requestOptions ).toMatchObject( { method: 'GET', credentials: 'omit' } );
	} );

	it( 'only sends filter params that have a truthy value', async () => {
		const api = loadApi();

		await api.search( 'shirt', { filters: { category: 'shoes', color: '' } } );

		const [ url ] = global.fetch.mock.calls[ 0 ];

		expect( url ).toContain( 'filter%5Bcategory%5D=shoes' );
		expect( url ).not.toContain( 'filter%5Bcolor%5D' );
	} );

	it( 'throws when the response is not ok', async () => {
		global.fetch.mockResolvedValue( jsonResponse( {}, false, 500 ) );
		const api = loadApi();

		await expect( api.search( 'shirt' ) ).rejects.toThrow( '/search responded 500' );
	} );

	it( 'caches an identical request within the TTL, skipping a second fetch', async () => {
		const api = loadApi();

		await api.search( 'shirt' );
		await api.search( 'shirt' );

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'issues a fresh fetch once the cache TTL has elapsed', async () => {
		const api = loadApi();

		await api.search( 'shirt' );
		jest.advanceTimersByTime( 60001 );
		await api.search( 'shirt' );

		expect( global.fetch ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'treats a different query as a separate cache entry', async () => {
		const api = loadApi();

		await api.search( 'shirt' );
		await api.search( 'cap' );

		expect( global.fetch ).toHaveBeenCalledTimes( 2 );
	} );
} );

describe( 'suggest / fetchCardTemplates / fetchPopularSearches', () => {
	it( 'request their respective endpoints', async () => {
		const api = loadApi();

		await api.suggest( 'sh' );
		await api.fetchCardTemplates( 'product' );
		await api.fetchPopularSearches();

		const urls = global.fetch.mock.calls.map( ( call ) => call[ 0 ] );

		expect( urls[ 0 ] ).toContain( '/search/suggest?' );
		expect( urls[ 1 ] ).toContain( '/card-templates?' );
		expect( urls[ 2 ] ).toContain( '/search/popular?' );
	} );
} );
