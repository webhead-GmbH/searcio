/**
 * Minimal Markdown renderer for assistant replies.
 *
 * The assistant is an LLM, so its answers come back as Markdown - `**bold**`,
 * numbered and bulleted lists, paragraphs. Rendered as plain text those markers
 * show up literally ("**Price:** $16"), which is what a visitor sees today.
 *
 * This builds React elements rather than HTML: the reply is third-party text
 * and must never reach `dangerouslySetInnerHTML`. Only the small subset an
 * answer actually uses is supported; anything else falls through as plain text,
 * which is the right failure mode for prose.
 */
import { createElement, Fragment } from '@wordpress/element';

import { leavesSite, safeHref } from '../../../utils/url';

// `[label](address)`. The address has no spaces and may hold one pair of
// brackets of its own, as in `/wiki/Parka_(coat)`. An image, `![label](address)`,
// is read as a link to it: nothing is loaded into the page from an address the
// model wrote, and its `!` does not stay behind in the text.
const LINK = /^!?\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)$/;

// A link, `**bold**`, `*italic*`/`_italic_`, `` `code` ``. The link comes
// first, so an underscore in its address is not read as the start of italics,
// and the two-asterisk form before the single-asterisk one.
const INLINE = /(!?\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/;

const ORDERED_ITEM = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*•]\s+(.*)$/;
const HEADING = /^\s*(#{1,6})\s+(.*)$/;

/**
 * Split one line into text and inline-formatted spans.
 *
 * @param {string} text
 * @param {string} keyPrefix
 * @return {Array} React children.
 */
const renderInline = ( text, keyPrefix ) =>
	String( text )
		.split( INLINE )
		.filter( ( part ) => '' !== part )
		.map( ( part, index ) => {
			const key = `${ keyPrefix }-${ index }`;
			const link = part.match( LINK );

			if ( link ) {
				const label = renderInline( link[ 1 ], key );
				// The model wrote the address: only the web's own schemes and a
				// path on this site become a link, and anything else stays the
				// words it was the label of.
				const href = safeHref( link[ 2 ] );

				if ( '' === href ) {
					return label;
				}

				return createElement(
					'a',
					{
						key,
						className: 'whsc-md__link',
						href,
						// Another site opens beside the shop, not instead of the
						// conversation; the shop's own pages open in its place,
						// as a result card does.
						...( leavesSite( href ) ? { target: '_blank', rel: 'noopener noreferrer' } : {} ),
					},
					label
				);
			}

			if ( part.startsWith( '**' ) && part.endsWith( '**' ) ) {
				return createElement( 'strong', { key }, part.slice( 2, -2 ) );
			}

			if ( part.startsWith( '__' ) && part.endsWith( '__' ) ) {
				return createElement( 'strong', { key }, part.slice( 2, -2 ) );
			}

			if ( part.startsWith( '`' ) && part.endsWith( '`' ) ) {
				return createElement( 'code', { key }, part.slice( 1, -1 ) );
			}

			if (
				( part.startsWith( '*' ) && part.endsWith( '*' ) ) ||
				( part.startsWith( '_' ) && part.endsWith( '_' ) )
			) {
				return createElement( 'em', { key }, part.slice( 1, -1 ) );
			}

			return part;
		} );

/**
 * Group consecutive list lines so they become one `<ol>`/`<ul>` rather than a
 * run of single-item lists.
 *
 * @param {string} markdown
 * @return {Array} React children.
 */
export const renderMarkdown = ( markdown ) => {
	const lines = String( markdown || '' ).split( '\n' );
	const blocks = [];
	let list = null;
	let paragraph = [];

	const flushParagraph = () => {
		if ( paragraph.length > 0 ) {
			const key = `p-${ blocks.length }`;

			blocks.push(
				createElement(
					'p',
					{ key, className: 'whsc-md__p' },
					paragraph.flatMap( ( line, index ) =>
						index > 0
							? [ createElement( 'br', { key: `${ key }-br-${ index }` } ), ...renderInline( line, `${ key }-${ index }` ) ]
							: renderInline( line, `${ key }-${ index }` )
					)
				)
			);
			paragraph = [];
		}
	};

	const flushList = () => {
		if ( list ) {
			blocks.push(
				createElement(
					list.ordered ? 'ol' : 'ul',
					{ key: `l-${ blocks.length }`, className: 'whsc-md__list' },
					list.items.map( ( item, index ) =>
						createElement( 'li', { key: index }, renderInline( item, `li-${ index }` ) )
					)
				)
			);
			list = null;
		}
	};

	lines.forEach( ( raw ) => {
		const line = raw.replace( /\s+$/, '' );

		if ( '' === line.trim() ) {
			flushParagraph();
			flushList();

			return;
		}

		const heading = line.match( HEADING );

		if ( heading ) {
			flushParagraph();
			flushList();
			blocks.push(
				createElement(
					'p',
					{ key: `h-${ blocks.length }`, className: 'whsc-md__heading' },
					renderInline( heading[ 2 ], `h-${ blocks.length }` )
				)
			);

			return;
		}

		const ordered = line.match( ORDERED_ITEM );

		if ( ordered ) {
			flushParagraph();

			if ( ! list || ! list.ordered ) {
				flushList();
				list = { ordered: true, items: [] };
			}

			list.items.push( ordered[ 2 ] );

			return;
		}

		const bullet = line.match( BULLET_ITEM );

		if ( bullet ) {
			flushParagraph();

			if ( ! list || list.ordered ) {
				// An indented dash under a numbered item is a sub-detail of that
				// item, not a new list - fold it into the item it belongs to so
				// the numbering doesn't restart mid-answer.
				if ( list && list.ordered && /^\s+/.test( raw ) ) {
					const last = list.items.length - 1;

					if ( last >= 0 ) {
						list.items[ last ] += `\n${ bullet[ 1 ] }`;

						return;
					}
				}

				flushList();
				list = { ordered: false, items: [] };
			}

			list.items.push( bullet[ 1 ] );

			return;
		}

		flushList();
		paragraph.push( line );
	} );

	flushParagraph();
	flushList();

	return blocks;
};

/**
 * @param {Object} props
 * @param {string} props.content Raw Markdown from the assistant.
 */
const Markdown = ( { content } ) =>
	createElement( Fragment, null, renderMarkdown( content ) );

export default Markdown;
