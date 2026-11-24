import { __, sprintf } from '@wordpress/i18n';

import { getConfig } from '../../../utils/api';
import { formatPrice, PRICE_FIELDS } from '../../../utils/currency';
import { humanizeFieldLabel } from '../../../utils/facets';
import { PLACEHOLDER_IMAGE_DATA_URI } from '../../../utils/placeholderImage';
import { openHandlers } from '../../../utils/clicks';

// Fields shown in the column header (title/image/price) or otherwise not useful
// as comparison rows. Everything else a product carries becomes a row.
const HEADER_OR_INTERNAL = new Set( [
	'id', 'type', 'title', 'url', 'image', 'content', 'excerpt', 'lang', 'score',
	'on_sale', 'product_type', 'in_stock',
	// Every variation's SKU, next to the product's own `sku` row: the same
	// thing again, as a list only a warehouse reads.
	'skus',
	// The categories again, as paths for the filter's tree; the tags Searcio's
	// photo tagging writes, in English on a German shop; and the flag that
	// picks the "featured" highlights. None says anything to a shopper
	// choosing between two products.
	'category_paths', 'ai_tags', 'featured',
	// Each variation's attributes and stock as objects, which the variation filters
	// read: the colour and the size are rows of their own already, and the list
	// itself was "[object Object], [object Object]".
	'variants',
	// The price without tax a shop sends Searcio for its profit ranking, which
	// does not return it: still listed by a service that keeps unknown fields.
	'price_excluding_tax',
	// Bookkeeping the indexer writes. `indexed_at` in particular was showing up
	// as a comparison row, which tells a shopper nothing about the product.
	// `published_at` is the date the "newest" highlights are sorted by, as a
	// timestamp ("2026-11-11T11:34:17Z") in no language.
	'indexed_at', 'synced_at', 'updated_at', 'created_at', 'published_at', 'modified', 'date',
	'permalink', 'slug', 'thumbnail', 'images', 'menu_order', 'post_id', 'object_id',
	...PRICE_FIELDS,
] );

/**
 * The same attribute often reaches the index twice - once plainly (`color`) and
 * once prefixed by the WooCommerce attribute indexer (`attr_color`) - which
 * would render two identical rows. Both humanize to the same label, so the
 * label is what decides: first key with a given label wins.
 *
 * The site may name only one of them ("Farbe" for `attr_color`), so a key is
 * known by its humanized key as well as by its name, and a key the site names
 * is taken first: the row is the one that reads "Farbe", not "Color".
 *
 * @param {string[]}              keys
 * @param {Object<string,string>} [labels] The site's own field names.
 */
const dedupeByLabel = ( keys, labels ) => {
	const seen = new Set();
	const isNamed = ( key ) => humanizeFieldLabel( key, labels ) !== humanizeFieldLabel( key );
	const ordered = [ ...keys.filter( isNamed ), ...keys.filter( ( key ) => ! isNamed( key ) ) ];

	return ordered.filter( ( key ) => {
		const names = [ humanizeFieldLabel( key ), humanizeFieldLabel( key, labels ) ].map( ( name ) => name.toLowerCase() );

		if ( names.some( ( name ) => seen.has( name ) ) ) {
			return false;
		}

		names.forEach( ( name ) => seen.add( name ) );

		return true;
	} );
};

/**
 * A field beside its own plural ("category" and "categories") is the same
 * thing twice, which dedupeByLabel() cannot tell: "Kategorie" and "Kategorien"
 * are two labels. The plural, which carries every category, stays.
 *
 * @param {string[]} keys
 */
const dropSingulars = ( keys ) =>
	keys.filter( ( key ) => ! keys.includes( `${ key }s` ) && ! ( key.endsWith( 'y' ) && keys.includes( `${ key.slice( 0, -1 ) }ies` ) ) );

/**
 * More products than this side by side are a table nobody can read, and on a
 * phone a page-wide scroll: twelve columns were 1692px in a 343px window.
 */
export const MAX_COMPARED = 4;

/**
 * The products a comparison is of: the first few, which are the best matches.
 *
 * @param {Array<Object>} products Assistant hits.
 */
export const comparedProducts = ( products ) => products.slice( 0, MAX_COMPARED );

/** What a row shows for a product that has no value in it. */
const EMPTY = ' - ';

// WooCommerce stores 0 for a product nobody has reviewed: a rating of 0 reads as a bad one.
const RATING_FIELDS = new Set( [ 'rating', 'average_rating' ] );

/**
 * Whether a value can be shown as text: not a structure of objects, which
 * would read "[object Object]".
 *
 * @param {*} value
 */
const isText = ( value ) =>
	null === value || 'object' !== typeof value || ( Array.isArray( value ) && value.every( ( entry ) => null === entry || 'object' !== typeof entry ) );

// Machine values WooCommerce stores that a shopper should never be shown raw.
const KNOWN_VALUES = () => ( {
	instock: __( 'In stock', 'searcio' ),
	outofstock: __( 'Out of stock', 'searcio' ),
	onbackorder: __( 'On backorder', 'searcio' ),
} );

// Fields whose 1/0 is a flag, not a quantity - "Featured: 1" reads as a bug.
const BOOLEAN_FIELDS = new Set( [ 'featured', 'virtual', 'downloadable', 'backorders_allowed', 'sold_individually' ] );

/**
 * @param {*}      value
 * @param {string} [field] Field name, so a flag isn't shown as a bare 1.
 * @return {string}
 */
