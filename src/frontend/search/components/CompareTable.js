import { __ } from '@wordpress/i18n';

import { formatPrice, PRICE_FIELDS } from '../../../utils/currency';
import { humanizeFieldLabel } from '../../../utils/facets';
import { PLACEHOLDER_IMAGE_DATA_URI } from '../../../utils/placeholderImage';

// Fields shown in the column header (title/image/price) or otherwise not useful
// as comparison rows. Everything else a product carries becomes a row.
const HEADER_OR_INTERNAL = new Set( [
	'id', 'type', 'title', 'url', 'image', 'content', 'excerpt', 'lang', 'score',
	'on_sale', 'product_type', 'in_stock',
	// Every variation's SKU, next to the product's own `sku` row: the same
	// thing again, as a list only a warehouse reads.
	'skus',
	// Bookkeeping the indexer writes. `indexed_at` in particular was showing up
	// as a comparison row, which tells a shopper nothing about the product.
	'indexed_at', 'synced_at', 'updated_at', 'created_at', 'modified', 'date',
	'permalink', 'slug', 'thumbnail', 'images', 'menu_order', 'post_id', 'object_id',
	...PRICE_FIELDS,
] );

/**
 * The same attribute often reaches the index twice - once plainly (`color`) and
 * once prefixed by the WooCommerce attribute indexer (`attr_color`) - which
 * would render two identical rows. Both humanize to the same label, so the
 * label is what decides: first key with a given label wins.
 */
const dedupeByLabel = ( keys ) => {
	const seen = new Set();

	return keys.filter( ( key ) => {
		const label = humanizeFieldLabel( key ).toLowerCase();

		if ( seen.has( label ) ) {
			return false;
		}

		seen.add( label );

		return true;
	} );
};

// Machine values WooCommerce stores that a shopper should never be shown raw.
const KNOWN_VALUES = () => ( {
	instock: __( 'In stock', 'webhead-search-cloud' ),
	outofstock: __( 'Out of stock', 'webhead-search-cloud' ),
	onbackorder: __( 'On backorder', 'webhead-search-cloud' ),
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
		return ' - ';
	}

	if ( field && BOOLEAN_FIELDS.has( field ) ) {
		return ( '1' === String( value ) || true === value )
			? __( 'Yes', 'webhead-search-cloud' )
			: __( 'No', 'webhead-search-cloud' );
	}

	const known = KNOWN_VALUES()[ String( value ).toLowerCase() ];

	if ( known ) {
		return known;
	}

	if ( Array.isArray( value ) ) {
		return value.length > 0 ? value.join( ', ' ) : ' - ';
	}

	if ( 'boolean' === typeof value ) {
		return value ? __( 'Yes', 'webhead-search-cloud' ) : __( 'No', 'webhead-search-cloud' );
	}

	return String( value );
};

/**
 * The fields a comparison of these products has rows for: the union of their
 * own `source` fields minus the ones the header already shows, one per label,
 * with the rows that differ first. Empty when the products carry nothing but a
 * title, a link, an image and a price - there is then nothing to compare.
 *
 * @param {Array<Object>} products Assistant hits ({ id, source }).
 * @return {string[]} Field keys, in display order.
 */
export const comparisonRows = ( products ) => {
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

	return dedupeByLabel( candidates ).sort( ( a, b ) => {
		const diff = Number( differs( b ) ) - Number( differs( a ) );

		return 0 !== diff ? diff : humanizeFieldLabel( a ).localeCompare( humanizeFieldLabel( b ) );
	} );
};

/**
 * Side-by-side attribute comparison of the assistant's products. The rows are
 * the union of the products' own `source` fields (minus the ones shown in the
 * header), so it adapts to whatever the site indexes - no fixed schema.
 *
 * @param {Object}        props
 * @param {Array<Object>} props.products Assistant hits ({ id, source }).
 */
const CompareTable = ( { products } ) => {
	const rows = comparisonRows( products );

	return (
		<div className="whsc-compare">
			<table className="whsc-compare__table">
				<thead>
					<tr>
						<th className="whsc-compare__corner" />
						{ products.map( ( product ) => {
							const source = product.source || {};

							return (
								<th key={ product.id } scope="col">
									<a className="whsc-compare__product" href={ source.url || '#' }>
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
							<th scope="row" className="whsc-compare__label">{ humanizeFieldLabel( key ) }</th>
							{ products.map( ( product ) => (
								<td key={ product.id }>{ formatValue( product.source?.[ key ], key ) }</td>
							) ) }
						</tr>
					) ) }
				</tbody>
			</table>
		</div>
	);
};

export default CompareTable;
