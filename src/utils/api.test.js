/**
 * `api.js` captures `window.searcioFrontend` and keeps its
 * request cache in module-level state, so each test resets the module
 * registry and re-requires it fresh rather than sharing one import across
 * the file (real cache state would otherwise leak between tests).
 */

const setConfig = ( overrides = {} ) => {
	window.searcioFrontend = {
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
	delete window.searcioFrontend;
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
	it( 'delegate to the live config values from window.searcioFrontend', () => {
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

	it( 'sends numeric bounds the way the API takes them: range[field]=min:max', async () => {
		const api = loadApi();

		await api.search( 'shirt', { ranges: { price: '10:50', rating: '4:' }, page: 2 } );

		const [ url ] = global.fetch.mock.calls[ 0 ];

		expect( url ).toContain( 'range%5Bprice%5D=10%3A50' );
		expect( url ).toContain( 'range%5Brating%5D=4%3A' );
		expect( url ).toContain( 'page=2' );
	} );

	it( 'sends each group of required words as its own keywords[] entry', async () => {
		const api = loadApi();

		await api.search( '', { keywords: [ 'Panzerriegel, Zusatzschloss', '', 'ABUS' ] } );

		const [ url ] = global.fetch.mock.calls[ 0 ];

		expect( url ).toContain( 'keywords%5B0%5D=Panzerriegel%2C+Zusatzschloss' );
		expect( url ).toContain( 'keywords%5B1%5D=ABUS' );
		expect( url ).not.toContain( 'keywords%5B2%5D' );
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

	// A German page suggested the English titles too: suggestions are filtered
	// by the page's language, as a search is.
	it( 'suggests in the language of the page on a multilingual site', async () => {
		setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'de' } );
		let api = loadApi();

		await api.suggest( 'jac' );
		expect( new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams.get( 'filter[lang]' ) ).toBe( 'de' );

		global.fetch.mockClear();
		setConfig( {} );
		api = loadApi();

		await api.suggest( 'jac' );
		expect( new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams.has( 'filter[lang]' ) ).toBe( false );
	} );
} );

describe( 'trackClick', () => {
	it( 'beacons the click endpoint with the search id, document id and position', () => {
		const sendBeacon = jest.fn().mockReturnValue( true );
		global.navigator.sendBeacon = sendBeacon;

		const api = loadApi();

		api.trackClick( 'search-123', 'p-1', 3 );

		expect( sendBeacon ).toHaveBeenCalledTimes( 1 );

		const [ url, body ] = sendBeacon.mock.calls[ 0 ];

		expect( url ).toContain( '/search/click?' );
		expect( url ).toContain( 'key=sk_test' );
		expect( Object.fromEntries( body ) ).toEqual( {
			search_id: 'search-123',
			document_id: 'p-1',
			position: '3',
		} );
	} );

	/**
	 * A JSON body would make this a non-safelisted request, so the browser would
	 * preflight it - and the API answers preflights without CORS headers, which
	 * silently dropped every click. Form encoding keeps the beacon safelisted.
	 */
	it( 'sends a form-encoded body so the beacon never needs a CORS preflight', () => {
		const sendBeacon = jest.fn().mockReturnValue( true );
		global.navigator.sendBeacon = sendBeacon;

		const api = loadApi();

		api.trackClick( 'search-123', 'p-1', 1 );

		const [ , body ] = sendBeacon.mock.calls[ 0 ];

		expect( body ).toBeInstanceOf( URLSearchParams );
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

	/** It takes no language, so on a German and English shop it named products in both. */
	it( "keeps the products in the page's language on a multilingual site", async () => {
		setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'en' } );
		global.fetch.mockResolvedValue( jsonResponse( { reply: 'Two jackets', products: [ { id: 'p-en', source: { lang: 'en' } }, { id: 'p-de', source: { lang: 'de' } }, { id: 'post-1', source: {} } ] } ) );
		const api = loadApi();

		const result = await api.askAssistant( 'a rain jacket' );

		expect( result.products.map( ( hit ) => hit.id ) ).toEqual( [ 'p-en', 'post-1' ] );
		expect( result.reply ).toBe( 'Two jackets' );
	} );
} );

describe( 'visualSearch', () => {
	it( 'uploads the photo as multipart with the key in the query string', async () => {
		global.fetch.mockResolvedValue(
			jsonResponse( { query: 'red silk dress', tags: [ 'red', 'silk' ], total: 1, hits: [ { id: 'p-1' } ] } )
		);
		const api = loadApi();
		const photo = new File( [ 'x' ], 'dress.jpg', { type: 'image/jpeg' } );

		const result = await api.visualSearch( photo );

		const [ url, options ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/search/visual?' );
		// A preflight carries no custom headers, so the credential has to be in
		// the URL for the API to resolve the site and answer CORS.
		expect( url ).toContain( 'key=sk_test' );
		expect( options.method ).toBe( 'POST' );
		expect( options.body ).toBeInstanceOf( FormData );
		expect( options.body.get( 'photo' ) ).toBe( photo );
		// Never a Content-Type of our own: the boundary is the browser's to set.
		expect( options.headers ).toBeUndefined();
		expect( result.tags ).toEqual( [ 'red', 'silk' ] );
	} );

	it( 'throws an error carrying the HTTP status so callers can tell 403 from 422 from 429', async () => {
		const api = loadApi();

		for ( const status of [ 403, 422, 429 ] ) {
			global.fetch.mockResolvedValue( jsonResponse( {}, false, status ) );

			await expect(
				api.visualSearch( new File( [ 'x' ], 'p.jpg', { type: 'image/jpeg' } ) )
			).rejects.toMatchObject( { status } );
		}
	} );

	/** A photo with nothing recognisable in it is a success, not an error. */
	it( 'passes an empty result through rather than treating it as a failure', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { query: null, tags: [], total: 0, hits: [], facets: [] } ) );
		const api = loadApi();

		const result = await api.visualSearch( new File( [ 'x' ], 'blur.jpg', { type: 'image/jpeg' } ) );

		expect( result.hits ).toEqual( [] );
		expect( result.tags ).toEqual( [] );
	} );

	it( "keeps the hits in the page's language on a multilingual site", async () => {
		setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'de' } );
		global.fetch.mockResolvedValue( jsonResponse( { tags: [ 'headphones' ], total: 3, hits: [ { id: 'p-en', source: { lang: 'en' } }, { id: 'p-de', source: { lang: 'de' } }, { id: 'post-1', source: {} } ] } ) );
		const api = loadApi();

		const result = await api.visualSearch( new File( [ 'x' ], 'p.jpg', { type: 'image/jpeg' } ) );

		expect( result.hits.map( ( hit ) => hit.id ) ).toEqual( [ 'p-de', 'post-1' ] );
		expect( result.tags ).toEqual( [ 'headphones' ] );
	} );

	it( 'keeps every hit on a single-language site', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { tags: [], total: 3, hits: [ { id: 'p-en', source: { lang: 'en' } }, { id: 'p-de', source: { lang: 'de' } }, { id: 'post-1', source: {} } ] } ) );
		const api = loadApi();

		const result = await api.visualSearch( new File( [ 'x' ], 'p.jpg', { type: 'image/jpeg' } ) );

		expect( result.hits ).toHaveLength( 3 );
	} );
} );