const formatValue = ( value, field ) => {
	if ( null === value || undefined === value || '' === value ) {
		return EMPTY;
	}

	if ( field && RATING_FIELDS.has( field ) && 0 === Number( value ) ) {
		return EMPTY;
	}

	if ( field && BOOLEAN_FIELDS.has( field ) ) {
		return ( '1' === String( value ) || true === value )
			? __( 'Yes', 'searcio' )
			: __( 'No', 'searcio' );
	}

	const known = KNOWN_VALUES()[ String( value ).toLowerCase() ];

	if ( known ) {
		return known;
	}

	if ( Array.isArray( value ) ) {
		return value.length > 0 ? value.join( ', ' ) : EMPTY;
	}

	if ( 'boolean' === typeof value ) {
		return value ? __( 'Yes', 'searcio' ) : __( 'No', 'searcio' );
	}

	return String( value );
};

/**
 * The fields a comparison of these products has rows for: the union of their
 * own `source` fields minus the ones the header already shows, one per label,
 * with the rows that differ first. Empty when the products carry nothing but a
 * title, a link, an image and a price - there is then nothing to compare.
 *
 * @param {Array<Object>}         products Assistant hits ({ id, source }).
 * @param {Object<string,string>} [labels] The site's own field names; the
 *                                         storefront config's by default.
 * @return {string[]} Field keys, in display order.
 */
export const comparisonRows = ( products, labels = getConfig().fieldLabels ) => {
	const candidates = [];

	products.forEach( ( product ) => {
		Object.keys( product.source || {} ).forEach( ( key ) => {
			if ( ! HEADER_OR_INTERNAL.has( key ) && ! candidates.includes( key ) ) {
				candidates.push( key );
			}
		} );
	} );

	// A row where every product says the same thing tells a shopper nothing
	// about which to choose, so comparison rows lead with what actually differs.
	const differs = ( key ) => {
		const values = products.map( ( product ) => formatValue( product.source?.[ key ], key ) );

		return values.some( ( value ) => value !== values[ 0 ] );
	};

	const sorted = dedupeByLabel( dropSingulars( candidates.filter( ( key ) => products.every( ( product ) => isText( product.source?.[ key ] ) ) ) ), labels ).sort( ( a, b ) => {
		const diff = Number( differs( b ) ) - Number( differs( a ) );

		return 0 !== diff ? diff : humanizeFieldLabel( a, labels ).localeCompare( humanizeFieldLabel( b, labels ) );
	} );

	// Two keys can carry the same data under two names, which no rule about the
	// names catches. A row that differs between the products and says exactly
	// what an earlier one said is that twice; a row nobody has a value in says
	// nothing. A row that is the same for every product is left alone: two flags
	// that are both "No" are two facts.
	const seen = new Set();

	return sorted.filter( ( key ) => {
		const values = products.map( ( product ) => formatValue( product.source?.[ key ], key ) );

		if ( values.every( ( value ) => EMPTY === value ) ) {
			return false;
		}

		if ( ! differs( key ) ) {
			return true;
		}

		const signature = JSON.stringify( values );

		if ( seen.has( signature ) ) {
			return false;
		}

		seen.add( signature );

		return true;
	} );
};

/**
 * Side-by-side attribute comparison of the assistant's products. The rows are
 * the union of the products' own `source` fields (minus the ones shown in the
 * header), so it adapts to whatever the site indexes - no fixed schema.
 *
 * @param {Object}        props
 * @param {Array<Object>} props.products Assistant hits ({ id, source }).
 * @param {Function}      [props.onOpen] Called with a product and its index when its link is opened.
 */
const CompareTable = ( { products: found, onOpen } ) => {
	const labels = getConfig().fieldLabels;
	const products = comparedProducts( found );
	const rows = comparisonRows( products, labels );

	return (
		<div className="whsc-compare">
			<table className="whsc-compare__table">
				<thead>
					<tr>
						<th className="whsc-compare__corner" />
						{ products.map( ( product, index ) => {
							const source = product.source || {};

							return (
								<th key={ product.id } scope="col">
									<a
										className="whsc-compare__product"
										href={ source.url || '#' }
										{ ...openHandlers( onOpen && ( () => onOpen( product, index ) ) ) }
									>
										<img
											className="whsc-compare__image"
											src={ source.image || PLACEHOLDER_IMAGE_DATA_URI }
											alt=""
											loading="lazy"
										/>
										<span className="whsc-compare__title">{ source.title }</span>
										{ undefined !== source.price && (
											<span className="whsc-compare__price">{ formatPrice( source.price ) }</span>
										) }
									</a>
								</th>
							);
						} ) }
					</tr>
				</thead>
				<tbody>
					{ rows.map( ( key ) => (
						<tr key={ key }>
							<th scope="row" className="whsc-compare__label">{ humanizeFieldLabel( key, labels ) }</th>
							{ products.map( ( product ) => (
								<td key={ product.id }>{ formatValue( product.source?.[ key ], key ) }</td>
							) ) }
						</tr>
					) ) }
				</tbody>
			</table>
			{ found.length > products.length && (
				<p className="whsc-compare__note">
					{ sprintf(
						/* translators: 1: how many products are compared. 2: how many were found. */
						__( 'The first %1$d of the %2$d products are compared.', 'searcio' ),
						products.length,
						found.length
					) }
				</p>
			) }
		</div>
	);
};

export default CompareTable;
