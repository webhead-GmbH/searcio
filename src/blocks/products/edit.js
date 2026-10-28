import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	PanelBody,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { Icon, InputControl, SelectControl } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import { grid as GridIcon } from '@wordpress/icons';

import { selectProps } from '../../utils/select';
import InspectorStack from '../InspectorStack';

/**
 * The row is rendered from live catalogue data, which the editor has no way to
 * fetch for an arbitrary product or category, so the canvas shows what the
 * block will do rather than a fake preview of products that may not be the
 * ones a visitor sees.
 */
const Edit = ( { attributes, setAttributes } ) => {
	const { source, documentId, filterField, filterValue, heading, limit, layout, showBanner, cardSource } = attributes;
	const blockProps = useBlockProps( { className: 'webhead-search-cloud-block-editor' } );

	const isSimilar = 'similar' === source;

	const subject = isSimilar
		? ( documentId || __( 'the product being viewed', 'searcio' ) )
		: `${ filterField || 'categories' } = ${ filterValue || __( 'the category being browsed', 'searcio' ) }`;

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Products', 'searcio' ) }>
					<InspectorStack>
						<SelectControl
							label={ __( 'Show', 'searcio' ) }
							{ ...selectProps(
								[
									{ label: __( 'Similar products', 'searcio' ), value: 'similar' },
									{ label: __( 'Category listing', 'searcio' ), value: 'category' },
								],
								source,
								( value ) => setAttributes( { source: value } )
							) }
							description={ isSimilar
								? __(
									'Products close in meaning to the one being viewed. Needs AI search on your plan; without it the row stays hidden.',
									'searcio'
								)
								: __(
									'A listing filtered to one category, so your merchandising rules for that category apply - pinned products first, hidden ones left out.',
									'searcio'
								) }
						/>

						<InputControl
							label={ __( 'Heading', 'searcio' ) }
							description={ __( 'Optional. Left empty, the row has no title.', 'searcio' ) }
							value={ heading }
							onValueChange={ ( value ) => setAttributes( { heading: value } ) }
						/>

						{ isSimilar && (
							<InputControl
								label={ __( 'Product', 'searcio' ) }
								description={ __(
									'Leave empty to use whichever product the visitor is viewing - that is what makes this work from a product template.',
									'searcio'
								) }
								value={ documentId }
								onValueChange={ ( value ) => setAttributes( { documentId: value } ) }
							/>
						) }

						{ ! isSimilar && (
							<InspectorStack>
								<InputControl
									label={ __( 'Filter field', 'searcio' ) }
									description={ __( 'A facet field. Defaults to "categories", which is how product categories are indexed.', 'searcio' ) }
									value={ filterField }
									onValueChange={ ( value ) => setAttributes( { filterField: value } ) }
								/>
								<InputControl
									label={ __( 'Filter value', 'searcio' ) }
									description={ __(
										'Leave empty to use whichever category the visitor is browsing.',
										'searcio'
									) }
									value={ filterValue }
									onValueChange={ ( value ) => setAttributes( { filterValue: value } ) }
								/>
								<ToggleControl
									__nextHasNoMarginBottom
									label={ __( 'Show the merchandising banner', 'searcio' ) }
									help={ __( 'Shown only when a rule for this category actually carries one.', 'searcio' ) }
									checked={ showBanner }
									onChange={ ( value ) => setAttributes( { showBanner: value } ) }
								/>
							</InspectorStack>
						) }

						<SelectControl
							label={ __( 'Layout', 'searcio' ) }
							{ ...selectProps(
								[
									{ label: __( 'Carousel', 'searcio' ), value: 'carousel' },
									{ label: __( 'Grid', 'searcio' ), value: 'grid' },
								],
								layout,
								( value ) => setAttributes( { layout: value } )
							) }
						/>

						<RangeControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'How many products', 'searcio' ) }
							value={ limit ?? ( isSimilar ? 6 : 12 ) }
							min={ 1 }
							// `/search/similar` validates limit at 1-20.
							max={ isSimilar ? 20 : 24 }
							onChange={ ( value ) => setAttributes( { limit: value } ) }
						/>

						<SelectControl
							label={ __( 'Card source', 'searcio' ) }
							{ ...selectProps(
								[
									{ label: __( 'Plugin templates', 'searcio' ), value: 'plugin' },
									{ label: __( 'Searcio templates', 'searcio' ), value: 'server' },
								],
								cardSource,
								( value ) => setAttributes( { cardSource: value } )
							) }
						/>
					</InspectorStack>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<div className="webhead-search-cloud-block-editor__preview">
					<Icon icon={ GridIcon } />
					{ /* Plain elements with literal values, like the search block's
					     preview: this renders in the editor canvas, which does not
					     get wp-admin's design-token sheet, so a --wpds-* colour or a
					     @wordpress/ui component's injected styles cannot be relied on
					     here. The values reproduce what the muted Text drew. */ }
					<p style={ { margin: 0 } }>
						{ isSimilar
							? __( 'Similar products', 'searcio' )
							: __( 'Category listing', 'searcio' ) }
					</p>
					<p style={ { margin: 0, color: '#757575' } }>{ subject }</p>
				</div>
			</div>
		</>
	);
};

export default Edit;
