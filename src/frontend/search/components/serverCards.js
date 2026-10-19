/**
 * Client-side rendering engine for Searcio "card templates" - see
 * `card-templates.md`. Templates are designed server-side (an Elementor-style
 * builder in the Searcio panel) and delivered as pre-compiled HTML + CSS;
 * this module implements the widget's half of the contract: matching a hit to
 * a template, substituting `{{field}}` placeholders, removing conditional
 * elements, wiring rating-bar CSS variables, and computing price components.
 * No rendering engine is shipped here - only string/DOM post-processing of
 * markup the server already built and the site owner already trusts (it's
 * their own design).
 */
import { useLayoutEffect } from '@wordpress/element';

import { formatPrice, PRICE_FIELDS } from '../../../utils/currency';
import { PLACEHOLDER_IMAGE_DATA_URI } from '../../../utils/placeholderImage';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

// Template CSS only needs to exist in the document once, no matter how many
// hits use it or how many times the modal is opened/closed.
const injectedTemplateIds = new Set();

/**
 * A hit's fields live under `source` (the stored document), with `id`/`score`
 * as the only other addressable top-level fields - used both for condition
 * fields and `{{placeholder}}` substitution.
 *
 * @param {Object} hit
 * @param {string} field
 * @return {*}
 */
const fieldValue = ( hit, field ) => {
	const source = hit?.source || {};

	if ( Object.prototype.hasOwnProperty.call( source, field ) ) {
		return source[ field ];
	}

	return hit?.[ field ];
};

const HTML_ESCAPES = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/**
 * @param {*} value
 * @return {string} HTML-escaped string (safe for both text and attribute
 *                  contexts), '' for null/undefined.
 *
 * Escapes quotes as well as `<`/`>`/`&`. The substituted value lands inside
 * double-quoted attributes too (`src`/`href` - see `substitutePlaceholders`),
 * so a value carrying a `"` would otherwise break out of the attribute and
 * inject arbitrary markup (e.g. an `onerror` handler). A `textContent` round
 * trip escapes only `<`/`>`/`&`, never quotes, so it is deliberately not used
 * here.
 */
