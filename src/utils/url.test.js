import { leavesSite, safeHref } from './url';

describe( 'safeHref', () => {
	it.each( [
		[ 'https://example.test/size-guide', 'https://example.test/size-guide' ],
		[ 'HTTP://example.test/a', 'HTTP://example.test/a' ],
		[ '  https://example.test/padded  ', 'https://example.test/padded' ],
		[ '/sale/', '/sale/' ],
		[ '/', '/' ],
		[ '/search?q=a%20b#top', '/search?q=a%20b#top' ],
	] )( 'follows %s', ( value, href ) => {
		expect( safeHref( value ) ).toBe( href );
	} );

	it.each( [
		[ 'javascript:alert(1)' ],
		[ ' javascript:alert(1)' ],
		[ 'JaVaScRiPt:alert(1)' ],
		[ 'data:text/html,<script>alert(1)</script>' ],
		[ 'vbscript:msgbox(1)' ],
		[ 'mailto:someone@example.test' ],
		// Another host, in the clothes of a path on this one.
		[ '//evil.test/path' ],
		[ '/\\evil.test/path' ],
		// Neither an address nor a path from the root.
		[ 'sale' ],
		[ 'example.test/sale' ],
		[ '' ],
		[ null ],
		[ undefined ],
		[ 42 ],
	] )( 'does not follow %p', ( value ) => {
		expect( safeHref( value ) ).toBe( '' );
	} );
} );

describe( 'leavesSite', () => {
	it( 'keeps a path, and an address on this origin, on the site', () => {
		expect( leavesSite( '/sale/' ) ).toBe( false );
		expect( leavesSite( `${ window.location.origin }/sale/` ) ).toBe( false );
	} );

	it( 'knows another host, and another scheme of this one, for somewhere else', () => {
		expect( leavesSite( 'https://example.org/sale/' ) ).toBe( true );
		expect( leavesSite( `${ window.location.origin.replace( /^http:/, 'https:' ) }/sale/` ) )
			.toBe( 'https:' !== window.location.protocol );
	} );
} );
