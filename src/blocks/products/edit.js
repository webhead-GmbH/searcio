import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	Icon,
	PanelBody,
	RangeControl,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import { InputControl } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import { grid as GridIcon } from '@wordpress/icons';

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
		? ( documentId || __( 'the product being viewed', 'webhead-search-cloud' ) )
		: `${ filterField || 'categories' } = ${ filterValue || __( 'the category being browsed', 'webhead-search-cloud' ) }`;

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Products', 'webhead-search-cloud' ) }>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Show', 'webhead-search-cloud' ) }
						value={ source }
						options={ [
							{ label: __( 'Similar products', 'webhead-search-cloud' ), value: 'similar' },
							{ label: __( 'Category listing', 'webhead-search-cloud' ), value: 'category' },
						] }
						help={ isSimilar
							? __(
								'Products close in meaning to the one being viewed. Needs AI search on your plan; without it the row stays hidden.',
								'webhead-search-cloud'
							)
							: __(
								'A listing filtered to one category, so your merchandising rules for that category apply - pinned products first, hidden ones left out.',
								'webhead-search-cloud'
							) }
						onChange={ ( value ) => setAttributes( { source: value } ) }
					/>

					<InputControl
						label={ __( 'Heading', 'webhead-search-cloud' ) }
						description={ __( 'Optional. Left empty, the row has no title.', 'webhead-search-cloud' ) }
						value={ heading }
						onValueChange={ ( value ) => setAttributes( { heading: value } ) }
					/>

					{ isSimilar && (
						<InputControl
							label={ __( 'Product', 'webhead-search-cloud' ) }
							description={ __(
								'Leave empty to use whichever product the visitor is viewing - that is what makes this work from a product template.',
								'webhead-search-cloud'
							) }
							value={ documentId }
							onValueChange={ ( value ) => setAttributes( { documentId: value } ) }
						/>
					) }

					{ ! isSimilar && (
						<>
							<InputControl
								label={ __( 'Filter field', 'webhead-search-cloud' ) }
								description={ __( 'A facet field. Defaults to "categories", which is how product categories are indexed.', 'webhead-search-cloud' ) }
								value={ filterField }
								onValueChange={ ( value ) => setAttributes( { filterField: value } ) }
							/>
							<InputControl
								label={ __( 'Filter value', 'webhead-search-cloud' ) }
								description={ __(
									'Leave empty to use whichever category the visitor is browsing.',
									'webhead-search-cloud'
								) }
								value={ filterValue }
								onValueChange={ ( value ) => setAttributes( { filterValue: value } ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Show the merchandising banner', 'webhead-search-cloud' ) }
								help={ __( 'Shown only when a rule for this category actually carries one.', 'webhead-search-cloud' ) }
								checked={ showBanner }
								onChange={ ( value ) => setAttributes( { showBanner: value } ) }
							/>
						</>
					) }

					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Layout', 'webhead-search-cloud' ) }
						value={ layout }
						options={ [
							{ label: __( 'Carousel', 'webhead-search-cloud' ), value: 'carousel' },
							{ label: __( 'Grid', 'webhead-search-cloud' ), value: 'grid' },
						] }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					/>

					<RangeControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'How many products', 'webhead-search-cloud' ) }
						value={ limit ?? ( isSimilar ? 6 : 12 ) }
						min={ 1 }
						// `/search/similar` validates limit at 1-20.
						max={ isSimilar ? 20 : 24 }
						onChange={ ( value ) => setAttributes( { limit: value } ) }
					/>

					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Card source', 'webhead-search-cloud' ) }
						value={ cardSource }
						options={ [
							{ label: __( 'Plugin templates', 'webhead-search-cloud' ), value: 'plugin' },
							{ label: __( 'Search Cloud templates', 'webhead-search-cloud' ), value: 'server' },
						] }
						onChange={ ( value ) => setAttributes( { cardSource: value } ) }
					/>
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
							? __( 'Similar products', 'webhead-search-cloud' )
							: __( 'Category listing', 'webhead-search-cloud' ) }
					</p>
					<p style={ { margin: 0, color: '#757575' } }>{ subject }</p>
				</div>
			</div>
		</>
	);
};

export default Edit;
