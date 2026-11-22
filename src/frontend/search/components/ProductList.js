import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { currentLangFilter, fetchCardTemplates, fetchSimilar, isConfigured, isLanguageSupported, productType, search, trackClick } from '../../../utils/api';
import { buildFilterParams } from '../../../utils/facets';
import { ResultCard } from './templates';
import Carousel from './Carousel';
import SearchResultsSkeleton from './SearchResultsSkeleton';

/**
 * A row of products placed somewhere on the storefront rather than inside the
 * search modal. Two sources, one component because everything after the fetch
 * is identical:
 *
 * - `similar` - "more like this" for the product being viewed
 *   (`GET /search/similar`). Semantic, so a site without AI search answers with
 *   an empty list and the row simply does not appear.
 * - `category` - a filtered search standing in for a category listing, which is
 *   what makes a merchandising rule's category trigger fire: the rule only
 *   applies to a request that actually carries `filter[field]=value`
 *   (`docs/api/search-config.md`, "Merchandising rules"). Pinned products come
 *   back first, hidden ones are already gone, and the rule's banner arrives
 *   with the response.
 *
 * Renders nothing at all when there is nothing to show. A recommendations row
 * that leaves an empty box behind is worse than no row.
 *
 * @param {Object}  props
 * @param {string}  props.source            'similar' or 'category'.
 * @param {string}  [props.documentId]      Source product, for 'similar'.
 * @param {string}  [props.filterField]     Facet field, for 'category'.
 * @param {string}  [props.filterValue]     Facet value, for 'category'.
 * @param {string}  [props.heading]         Shown above the row; omitted when empty.
 * @param {number}  [props.limit]           How many products to ask for.
 * @param {string}  [props.layout]          'carousel' (default) or 'grid'.
 * @param {boolean} [props.showBanner]      Render the merchandising banner ('category').
 * @param {string}  [props.cardSource]      Passed through to ResultCard. With
 *                                          `server`, the row asks for the card
 *                                          templates designed in Searcio itself.
 */
const ProductList = ( {
	source,
	documentId,
	filterField,
	filterValue,
	heading,
	limit,
	layout,
	showBanner,
	cardSource,
} ) => {
	const [ products, setProducts ] = useState( null );
	// The templates designed in Searcio, for a row set to draw them: it was
	// never given any, so "Searcio templates" drew the plugin's cards.
	const [ serverTemplates, setServerTemplates ] = useState( [] );
	const [ banner, setBanner ] = useState( '' );
	// The `search_id` the row's clicks are attributed to: the category row's
	// `/search`, or the `/search/similar` list (a service that does not record
	// those answers with none, and a click then sends nothing).
	const [ searchId, setSearchId ] = useState( '' );
	const abortRef = useRef( null );

	// Asked once, and kept for the page as the search window keeps them; a
	// failure leaves the plugin's cards, never an empty row.
	useEffect( () => {
		if ( 'server' !== cardSource || ! isConfigured() ) {
			return undefined;
		}

		let cancelled = false;

		fetchCardTemplates()
			.then( ( response ) => {
				if ( ! cancelled ) {
					setServerTemplates( Array.isArray( response?.templates ) ? response.templates : [] );
				}
			} )
			.catch( () => {} );

		return () => {
			cancelled = true;
		};
	}, [ cardSource ] );

	useEffect( () => {
		// An unsupported visitor language would otherwise be served products
		// from the wrong catalogue, which is worse than showing no row.
		if ( ! isConfigured() || ! isLanguageSupported() ) {
			setProducts( [] );

			return undefined;
		}

		const controller = new AbortController();
		abortRef.current = controller;

		const load = async () => {
			try {
				if ( 'similar' === source ) {
					if ( ! documentId ) {
						setProducts( [] );

						return;
					}

					const response = await fetchSimilar( documentId, {
						limit: limit || 6,
						signal: controller.signal,
					} );

					setProducts( Array.isArray( response?.similar ) ? response.similar : [] );
					setSearchId( 'string' === typeof response?.search_id ? response.search_id : '' );

					return;
				}

				if ( ! filterField || ! filterValue ) {
					setProducts( [] );

					return;
				}

				// The posts filed under a category of the same name are not
				// products.
				const response = await search( '', {
					type: productType(),
					filters: buildFilterParams( { [ filterField ]: [ filterValue ] }, currentLangFilter() ),
					perPage: limit || 12,
					surface: 'category',
					signal: controller.signal,
				} );

				setProducts( Array.isArray( response?.hits ) ? response.hits : [] );
				setBanner( 'string' === typeof response?.banner ? response.banner : '' );
				setSearchId( 'string' === typeof response?.search_id ? response.search_id : '' );
			} catch ( e ) {
				if ( 'AbortError' !== e.name ) {
					// Merchandising is an enhancement, never a blocker: a failure
					// leaves the page exactly as it would have been without it.
					setProducts( [] );
				}
			}
		};

		void load();

		return () => controller.abort();
	}, [ source, documentId, filterField, filterValue, limit ] );

	if ( null === products ) {
		return (
			<div className="whsc-products whsc-products--loading">
				<SearchResultsSkeleton />
			</div>
		);
	}

	const hasBanner = showBanner && '' !== banner;

	if ( 0 === products.length && ! hasBanner ) {
		return null;
	}

	return (
		<div className={ `whsc-products whsc-products--${ 'grid' === layout ? 'grid' : 'carousel' }` }>
			{ hasBanner && (
				<p className="whsc-banner" role="status">{ banner }</p>
			) }

			{ heading && products.length > 0 && (
				<h2 className="whsc-products__heading">{ heading }</h2>
			) }

			{ products.length > 0 && (
				'grid' === layout ? (
					<div className="whsc-products__grid">
						{ products.map( ( hit, index ) => (
							<ResultCard
								key={ hit.id }
								hit={ hit }
								cardSource={ cardSource }
								serverTemplates={ serverTemplates }
								onClick={ () => trackClick( searchId, hit.id, index + 1 ) }
							/>
						) ) }
					</div>
				) : (
					<Carousel
						items={ products }
						getKey={ ( hit ) => hit.id }
						renderItem={ ( hit, index ) => (
							<ResultCard
								hit={ hit }
								cardSource={ cardSource }
								serverTemplates={ serverTemplates }
								onClick={ () => trackClick( searchId, hit.id, index + 1 ) }
							/>
						) }
						ariaLabel={ heading || __( 'Products', 'searcio' ) }
					/>
				)
			) }
		</div>
	);
};

export default ProductList;
