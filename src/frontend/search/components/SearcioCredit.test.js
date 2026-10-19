/**
 * The Searcio logo the search window ends with. The server decides whether it
 * is there (`credit` in the configuration); the component draws exactly what
 * it is told, and nothing without it.
 */
import { renderToString } from '@wordpress/element';

let mockConfig = {};

jest.mock( '../../../utils/api', () => ( { getConfig: () => mockConfig } ) );

const SearcioCredit = require( './SearcioCredit' ).default;

const render = () => renderToString( <SearcioCredit /> );

describe( 'SearcioCredit', () => {
	it( 'draws nothing when the configuration names no credit', () => {
		mockConfig = { credit: null, i18n: {} };
		expect( render() ).toBe( '' );

		mockConfig = {};
		expect( render() ).toBe( '' );
	} );

	it( 'links the logo to Searcio, in a new tab, with a name that says so', () => {
		mockConfig = { credit: { url: 'https://searcio.com/' }, i18n: { credit: 'Search by Searcio (opens in a new tab)' } };

		const html = render();

		expect( html ).toContain( 'href="https://searcio.com/"' );
		expect( html ).toContain( 'target="_blank"' );
		expect( html ).toContain( 'rel="noopener nofollow"' );
		expect( html ).toContain( 'aria-label="Search by Searcio (opens in a new tab)"' );
	} );

	it( 'draws the logo as a picture the name already describes', () => {
		mockConfig = { credit: { url: 'https://searcio.com/' }, i18n: {} };

		const html = render();

		expect( html ).toContain( 'aria-hidden="true"' );
		expect( html ).toContain( 'focusable="false"' );
		// The three parts the stylesheet colours: the field, the letters on
		// it, and the "io" that follows the window's text colour.
		for ( const part of [ 'whsc-credit__field', 'whsc-credit__ink', 'whsc-credit__io' ] ) {
			expect( html ).toContain( part );
		}
	} );
} );
