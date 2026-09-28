import { useEffect, useState } from '@wordpress/element';
import { InspectorControls, PanelColorSettings, useBlockProps } from '@wordpress/block-editor';
import {
	Icon,
	PanelBody,
	RadioControl,
	RangeControl,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import { InputControl } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { search as SearchIcon } from '@wordpress/icons';

const Edit = ( { attributes, setAttributes, clientId } ) => {
	const { instanceId, mode, scopeType, cardSource, highlightsSource, placeholder, enableVoice, searchTrigger, showCount, animation } = attributes;
	const { animationDuration } = attributes;
	const [ postTypes, setPostTypes ] = useState( [] );
	const blockProps = useBlockProps( { className: 'webhead-search-cloud-block-editor' } );

	// A stable per-placement id, saved once into the block's own content so
	// `render.php` can scope the modal's CSS custom properties to this exact
	// instance (the modal is portalled to `document.body`).
	useEffect( () => {
		if ( ! instanceId ) {
			setAttributes( { instanceId: clientId } );
		}
	}, [ instanceId, clientId, setAttributes ] );

	useEffect( () => {
		let cancelled = false;

		apiFetch( { path: '/webhead-search-cloud/v1/indexing/config' } )
			.then( ( response ) => {
				if ( ! cancelled ) {
					setPostTypes( response.post_types || [] );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setPostTypes( [] );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [] );

	const scopeOptions = [
		{ value: '', label: __( 'All types', 'webhead-search-cloud' ) },
		...postTypes
			.filter( ( postType ) => postType.config?.enabled )
			.map( ( postType ) => ( { value: postType.slug, label: postType.label } ) ),
	];

	const setColor = ( key ) => ( value ) => setAttributes( { [ key ]: value || '' } );
	const color = ( key, label ) => ( { value: attributes[ key ], onChange: setColor( key ), label } );
	const setSize = ( key ) => ( value ) => setAttributes( { [ key ]: undefined === value ? null : value } );

	const sizeControl = ( key, label, max, min = 0 ) => (
		<RangeControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ label }
			value={ attributes[ key ] ?? undefined }
			onChange={ setSize( key ) }
			min={ min }
			max={ max }
			allowReset
		/>
	);

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Search settings', 'webhead-search-cloud' ) }>
					<RadioControl
						label={ __( 'Trigger style', 'webhead-search-cloud' ) }
						selected={ mode }
						options={ [
							{ label: __( 'Search box', 'webhead-search-cloud' ), value: 'box' },
							{ label: __( 'Icon button', 'webhead-search-cloud' ), value: 'icon' },
						] }
						onChange={ ( value ) => setAttributes( { mode: value } ) }
					/>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Restrict to type', 'webhead-search-cloud' ) }
						value={ scopeType }
						options={ scopeOptions }
						onChange={ ( value ) => setAttributes( { scopeType: value } ) }
					/>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Card source', 'webhead-search-cloud' ) }
						help={ __( "Design templates per content type in the Search Cloud panel's card builder. Any type without a published template there falls back to this plugin's own card.", 'webhead-search-cloud' ) }
						value={ cardSource }
						options={ [
							{ value: 'plugin', label: __( 'Plugin templates', 'webhead-search-cloud' ) },
							{ value: 'server', label: __( 'Search Cloud templates', 'webhead-search-cloud' ) },
						] }
						onChange={ ( value ) => setAttributes( { cardSource: value } ) }
					/>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Highlights source', 'webhead-search-cloud' ) }
						help={ __( 'What the empty-query "highlights" carousel shows. "Featured" only works once a boolean "featured" custom field is pushed for this type (Indexing tab).', 'webhead-search-cloud' ) }
						value={ highlightsSource }
						options={ [
							{ value: 'newest', label: __( 'Newest', 'webhead-search-cloud' ) },
							{ value: 'featured', label: __( 'Featured', 'webhead-search-cloud' ) },
						] }
						onChange={ ( value ) => setAttributes( { highlightsSource: value } ) }
					/>
					<InputControl
						label={ __( 'Placeholder text', 'webhead-search-cloud' ) }
						value={ placeholder }
						placeholder={ __( 'Search…', 'webhead-search-cloud' ) }
						onValueChange={ ( value ) => setAttributes( { placeholder: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Enable voice search', 'webhead-search-cloud' ) }
						help={ __( 'Shows a microphone button in the modal (browser support required).', 'webhead-search-cloud' ) }
						checked={ Boolean( enableVoice ) }
						onChange={ ( value ) => setAttributes( { enableVoice: value } ) }
					/>
					<RadioControl
						label={ __( 'When to search', 'webhead-search-cloud' ) }
						help={ __( "'While typing' searches automatically after 3 characters; 'On submit' waits for Enter or the Search button.", 'webhead-search-cloud' ) }
						selected={ searchTrigger }
						options={ [
							{ label: __( 'On submit (Enter / button)', 'webhead-search-cloud' ), value: 'submit' },
							{ label: __( 'While typing', 'webhead-search-cloud' ), value: 'type' },
						] }
						onChange={ ( value ) => setAttributes( { searchTrigger: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show result count on filters', 'webhead-search-cloud' ) }
						checked={ Boolean( showCount ) }
						onChange={ ( value ) => setAttributes( { showCount: value } ) }
					/>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Open animation', 'webhead-search-cloud' ) }
						value={ animation }
						options={ [
							{ value: 'none', label: __( 'None', 'webhead-search-cloud' ) },
							{ value: 'fade', label: __( 'Fade', 'webhead-search-cloud' ) },
							{ value: 'slide-down', label: __( 'Slide down', 'webhead-search-cloud' ) },
							{ value: 'slide-up', label: __( 'Slide up', 'webhead-search-cloud' ) },
							{ value: 'zoom', label: __( 'Zoom', 'webhead-search-cloud' ) },
						] }
						onChange={ ( value ) => setAttributes( { animation: value } ) }
					/>
					{ 'none' !== animation && (
						<RangeControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ __( 'Animation duration (ms)', 'webhead-search-cloud' ) }
							value={ animationDuration ?? undefined }
							onChange={ setSize( 'animationDuration' ) }
							min={ 0 }
							max={ 1500 }
							step={ 50 }
							allowReset
						/>
					) }
				</PanelBody>
			</InspectorControls>

			<InspectorControls group="styles">
				<PanelColorSettings
					title={ __( 'Trigger', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'triggerIconColor', __( 'Icon color', 'webhead-search-cloud' ) ),
						color( 'triggerIconColorHover', __( 'Icon color (hover)', 'webhead-search-cloud' ) ),
						color( 'triggerBg', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'triggerBgHover', __( 'Background (hover)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'triggerIconSize', __( 'Icon size', 'webhead-search-cloud' ), 60, 12 ) }
					{ sizeControl( 'triggerBtnSize', __( 'Button size', 'webhead-search-cloud' ), 96, 28 ) }
					{ sizeControl( 'triggerRadius', __( 'Border radius', 'webhead-search-cloud' ), 100 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Modal', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'bgColor', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'textColor', __( 'Text', 'webhead-search-cloud' ) ),
						color( 'accentColor', __( 'Accent', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'radiusPanel', __( 'Corner radius', 'webhead-search-cloud' ), 40 ) }
					{ sizeControl( 'modalPadding', __( 'Padding', 'webhead-search-cloud' ), 80 ) }
					{ sizeControl( 'modalGap', __( 'Section spacing', 'webhead-search-cloud' ), 80 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Search field', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'inputBgColor', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'inputTextColor', __( 'Text', 'webhead-search-cloud' ) ),
						color( 'inputIconColor', __( 'Icon', 'webhead-search-cloud' ) ),
						color( 'inputPlaceholderColor', __( 'Placeholder', 'webhead-search-cloud' ) ),
						color( 'inputBorderColor', __( 'Border', 'webhead-search-cloud' ) ),
						color( 'inputBorderFocusColor', __( 'Border (focus)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'inputRadius', __( 'Border radius', 'webhead-search-cloud' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Buttons', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'btnBg', __( 'Search button bg', 'webhead-search-cloud' ) ),
						color( 'btnBgHover', __( 'Search button bg (hover)', 'webhead-search-cloud' ) ),
						color( 'btnText', __( 'Search button text', 'webhead-search-cloud' ) ),
						color( 'btnTextHover', __( 'Search button text (hover)', 'webhead-search-cloud' ) ),
						color( 'iconColor', __( 'Icon buttons', 'webhead-search-cloud' ) ),
						color( 'iconColorHover', __( 'Icon buttons (hover)', 'webhead-search-cloud' ) ),
						color( 'iconBgHover', __( 'Icon button bg (hover)', 'webhead-search-cloud' ) ),
						color( 'voiceColor', __( 'Voice icon', 'webhead-search-cloud' ) ),
						color( 'voiceColorHover', __( 'Voice icon (hover)', 'webhead-search-cloud' ) ),
						color( 'voiceBg', __( 'Voice bg', 'webhead-search-cloud' ) ),
						color( 'voiceBgHover', __( 'Voice bg (hover)', 'webhead-search-cloud' ) ),
						color( 'closeColor', __( 'Close icon', 'webhead-search-cloud' ) ),
						color( 'closeColorHover', __( 'Close icon (hover)', 'webhead-search-cloud' ) ),
						color( 'closeBg', __( 'Close bg', 'webhead-search-cloud' ) ),
						color( 'closeBgHover', __( 'Close bg (hover)', 'webhead-search-cloud' ) ),
						color( 'visualColor', __( 'Photo icon', 'webhead-search-cloud' ) ),
						color( 'visualColorHover', __( 'Photo icon (hover)', 'webhead-search-cloud' ) ),
						color( 'visualBg', __( 'Photo bg', 'webhead-search-cloud' ) ),
						color( 'visualBgHover', __( 'Photo bg (hover)', 'webhead-search-cloud' ) ),
						color( 'clearBtnColor', __( 'Clear icon', 'webhead-search-cloud' ) ),
						color( 'clearBtnColorHover', __( 'Clear icon (hover)', 'webhead-search-cloud' ) ),
						color( 'clearBtnBg', __( 'Clear bg', 'webhead-search-cloud' ) ),
						color( 'clearBtnBgHover', __( 'Clear bg (hover)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'btnRadius', __( 'Search button radius', 'webhead-search-cloud' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Suggestions', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'panelBg', __( 'Panel background', 'webhead-search-cloud' ) ),
						color( 'panelBorder', __( 'Panel border', 'webhead-search-cloud' ) ),
						color( 'suggestionText', __( 'Item text', 'webhead-search-cloud' ) ),
						color( 'suggestionTextHover', __( 'Item text (hover)', 'webhead-search-cloud' ) ),
						color( 'suggestionBgHover', __( 'Item background (hover)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'panelRadius', __( 'Panel radius', 'webhead-search-cloud' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Recent & popular', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'titleColor', __( 'Section title', 'webhead-search-cloud' ) ),
						color( 'chipBg', __( 'Chip background', 'webhead-search-cloud' ) ),
						color( 'chipText', __( 'Chip text', 'webhead-search-cloud' ) ),
						color( 'chipBorder', __( 'Chip border', 'webhead-search-cloud' ) ),
						color( 'chipBgHover', __( 'Chip background (hover)', 'webhead-search-cloud' ) ),
						color( 'chipTextHover', __( 'Chip text (hover)', 'webhead-search-cloud' ) ),
						color( 'chipBorderHover', __( 'Chip border (hover)', 'webhead-search-cloud' ) ),
						color( 'clearText', __( 'Clear all', 'webhead-search-cloud' ) ),
						color( 'clearTextHover', __( 'Clear all (hover)', 'webhead-search-cloud' ) ),
						color( 'clearTextActive', __( 'Clear all (active)', 'webhead-search-cloud' ) ),
						color( 'popularText', __( 'Popular text', 'webhead-search-cloud' ) ),
						color( 'popularTextHover', __( 'Popular text (hover)', 'webhead-search-cloud' ) ),
						color( 'popularBgHover', __( 'Popular bg (hover)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'chipRadius', __( 'Chip radius', 'webhead-search-cloud' ), 999 ) }
					{ sizeControl( 'popularGap', __( 'Popular item spacing', 'webhead-search-cloud' ), 24 ) }
					{ sizeControl( 'popularRadius', __( 'Popular item radius', 'webhead-search-cloud' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Type filters', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'facetBg', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'facetText', __( 'Text', 'webhead-search-cloud' ) ),
						color( 'facetBgHover', __( 'Background (hover)', 'webhead-search-cloud' ) ),
						color( 'facetTextHover', __( 'Text (hover)', 'webhead-search-cloud' ) ),
						color( 'facetBgActive', __( 'Background (active)', 'webhead-search-cloud' ) ),
						color( 'facetTextActive', __( 'Text (active)', 'webhead-search-cloud' ) ),
						color( 'facetCount', __( 'Count', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'facetRadius', __( 'Border radius', 'webhead-search-cloud' ), 999 ) }
					{ sizeControl( 'facetsMaxHeight', __( 'Max height (px)', 'webhead-search-cloud' ), 400, 60 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Modal tabs', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'tabText', __( 'Tab text', 'webhead-search-cloud' ) ),
						color( 'tabTextActive', __( 'Tab text (active)', 'webhead-search-cloud' ) ),
						color( 'tabIndicator', __( 'Active indicator', 'webhead-search-cloud' ) ),
						color( 'tabBorder', __( 'Divider', 'webhead-search-cloud' ) ),
					] }
				/>

				<PanelColorSettings
					title={ __( 'AI Assistant', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'assistantAccent', __( 'Accent (avatar, dots)', 'webhead-search-cloud' ) ),
						color( 'assistantText', __( 'Reply text', 'webhead-search-cloud' ) ),
						color( 'assistantUserBg', __( 'Your message background', 'webhead-search-cloud' ) ),
						color( 'assistantUserText', __( 'Your message text', 'webhead-search-cloud' ) ),
						color( 'assistantRowBg', __( 'Compare row shading', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'assistantInputRadius', __( 'Message field radius', 'webhead-search-cloud' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Promotional banner', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'bannerBg', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'bannerText', __( 'Text', 'webhead-search-cloud' ) ),
					] }
				/>

				<PanelColorSettings
					title={ __( 'Guided quiz', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'quizQuestion', __( 'Question text', 'webhead-search-cloud' ) ),
						color( 'quizOptionBg', __( 'Answer background', 'webhead-search-cloud' ) ),
						color( 'quizOptionText', __( 'Answer text', 'webhead-search-cloud' ) ),
						color( 'quizOptionBorder', __( 'Answer border', 'webhead-search-cloud' ) ),
						color( 'quizOptionBgHover', __( 'Answer background (hover)', 'webhead-search-cloud' ) ),
						color( 'quizOptionTextHover', __( 'Answer text (hover)', 'webhead-search-cloud' ) ),
						color( 'quizOptionBorderHover', __( 'Answer border (hover)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'quizOptionRadius', __( 'Answer radius', 'webhead-search-cloud' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Result cards', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'cardBg', __( 'Background', 'webhead-search-cloud' ) ),
						color( 'cardBorder', __( 'Border', 'webhead-search-cloud' ) ),
						color( 'cardBorderHover', __( 'Border (hover)', 'webhead-search-cloud' ) ),
						color( 'cardTitle', __( 'Title', 'webhead-search-cloud' ) ),
						color( 'priceColor', __( 'Price / meta', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'cardRadius', __( 'Border radius', 'webhead-search-cloud' ), 40 ) }
					{ sizeControl( 'cardPadding', __( 'Padding', 'webhead-search-cloud' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Carousel', 'webhead-search-cloud' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'arrowColor', __( 'Arrow color', 'webhead-search-cloud' ) ),
						color( 'arrowBg', __( 'Arrow background', 'webhead-search-cloud' ) ),
						color( 'dotColor', __( 'Dot color', 'webhead-search-cloud' ) ),
						color( 'dotColorActive', __( 'Dot color (active)', 'webhead-search-cloud' ) ),
					] }
				>
					{ sizeControl( 'carouselGap', __( 'Spacing between items', 'webhead-search-cloud' ), 48 ) }
				</PanelColorSettings>
			</InspectorControls>

			<div { ...blockProps }>
				<span
					className="webhead-search-cloud-block-preview"
					style={ {
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 16px',
						border: '1px solid #e0e0e0',
						borderRadius: '8px',
						background: '#fff',
						color: '#1e1e1e',
						fontSize: '14px',
						lineHeight: 1.4,
					} }
				>
					<Icon icon={ SearchIcon } size={ 22 } />
					<span>
						{ 'box' === mode
							? __( 'Search Cloud - search box', 'webhead-search-cloud' )
							: __( 'Search Cloud - search icon', 'webhead-search-cloud' ) }
					</span>
				</span>
			</div>
		</>
	);
};

export default Edit;
