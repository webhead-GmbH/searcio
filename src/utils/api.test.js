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
	delete global.navigator.sendBeacon;
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

describe( 'trackClick', () => {
	it( 'beacons the click endpoint with the search id, document id and position', () => {
		const sendBeacon = jest.fn().mockReturnValue( true );
		global.navigator.sendBeacon = sendBeacon;

		// Capture what goes into the Blob (jsdom's Blob has no readable .text()).
		const RealBlob = global.Blob;
		const captured = [];
		global.Blob = jest.fn( ( parts ) => {
			captured.push( parts );
			return { parts };
		} );

		try {
			const api = loadApi();

			api.trackClick( 'search-123', 'p-1', 3 );

			expect( sendBeacon ).toHaveBeenCalledTimes( 1 );

			const [ url ] = sendBeacon.mock.calls[ 0 ];

			expect( url ).toContain( '/search/click?' );
			expect( url ).toContain( 'key=sk_test' );
			expect( JSON.parse( captured[ 0 ][ 0 ] ) ).toEqual( {
				search_id: 'search-123',
				document_id: 'p-1',
				position: 3,
			} );
		} finally {
			global.Blob = RealBlob;
		}
	} );

	it( 'does nothing without a search id or document id', () => {
		const sendBeacon = jest.fn();
		global.navigator.sendBeacon = sendBeacon;
		const api = loadApi();

		api.trackClick( '', 'p-1', 1 );
		api.trackClick( 'search-123', '', 1 );

		expect( sendBeacon ).not.toHaveBeenCalled();
	} );

	it( 'does nothing when the plugin is not configured', () => {
		const sendBeacon = jest.fn();
		global.navigator.sendBeacon = sendBeacon;
		setConfig( { searchKey: '' } );
		const api = loadApi();

		api.trackClick( 'search-123', 'p-1', 1 );

		expect( sendBeacon ).not.toHaveBeenCalled();
	} );
} );

describe( 'fetchStorefrontConfig', () => {
	it( 'requests the storefront-config endpoint with the key and returns capabilities', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { capabilities: { assistant: true } } ) );
		const api = loadApi();

		const config = await api.fetchStorefrontConfig();

		const [ url ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/storefront-config?' );
		expect( url ).toContain( 'key=sk_test' );
		expect( config.capabilities.assistant ).toBe( true );
	} );
} );

describe( 'askAssistant', () => {
	it( 'POSTs the message and history to the assistant endpoint and returns the reply and products', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { reply: 'Here you go', products: [ { id: 'p-1' } ] } ) );
		const api = loadApi();

		const result = await api.askAssistant( 'a warm jacket', [ { role: 'user', content: 'hi' } ] );

		const [ url, options ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/assistant?' );
		expect( url ).toContain( 'key=sk_test' );
		expect( options.method ).toBe( 'POST' );
		expect( JSON.parse( options.body ) ).toEqual( {
			message: 'a warm jacket',
			history: [ { role: 'user', content: 'hi' } ],
		} );
		expect( result.reply ).toBe( 'Here you go' );
		expect( result.products ).toHaveLength( 1 );
	} );

	it( 'throws an error carrying the HTTP status so callers can branch on 403/429/502', async () => {
		global.fetch.mockResolvedValue( jsonResponse( {}, false, 429 ) );
		const api = loadApi();

		await expect( api.askAssistant( 'x' ) ).rejects.toMatchObject( { status: 429 } );
	} );
} );