describe( 'fetchQuizzes', () => {
	it( 'requests the quiz list with the search key', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { quizzes: [ { id: 4, questions: [] } ] } ) );
		const api = loadApi();

		const result = await api.fetchQuizzes();

		const [ url ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/quizzes?' );
		expect( url ).toContain( 'key=sk_test' );
		expect( result.quizzes ).toHaveLength( 1 );
	} );

	/**
	 * The whole question graph arrives in one response and is not metered, so
	 * the widget must not re-fetch it per question.
	 */
	it( 'serves a repeat call from the cache instead of hitting the network again', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { quizzes: [] } ) );
		const api = loadApi();

		await api.fetchQuizzes();
		await api.fetchQuizzes();

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'fetchSimilar', () => {
	it( 'asks for more like a given product, with the search key', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { similar: [ { id: 'p-2' } ] } ) );
		const api = loadApi();

		const result = await api.fetchSimilar( 'product-1', { limit: 4 } );

		const [ url ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/search/similar?' );
		expect( url ).toContain( 'id=product-1' );
		expect( url ).toContain( 'limit=4' );
		expect( url ).toContain( 'key=sk_test' );
		expect( result.similar ).toHaveLength( 1 );
	} );

	it( 'defaults to six', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { similar: [] } ) );
		const api = loadApi();

		await api.fetchSimilar( 'product-1' );

		expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toContain( 'limit=6' );
	} );

	/**
	 * A site without AI search answers with an empty list rather than an error,
	 * so the caller can hide the row instead of handling a failure.
	 */
	it( 'passes an empty list through rather than treating it as a failure', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { similar: [] } ) );
		const api = loadApi();

		await expect( api.fetchSimilar( 'product-1' ) ).resolves.toEqual( { similar: [] } );
	} );

	it( 'serves a repeat call from the cache: it is not metered and changes only with the catalogue', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { similar: [] } ) );
		const api = loadApi();

		await api.fetchSimilar( 'product-1' );
		await api.fetchSimilar( 'product-1' );

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * A product's nearest neighbour is its own translation: on the English page
	 * of a rain jacket the row opened with the same jacket in German.
	 */
	it( "asks for one row per language and keeps the page's language on a multilingual site", async () => {
		setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'en' } );
		const similar = [ 'de', 'en', 'de', 'en', 'en', 'de', 'en', 'en' ].map( ( lang, index ) => ( { id: `p-${ index }`, source: { lang } } ) );
		global.fetch.mockResolvedValue( jsonResponse( { search_id: 's-1', similar } ) );
		const api = loadApi();

		const result = await api.fetchSimilar( 'product-1', { limit: 4 } );

		expect( new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams.get( 'limit' ) ).toBe( '8' );
		expect( result.similar.map( ( hit ) => hit.id ) ).toEqual( [ 'p-1', 'p-3', 'p-4', 'p-6' ] );
		expect( result.search_id ).toBe( 's-1' );
	} );

	it( 'never asks for more than the service answers', async () => {
		setConfig( { enabledLanguages: [ 'de', 'en', 'fr' ], currentLang: 'fr' } );
		global.fetch.mockResolvedValue( jsonResponse( { similar: [] } ) );
		const api = loadApi();

		await api.fetchSimilar( 'product-1', { limit: 8 } );

		expect( new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams.get( 'limit' ) ).toBe( '20' );
	} );
} );

