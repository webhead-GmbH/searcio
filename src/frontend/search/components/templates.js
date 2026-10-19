/**
 * Per-type result card renderers, shared by the highlights and search-results
 * carousels. `window.webheadSearchCloudSearch.registerTemplate` lets a theme
 * or plugin override or add a per-type template client-side.
 */
import { __ } from '@wordpress/i18n';

import { getConfig } from '../../../utils/api';
import { formatPrice } from '../../../utils/currency';
import { matchTemplate, ServerCard } from './serverCards';

/**
 * The price line for a product card: strikethrough regular + sale price when
 * on sale, a compact "from {min}" for variable products (the full range would
 * overflow a card), otherwise the single price - each followed by the store's
 * small price suffix (e.g. "inkl. MwSt. zzgl. Versandkosten"). All formatting
 * comes from indexed structured fields + the localized currency config, so
 * card prices track the store without embedding server HTML.
 *
 * @param {Object} props
 * @param {Object} props.source
 */
const PriceLine = ( { source } ) => {
	const config = getConfig();
	const i18n = config.i18n || {};
	const suffix = config.currency?.suffix || '';
	const isVariable = 'variable' === source.product_type || ( source.price_min !== undefined && source.price_min !== source.price_max );
	const onSale = Boolean( source.on_sale ) && source.regular_price !== undefined && source.sale_price !== undefined;

	let body;

	if ( isVariable ) {
		const min = formatPrice( source.price_min ?? source.price );

		if ( '' === min ) {
			return null;
		}

		body = (
			<>
				<span className="whsc-card__price-from">{ i18n.priceFrom || __( 'from', 'searcio' ) }</span>{ ' ' }
				<span className="whsc-card__price-current">{ min }</span>
			</>
		);
	} else if ( onSale ) {
		body = (
			<>
				<del className="whsc-card__price-regular">{ formatPrice( source.regular_price ) }</del>{ ' ' }
				<ins className="whsc-card__price-current">{ formatPrice( source.sale_price ) }</ins>
			</>
		);
	} else {
		const current = formatPrice( source.price );

		if ( '' === current ) {
			return null;
		}

		body = <span className="whsc-card__price-current">{ current }</span>;
	}

	return (
		<span className="whsc-card__price">
			{ body }
			{ suffix && <small className="whsc-card__price-suffix">{ suffix }</small> }
		</span>
	);
};

/**
 * Image, or a neutral placeholder with an image glyph so image-less products
 * don't leave a ragged, uneven card layout.
 *
 * @param {Object} props
 * @param {string} [props.src]
 */
const CardImage = ( { src } ) => {
	if ( src ) {
		return <img className="whsc-card__image" src={ src } alt="" loading="lazy" draggable="false" />;
	}

	return (
		<span className="whsc-card__image whsc-card__image--placeholder" aria-hidden="true">
			<svg viewBox="0 0 24 24" width="32" height="32" focusable="false">
				<path
					fill="currentColor"
					d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"
				/>
			</svg>
		</span>
	);
};

const StockStatus = ( { inStock } ) => {
	if ( undefined === inStock ) {
		return null;
	}

	return (
		<span className={ `whsc-card__stock ${ inStock ? 'is-in-stock' : 'is-out-of-stock' }` }>
			{ inStock ? __( 'In stock', 'searcio' ) : __( 'Out of stock', 'searcio' ) }
		</span>
	);
};

const ProductCard = ( { hit, onClick } ) => {
	const source = hit.source || {};
	const i18n = getConfig().i18n || {};

	return (
		<a className="whsc-card whsc-card--product" href={ source.url || '#' } onClick={ onClick }>
			<span className="whsc-card__media">
				<CardImage src={ source.image } />
				{ Boolean( source.on_sale ) && (
					<span className="whsc-card__badge">{ i18n.onSale || __( 'Sale', 'searcio' ) }</span>
				) }
			</span>
			<span className="whsc-card__body">
				<span className="whsc-card__title" title={ source.title }>{ source.title }</span>
				<PriceLine source={ source } />
				<StockStatus inStock={ source.in_stock } />
			</span>
		</a>
	);
};

const EXCERPT_LENGTH = 120;

// A space, a dash, an opening bracket or the punctuation that leads on to more
// text ("the zipper,…") is taken off before the ellipsis. Persian and Arabic,
// Chinese and Japanese write their own commas and stops. Quotes stay: which
// one opens and which one closes differs from language to language.
const EXCERPT_TRAILING = /[\s\p{Pd}\p{Ps}.,;:!?،؛؟、。，；：！？…]+$/u;