export const escapeHtml = ( value ) => {
	const string = null === value || undefined === value ? '' : String( value );

	return string.replace( /[&<>"']/g, ( char ) => HTML_ESCAPES[ char ] );
};

// URL-bearing attributes whose value can execute script via a `javascript:`
// (or `vbscript:`/`data:`) scheme even after HTML-escaping - escaping quotes
// stops attribute breakout, but not a scheme sitting inside a legitimately
// quoted `href`/`src`.
const URL_ATTRIBUTES = [ 'href', 'src', 'xlink:href' ];

// Anything but a plain, safe scheme (or a scheme-less relative URL) is dropped.
// `data:image/` is kept so the empty-image placeholder data URI and legitimate
// inline images in a template still resolve.
const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data|file):/i;

/**
 * Neutralise script-bearing URL schemes in a parsed template fragment. Card
 * templates are server-designed and trusted, but the `{{field}}` values spliced
 * into their `href`/`src` attributes come from indexed documents (post/product
 * content, custom fields) that lower-privileged users can influence, so a value
 * like `javascript:alert(1)` in an `href` must not survive to the live DOM.
 *
 * Each element's attributes are read by name rather than found with a
 * selector. `[xlink:href]` is not a selector a browser accepts - the colon has
 * to be escaped, and `querySelectorAll()` throws on it, which took the whole
 * modal down with it - and an escaped one still misses the attribute where it
 * is actually written: on an inline `<svg>`, where the HTML parser puts it in
 * the XLink namespace.
 *
 * @param {Element} root
 */
const sanitizeUrls = ( root ) => {
	root.querySelectorAll( '*' ).forEach( ( el ) => {
		[ ...el.attributes ].forEach( ( attribute ) => {
			if ( ! URL_ATTRIBUTES.includes( attribute.name.toLowerCase() ) ) {
				return;
			}

			// Allow inline images (`data:image/...`); block every other data: URI
			// and all javascript:/vbscript:/file: schemes.
			if ( DANGEROUS_URL_RE.test( attribute.value ) && ! /^\s*data:image\//i.test( attribute.value ) ) {
				el.removeAttributeNode( attribute );
			}
		} );
	} );
};

const toLooseBoolean = ( value ) => true === value || 'true' === value || 1 === value || '1' === value;

/**
 * @param {{field?: string, operator?: string, value?: *}} condition
 * @param {Object}                                         hit
 * @return {boolean}
 */
export const evaluateCondition = ( condition, hit ) => {
	const { field, operator, value } = condition || {};
	const actual = fieldValue( hit, field );

	switch ( operator ) {
		case 'exists':
			return undefined !== actual && null !== actual;
		case 'not_exists':
			return undefined === actual || null === actual;
		case 'equals':
			return String( actual ?? '' ) === String( value ?? '' );
		case 'not_equals':
			return String( actual ?? '' ) !== String( value ?? '' );
		case 'gt':
			return Number( actual ) > Number( value );
		case 'lt':
			return Number( actual ) < Number( value );
		case 'contains':
			return String( actual ?? '' ).includes( String( value ?? '' ) );
		case 'is_true':
			return toLooseBoolean( actual );
		case 'is_false':
			return ! toLooseBoolean( actual );
		default:
			return false;
	}
};

/**
 * Conditions are AND-ed - every one must match (per `card-templates.md`).
 * An empty/missing list matches unconditionally (the default template).
 *
 * @param {Array<Object>} [conditions]
 * @param {Object}        hit
 * @return {boolean}
 */
export const evaluateConditions = ( conditions, hit ) =>
	( conditions || [] ).every( ( condition ) => evaluateCondition( condition, hit ) );

/**
 * First template (already server-sorted: conditional templates before the
 * `is_default` one) whose `type` matches the hit and whose `conditions` all
 * pass. `null` when nothing matches - the caller falls back to the plugin's
 * own built-in card for that hit.
 *
 * @param {Array<Object>} templates
 * @param {Object}        hit
 * @return {Object|null}
 */
export const matchTemplate = ( templates, hit ) => {
	const type = hit?.source?.type;
	const candidates = ( templates || [] ).filter( ( template ) => template.type === type );

	return candidates.find( ( template ) => evaluateConditions( template.conditions, hit ) ) || null;
};

/**
 * Replace every `{{field}}` in the template's HTML with the hit's value,
 * HTML-escaped - placeholders also appear inside `src`/`href` attributes, so
 * this is a plain string substitution over the raw markup rather than a
 * DOM-attribute walk. Missing fields become `''`.
 *
 * Known WooCommerce price fields (`price`, `sale_price`, etc. - the exact
 * names this plugin's own indexer always uses, see `currency.js`) are run
 * through the site's WooCommerce currency format first, the same as the
 * plugin's own built-in product card: the API only ever returns bare numbers
 * for these (deliberately, so each site can format them for its own
 * currency/locale), so a server template's raw `{{price}}` would otherwise
 * show an unformatted number instead of matching the store everywhere else.
 *
 * @param {string} html
 * @param {Object} hit
 * @return {string}
 */
export const substitutePlaceholders = ( html, hit ) =>
	String( html || '' ).replace( PLACEHOLDER_RE, ( _match, field ) => {
		const value = fieldValue( hit, field );

		return escapeHtml( PRICE_FIELDS.has( field ) ? formatPrice( value ) : value );
	} );

/**
 * Currency position naming differs between this plugin's own WooCommerce
 * config (`left`/`left_space`/`right`/`right_space`, matching WooCommerce's
 * own option values) and a price component's `data-sc-currency-position`
 * (`before`/`before_space`/`after`/`after_space`, per `card-templates.md`) -
 * translate the latter into the former so both can share `formatPrice()`.
 */
const CURRENCY_POSITION_MAP = {
	before: 'left',
	before_space: 'left_space',
	after: 'right',
	after_space: 'right_space',
};

/**
 * Step 7 of the contract: a `[data-sc-price]` wrapper computes its own
 * Range/Sale/Plain state from its field-mapping attributes and formats using
 * its own baked-in currency/decimals/separator attributes - set by the
 * Searcio panel when the template was designed, not the widget's local
 * WooCommerce config (unlike a bare `{{price}}` placeholder, which does use
 * the site's own config - see `substitutePlaceholders()`).
 *
 * @param {Element} root
 * @param {Object}  hit
 */
const applyPriceComponents = ( root, hit ) => {
	root.querySelectorAll( '[data-sc-price]' ).forEach( ( wrapper ) => {
		const currency = {
			symbol: wrapper.getAttribute( 'data-sc-currency' ) || '',
			position: CURRENCY_POSITION_MAP[ wrapper.getAttribute( 'data-sc-currency-position' ) ] || 'left',
			decimals: Number( wrapper.getAttribute( 'data-sc-decimals' ) ?? 2 ),
			decimalSep: wrapper.getAttribute( 'data-sc-decimal-sep' ) ?? '.',
			thousandSep: wrapper.getAttribute( 'data-sc-thousand-sep' ) ?? '',
		};

		const readField = ( attr ) => {
			const field = wrapper.getAttribute( attr );

			return field ? fieldValue( hit, field ) : undefined;
		};

		const price = readField( 'data-sc-price-field' );
		const regular = readField( 'data-sc-regular-field' );
		const sale = readField( 'data-sc-sale-field' );
		const min = readField( 'data-sc-min-field' );
		const max = readField( 'data-sc-max-field' );

		const parts = {
			prefix: wrapper.querySelector( '[data-sc-price-part="prefix"]' ),
			regular: wrapper.querySelector( '[data-sc-price-part="regular"]' ),
			current: wrapper.querySelector( '[data-sc-price-part="current"]' ),
		};

		const showPart = ( part, text ) => {
			if ( ! part ) {
				return;
			}

			part.style.removeProperty( 'display' );

			if ( undefined !== text ) {
				part.textContent = text;
			}
		};

		const hidePart = ( part ) => {
			if ( part ) {
				part.style.display = 'none';
			}
		};

		const isVariable = undefined !== min && undefined !== max && Number( min ) !== Number( max );
		const isOnSale = undefined !== sale && '' !== String( sale );

		if ( isVariable ) {
			// Range: only "current" (the min value) and "prefix" (its
			// already-compiled text, e.g. "from" - never overwritten) show.
			showPart( parts.current, formatPrice( min, currency ) );
			showPart( parts.prefix );
			hidePart( parts.regular );
		} else if ( isOnSale ) {
			// Sale: "regular" (struck through by the template's own CSS) then
			// "current" set to the sale value; no "from" prefix here.
			showPart( parts.regular, formatPrice( regular, currency ) );
			showPart( parts.current, formatPrice( sale, currency ) );
			hidePart( parts.prefix );
		} else {
			// Plain: just the price field's value.
			showPart( parts.current, formatPrice( price, currency ) );
			hidePart( parts.prefix );
			hidePart( parts.regular );
		}
	} );
};

/**
 * Second pass over the already-substituted HTML, all in one `DOMParser` pass
 * (rather than a regex, so nested/malformed markup can't break the removal):
 *
 * - Remove any element whose `data-sc-if` (a JSON condition array) doesn't
 *   fully match the hit.
 * - Set `--sc-rating-percent` on `data-sc-rating-field` elements.
 * - Compute and fill in `data-sc-price` price components.
 * - Strip script-bearing URL schemes from `href`/`src` attributes (see
 *   `sanitizeUrls`) so an indexed field value can't smuggle `javascript:` into
 *   a link before the markup reaches the live DOM.
 * - Point any `<img>` with an empty/missing `src` (a `{{image}}` placeholder
 *   with nothing to substitute) at a neutral placeholder graphic instead of
 *   a broken-image icon - kept as a real `<img>` (a data URI, so this adds
 *   no network request) rather than swapped for another element, so
 *   whatever sizing/fit/radius CSS the template already targets `img` with
 *   still applies.
 *
 * @param {string} html Already placeholder-substituted.
 * @param {Object} hit
 * @return {string}
 */
export const postProcessMarkup = ( html, hit ) => {
	const doc = new window.DOMParser().parseFromString( `<div id="whsc-sct-root">${ html }</div>`, 'text/html' );
	const root = doc.getElementById( 'whsc-sct-root' );

	if ( ! root ) {
		return html;
	}

	root.querySelectorAll( '[data-sc-if]' ).forEach( ( el ) => {
		let matches;

		try {
			// An empty/missing condition list matches unconditionally (see
			// `evaluateConditions`), so a parse failure must not fall through
			// to that same empty-list path - that would show the element
			// unconditionally instead of hiding it, the opposite of a safe
			// default for markup we can no longer verify.
			matches = evaluateConditions( JSON.parse( el.getAttribute( 'data-sc-if' ) ), hit );
		} catch ( error ) {
			matches = false;
		}

		if ( ! matches ) {
			el.remove();
		}
	} );

	root.querySelectorAll( '[data-sc-rating-field]' ).forEach( ( el ) => {
		const value = Number( fieldValue( hit, el.getAttribute( 'data-sc-rating-field' ) ) );
		const percent = Number.isFinite( value ) ? Math.max( 0, Math.min( 100, ( value / 5 ) * 100 ) ) : 0;

		el.style.setProperty( '--sc-rating-percent', `${ percent }%` );
	} );

	applyPriceComponents( root, hit );

	sanitizeUrls( root );

	root.querySelectorAll( 'img' ).forEach( ( img ) => {
		if ( '' === ( img.getAttribute( 'src' ) || '' ).trim() ) {
			img.setAttribute( 'src', PLACEHOLDER_IMAGE_DATA_URI );
		}
	} );

	return root.innerHTML;
};

/**
 * Full contract steps 4-7 in one call: substitute placeholders, then strip
 * conditional elements, set rating variables, fill in price components, and
 * fall back missing images. Returns markup ready for
 * `dangerouslySetInnerHTML`.
 *
 * @param {Object} template
 * @param {Object} hit
 * @return {string}
 */
export const buildServerCardHtml = ( template, hit ) =>
	postProcessMarkup( substitutePlaceholders( template.html, hit ), hit );

// Matches every element and weighs four ids, of an id no element has. The
// storefront's stylesheet weighs three (`$lift` in `scss/style.scss`), the
// reset under it two, and a site's own rules one at most.
const TEMPLATE_WEIGHT = ':is(*, #whsc#whsc#whsc#whsc)';

/**
 * A selector list split at its top-level commas - not the ones inside
 * `:is(a, b)`, `[data-x="a,b"]` or a string.
 *
 * @param {string} list
 * @return {string[]}
 */
const splitSelectors = ( list ) => {
	const selectors = [];
	let depth = 0;
	let quote = '';
	let start = 0;

	for ( let index = 0; index < list.length; index++ ) {
		const char = list[ index ];

		if ( '\\' === char ) {
			index++;
		} else if ( quote ) {
			quote = char === quote ? '' : quote;
		} else if ( '"' === char || "'" === char ) {
			quote = char;
		} else if ( '(' === char || '[' === char ) {
			depth++;
		} else if ( ')' === char || ']' === char ) {
			depth--;
		} else if ( ',' === char && 0 === depth ) {
			selectors.push( list.slice( start, index ) );
			start = index + 1;
		}
	}

	selectors.push( list.slice( start ) );

	return selectors.map( ( selector ) => selector.trim() ).filter( Boolean );
};

/**
 * Give every selector of a list the template's weight, without changing what
 * it matches: `TEMPLATE_WEIGHT` joins the selector's first compound, after the
 * element name when it starts with one (`a.sct-12-root`), where a pseudo-class
 * has to be written.
 *
 * @param {string} list A rule's selector list.
 * @return {string}
 */
export const liftSelectors = ( list ) =>
	splitSelectors( list )
		.map( ( selector ) => selector.replace( /^(\*|[a-zA-Z_][\w-]*)?/, ( type ) => `${ type }${ TEMPLATE_WEIGHT }` ) )
		.join( ', ' );

/**
 * @param {CSSRuleList} rules
 */
const liftRules = ( rules ) => {
	Array.from( rules ).forEach( ( rule ) => {
		if ( 'string' === typeof rule.selectorText ) {
			rule.selectorText = liftSelectors( rule.selectorText );
		} else if ( rule.cssRules ) {
			// `@media`, `@supports`, `@container`: the rules inside one.
			liftRules( rule.cssRules );
		}
	} );
};

/**
 * Step 3 of the contract: inject a template's CSS once per template id.
 *
 * The rules are the template's whole design, each written with one class
 * (`.sct-12-title`), which is less than nearly everything else on the page: a
 * theme's or an Elementor kit's `.elementor-kit-7 h3 {}` outweighs it, and so
 * do the storefront's own reset and the base it gives a card (see "A card
 * designed in Searcio" in `scss/style.scss`). So once the browser has
 * parsed them their selectors are rewritten to weigh more than all of those.
 * What a rule matches does not change, and neither does one rule's order
 * against another's.
 *
 * @param {number|string} id
 * @param {string}        [css]
 */
export const ensureTemplateCss = ( id, css ) => {
	if ( injectedTemplateIds.has( id ) || ! css ) {
		return;
	}

	const style = document.createElement( 'style' );

	style.setAttribute( 'data-sct-id', String( id ) );
	style.textContent = css;
	document.head.appendChild( style );

	try {
		liftRules( style.sheet.cssRules );
	} catch ( error ) {
		// The rules stay as the service wrote them, at the weight they had.
	}

	injectedTemplateIds.add( id );
};

/**
 * Renders one hit through a matched server template.
 *
 * @param {Object} props
 * @param {Object} props.hit
 * @param {Object} props.template
 */
export const ServerCard = ( { hit, template, onClick } ) => {
	// Before the first paint, so the card is never seen without its styles.
	useLayoutEffect( () => {
		ensureTemplateCss( template.id, template.css );
	}, [ template.id, template.css ] );

	return (
		<div
			className={ `whsc-card whsc-card--server sct-${ template.id }` }
			onClick={ onClick }
			// eslint-disable-next-line react/no-danger -- server-designed, trusted HTML; field values are escaped in buildServerCardHtml().
			dangerouslySetInnerHTML={ { __html: buildServerCardHtml( template, hit ) } }
		/>
	);
};
