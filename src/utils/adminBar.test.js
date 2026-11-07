import { adminBarOffset } from './adminBar';

const toolbar = ( bottom, style = '' ) => {
	const bar = document.createElement( 'div' );

	bar.id = 'wpadminbar';
	bar.setAttribute( 'style', style );
	bar.getBoundingClientRect = () => ( { top: bottom - 32, bottom, height: 32 } );
	document.body.appendChild( bar );

	return bar;
};

afterEach( () => {
	document.getElementById( 'wpadminbar' )?.remove();
} );

describe( 'adminBarOffset', () => {
	it( 'is 0 for a visitor, who has no toolbar', () => {
		expect( adminBarOffset() ).toBe( 0 );
	} );

	it( 'is where the toolbar ends', () => {
		toolbar( 32 );

		expect( adminBarOffset() ).toBe( 32 );
	} );

	it( 'counts only what is still on screen of a toolbar the page scrolled up', () => {
		toolbar( 46.4 - 20 );

		expect( adminBarOffset() ).toBe( 26 );
	} );

	it( 'is 0 once the toolbar has scrolled away', () => {
		toolbar( -14 );

		expect( adminBarOffset() ).toBe( 0 );
	} );

	it( 'is 0 for a toolbar that is hidden', () => {
		toolbar( 32, 'display: none' );

		expect( adminBarOffset() ).toBe( 0 );
	} );
} );
