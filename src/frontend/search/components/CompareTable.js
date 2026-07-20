import { __ } from '@wordpress/i18n';

import { formatPrice, PRICE_FIELDS } from '../../../utils/currency';
import { humanizeFieldLabel } from '../../../utils/facets';
import { PLACEHOLDER_IMAGE_DATA_URI } from '../../../utils/placeholderImage';

// Fields shown in the column header (title/image/price) or otherwise not useful
// as comparison rows. Everything else a product carries becomes a row.
const HEADER_OR_INTERNAL = new Set( [
	'id', 'type', 'title', 'url', 'image', 'content', 'excerpt', 'lang', 'score',
	'on_sale', 'product_type', 'in_stock',
	...PRICE_FIELDS,
] );

/**
 * @param {*} value
 * @return {string}
 */
const formatValue = ( value ) => {
	if ( null === value || undefined === value || '' === value ) {
		return '—';
	}

	if ( Array.isArray( value ) ) {
		return value.length > 0 ? value.join( ', ' ) : '—';
	}

	if ( 'boolean' === typeof value ) {
		return value ? __( 'Yes', 'webhead-search-cloud' ) : __( 'No', 'webhead-search-cloud' );
	}

	return String( value );
};

/**
 * Side-by-side attribute comparison of the assistant's products. The rows are
 * the union of the products' own `source` fields (minus the ones shown in the
 * header), so it adapts to whatever the site indexes — no fixed schema.
 *
 * @param {Object}        props
 * @param {Array<Object>} props.products Assistant hits ({ id, source }).
 */
const CompareTable = ( { products } ) => {
	const rows = [];

	products.forEach( ( product ) => {
		Object.keys( product.source || {} ).forEach( ( key ) => {
			if ( ! HEADER_OR_INTERNAL.has( key ) && ! rows.includes( key ) ) {
				rows.push( key );
			}
		} );
	} );

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
								<td key={ product.id }>{ formatValue( product.source?.[ key ] ) }</td>
							) ) }
						</tr>
					) ) }
				</tbody>
			</table>
		</div>
	);
};

export default CompareTable;