describe( 'search analytics hints', () => {
	const params = ( call = 0 ) => new URL( global.fetch.mock.calls[ call ][ 0 ] ).searchParams;

	afterEach( () => {
		delete window.elementorFrontend;
	} );

	it( 'marks a search as you type live, and gives it no origin', async () => {
		const api = loadApi();

		await api.search( 'jack', { live: true, origin: 'typed', surface: 'overlay' } );

		expect( params().get( 'live' ) ).toBe( '1' );
		expect( params().has( 'origin' ) ).toBe( false );
		expect( params().get( 'surface' ) ).toBe( 'overlay' );
	} );

	it( 'says how a settled search was started, and nothing it does not know', async () => {
		const api = loadApi();

		await api.search( 'jacket', { origin: 'suggestion' } );
		await api.search( 'boots', { origin: 'carousel', surface: 'sidebar' } );

		expect( params( 0 ).get( 'origin' ) ).toBe( 'suggestion' );
		expect( params( 0 ).has( 'live' ) ).toBe( false );
		expect( params( 1 ).has( 'origin' ) ).toBe( false );
		expect( params( 1 ).has( 'surface' ) ).toBe( false );
	} );

	it.each( [ 'typed', 'suggestion', 'popular', 'recent', 'voice', 'filter' ] )( 'sends the origin %s', async ( origin ) => {
		const api = loadApi();

		await api.search( 'jacket', { origin } );

		expect( params().get( 'origin' ) ).toBe( origin );
	} );

	/**
	 * Only page one of a search with words in it is counted: a listing without
	 * them and "load more" carry neither hint, and say only where they are shown.
	 */
	it( 'leaves live and origin off a listing without words and off later pages', async () => {
		const api = loadApi();

		await api.search( '', { live: true, origin: 'filter', surface: 'highlights' } );
		await api.search( 'jacket', { live: true, origin: 'typed', surface: 'overlay', page: 2 } );

		expect( params( 0 ).has( 'live' ) ).toBe( false );
		expect( params( 0 ).has( 'origin' ) ).toBe( false );
		expect( params( 0 ).get( 'surface' ) ).toBe( 'highlights' );
		expect( params( 1 ).has( 'live' ) ).toBe( false );
		expect( params( 1 ).has( 'origin' ) ).toBe( false );
		expect( params( 1 ).get( 'surface' ) ).toBe( 'overlay' );
	} );

	it.each( [ 'overlay', 'highlights', 'category', 'quiz' ] )( 'sends the surface %s', async ( surface ) => {
		const api = loadApi();

		await api.search( '', { surface } );

		expect( params().get( 'surface' ) ).toBe( surface );
	} );

	/**
	 * Before, the settled search answered from the cache the live request for
	 * the same words had left, and never reached the service to be counted.
	 */
	it( 'sends a settled search after a live one for the same words', async () => {
		const api = loadApi();

		await api.search( 'jacket', { live: true, surface: 'overlay' } );
		await api.search( 'jacket', { origin: 'typed', surface: 'overlay' } );

		expect( global.fetch ).toHaveBeenCalledTimes( 2 );
		expect( params( 1 ).get( 'origin' ) ).toBe( 'typed' );
	} );

	it( 'sends none of the hints when it is told none', async () => {
		const api = loadApi();

		await api.search( 'jacket' );

		[ 'live', 'origin', 'surface', 'preview' ].forEach( ( hint ) => expect( params().has( hint ) ).toBe( false ) );
	} );

	it( 'marks every search and similar list of a page builder\'s editor as a preview', async () => {
		setConfig( { preview: true } );
		global.fetch.mockResolvedValue( jsonResponse( { hits: [], similar: [] } ) );
		const api = loadApi();

		await api.search( '', { surface: 'highlights' } );
		await api.search( 'jacket', { origin: 'typed' } );
		await api.fetchSimilar( 'product-1' );

		expect( params( 0 ).get( 'preview' ) ).toBe( '1' );
		expect( params( 1 ).get( 'preview' ) ).toBe( '1' );
		expect( params( 2 ).get( 'preview' ) ).toBe( '1' );
	} );

	it( 'takes Elementor\'s own word for its editor', async () => {
		window.elementorFrontend = { isEditMode: () => true };
		const api = loadApi();

		await api.search( 'jacket' );

		expect( params().get( 'preview' ) ).toBe( '1' );
	} );

	it( 'puts none of the hints on the requests that are not searches', async () => {
		setConfig( { preview: true } );
		global.fetch.mockResolvedValue( jsonResponse( {} ) );
		const api = loadApi();

		await api.suggest( 'jac' );
		await api.fetchPopularSearches();
		await api.fetchCardTemplates();
		await api.fetchStorefrontConfig();
		await api.fetchQuizzes();

		global.fetch.mock.calls.forEach( ( [ url ] ) => {
			[ 'live', 'origin', 'surface', 'preview' ].forEach( ( hint ) => expect( new URL( url ).searchParams.has( hint ) ).toBe( false ) );
		} );
	} );
} );

