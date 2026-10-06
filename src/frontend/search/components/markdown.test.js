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

/** Every `<a>` in the tree, as its props. */
const links = ( nodes ) => {
	const out = [];

	const walk = ( node ) => {
		if ( Array.isArray( node ) ) {
			node.forEach( walk );
		} else if ( node && 'object' === typeof node ) {
			if ( 'a' === node.type ) {
				out.push( node.props );
			}

			walk( node.props?.children );
		}
	};

	walk( nodes );

	return out;
};

/**
 * A reply read "The [size guide](https://example.test/size) helps with the fit."
 * on screen, brackets and address and all.
 */
describe( 'renderMarkdown - links', () => {
	it( 'turns [label](address) into a link, not literal brackets', () => {
		const tree = renderMarkdown( 'The [size guide](/size-guide/) helps with the fit.' );
		const parts = summarize( tree );

		expect( links( tree ) ).toHaveLength( 1 );
		expect( links( tree )[ 0 ].href ).toBe( '/size-guide/' );
		expect( parts.join( '' ) ).toBe( '<p>The <a>size guide helps with the fit.' );
	} );

	it( 'opens a page of this site in place, as a result card does', () => {
		const [ link ] = links( renderMarkdown( `[Boots](${ window.location.origin }/boots/)` ) );

		expect( link.target ).toBeUndefined();
		expect( link.rel ).toBeUndefined();
	} );

	it( 'opens another site beside the shop, without handing it the opener', () => {
		const [ link ] = links( renderMarkdown( '[the maker](https://example.org/boots)' ) );

		expect( link.href ).toBe( 'https://example.org/boots' );
		expect( link.target ).toBe( '_blank' );
		expect( link.rel ).toBe( 'noopener noreferrer' );
	} );

	it.each( [
		[ '[click](javascript:alert(1))' ],
		[ '[click](data:text/html,<b>x</b>)' ],
		[ '[click](//evil.test/x)' ],
		[ '[click](/\\evil.test/x)' ],
		[ '[click](boots/)' ],
	] )( 'keeps only the words of %s', ( markdown ) => {
		const tree = renderMarkdown( markdown );

		expect( links( tree ) ).toHaveLength( 0 );
		expect( summarize( tree ).join( '' ) ).toBe( '<p>click' );
	} );

	it( 'formats the label, and keeps an underscore in the address out of the italics', () => {
		const tree = renderMarkdown( 'See [**Alpine** boots](https://example.org/alpine_boots_2026) and _more_.' );
		const parts = summarize( tree );

		expect( links( tree )[ 0 ].href ).toBe( 'https://example.org/alpine_boots_2026' );
		expect( parts ).toEqual( [ '<p>', 'See ', '<a>', '<strong>', 'Alpine', ' boots', ' and ', '<em>', 'more', '.' ] );
	} );

	it( 'takes a pair of brackets in the address with it', () => {
		const tree = renderMarkdown( 'A [parka](https://example.org/wiki/Parka_(coat)) is warm.' );

		expect( links( tree )[ 0 ].href ).toBe( 'https://example.org/wiki/Parka_(coat)' );
		expect( summarize( tree ).join( '' ) ).toBe( '<p>A <a>parka is warm.' );
	} );

	it( 'draws a link inside a list item', () => {
		const tree = renderMarkdown( '- [Jacket](/jacket/)\n- [Boots](/boots/)' );

		expect( links( tree ).map( ( link ) => link.href ) ).toEqual( [ '/jacket/', '/boots/' ] );
	} );

	it( 'reads an image as a link to it, and loads nothing', () => {
		const tree = renderMarkdown( 'Here it is: ![the jacket](https://example.org/jacket.jpg)' );
		const parts = summarize( tree );

		expect( parts ).not.toContain( '<img>' );
		expect( links( tree )[ 0 ].href ).toBe( 'https://example.org/jacket.jpg' );
		expect( parts.join( '' ) ).toBe( '<p>Here it is: <a>the jacket' );
	} );

	it( 'leaves brackets that are not a link as they were written', () => {
		expect( summarize( renderMarkdown( 'Sizes [S, M, L] (see chart)' ) ).join( '' ) ).toBe( '<p>Sizes [S, M, L] (see chart)' );
	} );
} );
