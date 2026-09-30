import { isRedirect, redirectTarget } from './redirect';

describe( 'isRedirect', () => {
	it( 'recognises a redirect response', () => {
		expect( isRedirect( { query: 'black friday', redirect: 'https://example.com/bf' } ) ).toBe( true );
	} );

	it( 'does not mistake a zero-result search for a redirect', () => {
		expect( isRedirect( { query: 'nothing', total: 0, hits: [], facets: {} } ) ).toBe( false );
	} );

	it( 'ignores an empty or non-string redirect', () => {
		expect( isRedirect( { redirect: '' } ) ).toBe( false );
		expect( isRedirect( { redirect: null } ) ).toBe( false );
		expect( isRedirect( undefined ) ).toBe( false );
	} );
} );

describe( 'redirectTarget', () => {
	it( 'accepts the three documented forms', () => {
		expect( redirectTarget( { redirect: 'https://example.com/black-friday' } ) ).toBe(
			'https://example.com/black-friday'
		);
		expect( redirectTarget( { redirect: 'http://example.com/bf' } ) ).toBe( 'http://example.com/bf' );
		expect( redirectTarget( { redirect: '/black-friday' } ) ).toBe( '/black-friday' );
	} );

	it( 'trims surrounding whitespace', () => {
		expect( redirectTarget( { redirect: '  /sale  ' } ) ).toBe( '/sale' );
	} );

	it( 'refuses a scheme that would execute in the page', () => {
		expect( redirectTarget( { redirect: 'javascript:alert(1)' } ) ).toBe( '' );
		expect( redirectTarget( { redirect: 'JavaScript:alert(1)' } ) ).toBe( '' );
		expect( redirectTarget( { redirect: 'data:text/html,<script>alert(1)</script>' } ) ).toBe( '' );
		expect( redirectTarget( { redirect: 'vbscript:msgbox(1)' } ) ).toBe( '' );
	} );

	it( 'refuses a protocol-relative URL, which points at another host despite starting with a slash', () => {
		expect( redirectTarget( { redirect: '//evil.example/bf' } ) ).toBe( '' );
	} );

	it( 'returns nothing for a normal search response', () => {
		expect( redirectTarget( { hits: [], total: 0 } ) ).toBe( '' );
	} );
} );