describe( 'filters whose values hold a comma', () => {
	it( 'sends a list as one filter[field][] per value, and a string as before', async () => {
		const api = loadApi();

		await api.search( '', { filters: { categories: [ 'Jacken, Mäntel & Strick', 'Herrenmode' ], color: 'Black,Navy' } } );

		const params = new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams;
		expect( params.getAll( 'filter[categories][]' ) ).toEqual( [ 'Jacken, Mäntel & Strick', 'Herrenmode' ] );
		expect( params.has( 'filter[categories]' ) ).toBe( false );
		expect( params.get( 'filter[color]' ) ).toBe( 'Black,Navy' );
	} );

	it( 'leaves an empty list out', async () => {
		const api = loadApi();

		await api.search( 'x', { filters: { categories: [] } } );

		expect( new URL( global.fetch.mock.calls[ 0 ][ 0 ] ).searchParams.has( 'filter[categories][]' ) ).toBe( false );
	} );
} );

/**
 * Quizzes, popular searches, photo search and the assistant each take the
 * page's language, so a German page is not offered the English quiz, English
 * searches or English products.
 */
describe( 'the page language on every request that takes one', () => {
	const multilingual = () => setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'de' } );
	const photo = () => new File( [ 'x' ], 'p.jpg', { type: 'image/jpeg' } );
	const lastUrl = () => new URL( global.fetch.mock.calls[ 0 ][ 0 ] );

	it( 'asks for the quizzes in the page\'s language', async () => {
		multilingual();
		global.fetch.mockResolvedValue( jsonResponse( { quizzes: [] } ) );

		await loadApi().fetchQuizzes();

		expect( lastUrl().searchParams.get( 'filter[lang]' ) ).toBe( 'de' );
	} );

	it( 'asks for the popular searches of the page\'s language', async () => {
		multilingual();
		global.fetch.mockResolvedValue( jsonResponse( { popular: [] } ) );

		await loadApi().fetchPopularSearches();

		expect( lastUrl().searchParams.get( 'filter[lang]' ) ).toBe( 'de' );
	} );

	it( 'searches by photo in the page\'s language', async () => {
		multilingual();
		global.fetch.mockResolvedValue( jsonResponse( { tags: [], hits: [] } ) );

		await loadApi().visualSearch( photo() );

		expect( lastUrl().searchParams.get( 'filter[lang]' ) ).toBe( 'de' );
	} );

	it( 'sends the page\'s language with an assistant message', async () => {
		multilingual();
		global.fetch.mockResolvedValue( jsonResponse( { reply: '', products: [] } ) );

		await loadApi().askAssistant( 'eine Regenjacke' );

		expect( JSON.parse( global.fetch.mock.calls[ 0 ][ 1 ].body ).filter ).toEqual( { lang: 'de' } );
	} );

	it( 'sends no language on a single-language site', async () => {
		global.fetch.mockResolvedValue( jsonResponse( { quizzes: [], popular: [], reply: '', products: [], tags: [], hits: [] } ) );
		const api = loadApi();

		await api.fetchQuizzes();
		await api.fetchPopularSearches();
		await api.visualSearch( photo() );
		await api.askAssistant( 'a rain jacket' );

		global.fetch.mock.calls.slice( 0, 3 ).forEach( ( [ url ] ) => expect( new URL( url ).searchParams.has( 'filter[lang]' ) ).toBe( false ) );
		expect( JSON.parse( global.fetch.mock.calls[ 3 ][ 1 ].body ) ).not.toHaveProperty( 'filter' );
	} );
} );