const segmenters = {};

/**
 * Where each segment of a text begins, in UTF-16 units, followed by where the
 * text ends: the places it may be cut at.
 *
 * `Intl.Segmenter` knows a character as the reader sees it (a letter with its
 * marks, an emoji with its modifiers) and a word in a script written without
 * spaces. Without it, a character is a code point, which never parts a
 * surrogate pair, and a word ends at a space.
 *
 * @param {string}            text
 * @param {'grapheme'|'word'} granularity
 * @return {Array<number>} Ascending offsets, the last one the text's length.
 */
const boundaries = ( text, granularity ) => {
	let starts;

	if ( 'function' === typeof Intl.Segmenter ) {
		segmenters[ granularity ] ??= new Intl.Segmenter( undefined, { granularity } );
		starts = Array.from( segmenters[ granularity ].segment( text ), ( { index } ) => index );
	} else {
		starts = Array.from( text.matchAll( 'word' === granularity ? /\s+|\S+/g : /./gsu ), ( { index } ) => index );
	}

	return [ ...starts, text.length ];
};

/**
 * A post's text, cut for a card: at most `limit` characters, ending at a word
 * and with an ellipsis when something was left out. The cut is made here and
 * only here; the stylesheet does not clamp the excerpt as well.
 *
 * Runs of white space count as the one space the browser draws of them. The
 * ellipsis is the last character of the text and takes the direction of the
 * card, so it ends a right-to-left excerpt on its left.
 *
 * @param {*}      text
 * @param {number} [limit]
 * @return {string} The excerpt; empty for a text with nothing to show.
 */
export const trimExcerpt = ( text, limit = EXCERPT_LENGTH ) => {
	const clean = String( text ?? '' ).replace( /[\t\n\f\r ]+/g, ' ' ).trim();
	const characters = boundaries( clean, 'grapheme' );

	if ( characters.length - 1 <= limit ) {
		return clean;
	}

	const end = characters[ limit ];
	const cut = boundaries( clean, 'word' ).filter( ( offset ) => offset <= end ).pop();
	const kept = clean.slice( 0, cut ).replace( EXCERPT_TRAILING, '' );

	// A first word longer than the limit has no end to cut at before it.
	return ( kept || clean.slice( 0, end ) ) + '…';
};

const PostCard = ( { hit, onClick } ) => {
	const source = hit.source || {};
	const excerpt = trimExcerpt( source.content );

	return (
		<a className="whsc-card whsc-card--post" href={ source.url || '#' } onClick={ onClick }>
			<CardImage src={ source.image } />
			<span className="whsc-card__body">
				<span className="whsc-card__title" title={ source.title }>{ source.title }</span>
				{ excerpt && <span className="whsc-card__excerpt">{ excerpt }</span> }
				{ source.date && <span className="whsc-card__date">{ source.date }</span> }
			</span>
		</a>
	);
};

const GenericCard = ( { hit, onClick } ) => {
	const source = hit.source || {};

	return (
		<a className="whsc-card whsc-card--generic" href={ source.url || '#' } onClick={ onClick }>
			<CardImage src={ source.image } />
			<span className="whsc-card__body">
				<span className="whsc-card__title" title={ source.title }>{ source.title }</span>
			</span>
		</a>
	);
};

const templates = {
	product: ProductCard,
	post: PostCard,
};

export const registerTemplate = ( type, Component ) => {
	if ( typeof type === 'string' && typeof Component === 'function' ) {
		templates[ type ] = Component;
	}
};

/**
 * @param {Object}         props
 * @param {Object}         props.hit
 * @param {string}         [props.cardSource]      'server' to prefer a
 *                                                  Searcio-designed template.
 * @param {Array<Object>}  [props.serverTemplates]  Fetched once per modal
 *                                                   session by the caller.
 * @param {Function}       [props.onClick]          Fired when the card is opened,
 *                                                   for click-through tracking.
 */
export const ResultCard = ( { hit, cardSource, serverTemplates, onClick } ) => {
	if ( 'server' === cardSource && Array.isArray( serverTemplates ) && serverTemplates.length > 0 ) {
		const template = matchTemplate( serverTemplates, hit );

		if ( template ) {
			return <ServerCard hit={ hit } template={ template } onClick={ onClick } />;
		}
	}

	const type = hit?.source?.type;
	const Template = ( type && templates[ type ] ) || GenericCard;

	return <Template hit={ hit } onClick={ onClick } />;
};
