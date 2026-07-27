/**
 * Assistant replies arrive as Markdown. Rendered as plain text the markers show
 * up literally — a real reply read "**Price:** $16 (on sale...)" on screen.
 */
import { renderMarkdown } from './markdown';

/** Flatten the React tree to the tags and text a reader would perceive. */
const summarize = ( nodes ) => {
	const out = [];

	const walk = ( node ) => {
		if ( null === node || undefined === node || false === node ) {
			return;
		}

		if ( Array.isArray( node ) ) {
			node.forEach( walk );

			return;
		}

		if ( 'string' === typeof node || 'number' === typeof node ) {
			out.push( String( node ) );

			return;
		}

		out.push( `<${ node.type }>` );
		walk( node.props?.children );
	};

	nodes.forEach( walk );

	return out;
};

describe( 'renderMarkdown', () => {
	it( 'turns **bold** into a strong element, not literal asterisks', () => {
		const parts = summarize( renderMarkdown( '**Price:** 16 EUR' ) );

		expect( parts ).toContain( '<strong>' );
		expect( parts ).toContain( 'Price:' );
		expect( parts.join( '' ) ).not.toContain( '**' );
	} );

	it( 'renders a numbered list as one ordered list', () => {
		const parts = summarize( renderMarkdown( '1. Cap\n2. Classic Cap\n3. Organic Cap' ) );

		expect( parts.filter( ( p ) => '<ol>' === p ) ).toHaveLength( 1 );
		expect( parts.filter( ( p ) => '<li>' === p ) ).toHaveLength( 3 );
	} );

	it( 'renders a bulleted list', () => {
		const parts = summarize( renderMarkdown( '- One\n- Two' ) );

		expect( parts ).toContain( '<ul>' );
		expect( parts.filter( ( p ) => '<li>' === p ) ).toHaveLength( 2 );
	} );

	/** The shape a real answer took: numbered products, dashes for details. */
	it( 'keeps an indented detail with the numbered item it belongs to', () => {
		const parts = summarize(
			renderMarkdown( '1. **Cap**\n   - **Price:** 16\n   - Casual wear.\n2. **Other Cap**' )
		);

		expect( parts.filter( ( p ) => '<ol>' === p ) ).toHaveLength( 1 );
		expect( parts.filter( ( p ) => '<ul>' === p ) ).toHaveLength( 0 );
		expect( parts.filter( ( p ) => '<li>' === p ) ).toHaveLength( 2 );
	} );

	it( 'separates paragraphs on a blank line', () => {
		const parts = summarize( renderMarkdown( 'First line.\n\nSecond line.' ) );

		expect( parts.filter( ( p ) => '<p>' === p ) ).toHaveLength( 2 );
	} );

	it( 'keeps a single newline inside a paragraph as a line break', () => {
		const parts = summarize( renderMarkdown( 'One\nTwo' ) );

		expect( parts.filter( ( p ) => '<p>' === p ) ).toHaveLength( 1 );
		expect( parts ).toContain( '<br>' );
	} );

	it( 'renders italics and inline code', () => {
		expect( summarize( renderMarkdown( '*soft* and `code`' ) ) ).toEqual(
			expect.arrayContaining( [ '<em>', '<code>' ] )
		);
	} );

	/**
	 * The reply is third-party text: it becomes React children, never markup, so
	 * a tag in the answer stays visible text rather than being parsed.
	 */
	it( 'never turns HTML in the reply into elements', () => {
		const parts = summarize( renderMarkdown( 'Watch out <img src=x onerror=alert(1)>' ) );

		expect( parts ).not.toContain( '<img>' );
		expect( parts.join( '' ) ).toContain( '<img src=x onerror=alert(1)>' );
	} );

	it( 'handles an empty or missing reply without throwing', () => {
		expect( renderMarkdown( '' ) ).toEqual( [] );
		expect( renderMarkdown( undefined ) ).toEqual( [] );
	} );
} );