/**
 * `POST /assistant/stream` answers with server-sent events: the products once
 * the assistant has searched, then the reply in pieces, then `done`.
 */
describe( 'streamAssistant', () => {
	const { TextDecoder: NodeTextDecoder, TextEncoder } = require( 'util' );
	const encoder = new TextEncoder();

	beforeAll( () => {
		global.TextDecoder = global.TextDecoder || NodeTextDecoder;
	} );

	/** A 200 event stream whose body arrives in these chunks. */
	const streamResponse = ( chunks ) => {
		const queue = chunks.map( ( chunk ) => encoder.encode( chunk ) );

		return {
			ok: true,
			status: 200,
			headers: { get: () => 'text/event-stream; charset=utf-8' },
			body: {
				getReader: () => ( {
					read: () => Promise.resolve( queue.length > 0 ? { value: queue.shift(), done: false } : { value: undefined, done: true } ),
				} ),
			},
		};
	};

	const event = ( name, data ) => `event: ${ name }\ndata: ${ JSON.stringify( data ) }\n\n`;

	it( 'hands over the products and the pieces of the reply as they arrive', async () => {
		const whole = event( 'products', { products: [ { id: 'p-1' } ] } ) + event( 'delta', { text: 'Two ' } ) + event( 'delta', { text: 'jackets.' } ) + event( 'done', { reply: 'Two jackets.', products: [ { id: 'p-1' } ] } );
		// Cut anywhere, inside a line too: the reader keeps what is unfinished.
		global.fetch.mockResolvedValue( streamResponse( [ whole.slice( 0, 7 ), whole.slice( 7, 50 ), whole.slice( 50 ) ] ) );
		const onProducts = jest.fn();
		const pieces = [];

		const result = await loadApi().streamAssistant( 'a rain jacket', [], { onProducts, onDelta: ( text ) => pieces.push( text ) } );

		const [ url, options ] = global.fetch.mock.calls[ 0 ];
		expect( url ).toContain( '/assistant/stream?' );
		expect( options.headers.Accept ).toBe( 'text/event-stream' );
		expect( onProducts ).toHaveBeenCalledWith( [ { id: 'p-1' } ] );
		expect( pieces ).toEqual( [ 'Two ', 'jackets.' ] );
		expect( result ).toEqual( { reply: 'Two jackets.', products: [ { id: 'p-1' } ] } );
	} );

	it( 'asks POST /assistant instead when the service has no stream (404)', async () => {
		global.fetch
			.mockResolvedValueOnce( jsonResponse( {}, false, 404 ) )
			.mockResolvedValueOnce( jsonResponse( { reply: 'Here you go', products: [] } ) );

		const result = await loadApi().streamAssistant( 'a rain jacket' );

		expect( global.fetch.mock.calls[ 1 ][ 0 ] ).toMatch( /\/assistant\?/ );
		expect( result.reply ).toBe( 'Here you go' );
	} );

	it( 'throws with the status of a refusal, which comes before the stream', async () => {
		global.fetch.mockResolvedValue( jsonResponse( {}, false, 429 ) );

		await expect( loadApi().streamAssistant( 'x' ) ).rejects.toMatchObject( { status: 429 } );
	} );

	it( 'throws when the turn fails part-way, or the stream ends before it does', async () => {
		global.fetch.mockResolvedValueOnce( streamResponse( [ event( 'delta', { text: 'Two' } ) + event( 'error', { error: 'Provider unreachable' } ) ] ) );
		await expect( loadApi().streamAssistant( 'x' ) ).rejects.toThrow( 'failed' );

		global.fetch.mockResolvedValueOnce( streamResponse( [ event( 'delta', { text: 'Two' } ) ] ) );
		await expect( loadApi().streamAssistant( 'x' ) ).rejects.toThrow( 'ended before' );
	} );

	it( 'reads an answer that is not a stream as a whole reply', async () => {
		global.fetch.mockResolvedValue( { ...jsonResponse( { reply: 'Whole', products: [ { id: 'p-2' } ] } ), headers: { get: () => 'application/json' } } );

		await expect( loadApi().streamAssistant( 'x' ) ).resolves.toEqual( { reply: 'Whole', products: [ { id: 'p-2' } ] } );
	} );

	it( 'sends the page\'s language and keeps the products to it', async () => {
		setConfig( { enabledLanguages: [ 'de', 'en' ], currentLang: 'en' } );
		const products = [ { id: 'p-en', source: { lang: 'en' } }, { id: 'p-de', source: { lang: 'de' } } ];
		global.fetch.mockResolvedValue( streamResponse( [ event( 'products', { products } ) + event( 'done', { reply: 'One.', products } ) ] ) );
		const onProducts = jest.fn();

		const result = await loadApi().streamAssistant( 'a rain jacket', [], { onProducts } );

		expect( JSON.parse( global.fetch.mock.calls[ 0 ][ 1 ].body ).filter ).toEqual( { lang: 'en' } );
		expect( onProducts.mock.calls[ 0 ][ 0 ].map( ( hit ) => hit.id ) ).toEqual( [ 'p-en' ] );
		expect( result.products.map( ( hit ) => hit.id ) ).toEqual( [ 'p-en' ] );
	} );
} );
