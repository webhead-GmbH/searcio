import { useEffect, useState } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	Icon,
	PanelBody,
	RadioControl,
	RangeControl,
	SelectControl,
	TextControl,
	ToggleControl,
	__experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { search as SearchIcon } from '@wordpress/icons';

import ColorHoverControl from './ColorHoverControl';

/**
 * The Styles inspector, one section per part of the modal. Each row is either a
 * colour (with an optional `hover` sibling, folded into one Default/Hover
 * control), or a size slider. Driven by this config so a hover colour never
 * needs its own separate row — matching the core File/Button blocks.
 */
const STYLE_SECTIONS = [
	{
		title: __( 'Trigger', 'webhead-search-cloud' ),
		rows: [
			{ color: 'triggerIconColor', hover: 'triggerIconColorHover', label: __( 'Icon color', 'webhead-search-cloud' ) },
			{ color: 'triggerBg', hover: 'triggerBgHover', label: __( 'Background', 'webhead-search-cloud' ) },
			{ size: 'triggerIconSize', label: __( 'Icon size', 'webhead-search-cloud' ), max: 60, min: 12 },
			{ size: 'triggerBtnSize', label: __( 'Button size', 'webhead-search-cloud' ), max: 96, min: 28 },
			{ size: 'triggerRadius', label: __( 'Border radius', 'webhead-search-cloud' ), max: 100 },
		],
	},
	{
		title: __( 'Search & AI tabs', 'webhead-search-cloud' ),
		rows: [
			{ color: 'tabText', label: __( 'Tab text', 'webhead-search-cloud' ) },
			{ color: 'tabTextActive', label: __( 'Tab text (active)', 'webhead-search-cloud' ) },
			{ color: 'tabIndicator', label: __( 'Active indicator', 'webhead-search-cloud' ) },
			{ color: 'tabBorder', label: __( 'Divider', 'webhead-search-cloud' ) },
		],
	},
	{
		title: __( 'Modal', 'webhead-search-cloud' ),
		rows: [
			{ color: 'bgColor', label: __( 'Background', 'webhead-search-cloud' ) },
			{ color: 'textColor', label: __( 'Text', 'webhead-search-cloud' ) },
			{ color: 'accentColor', label: __( 'Accent', 'webhead-search-cloud' ) },
			{ size: 'radiusPanel', label: __( 'Corner radius', 'webhead-search-cloud' ), max: 40 },
			{ size: 'modalPadding', label: __( 'Padding', 'webhead-search-cloud' ), max: 80 },
			{ size: 'modalGap', label: __( 'Section spacing', 'webhead-search-cloud' ), max: 80 },
		],
	},
	{
		title: __( 'Search field', 'webhead-search-cloud' ),
		rows: [
			{ color: 'inputBgColor', label: __( 'Background', 'webhead-search-cloud' ) },
			{ color: 'inputTextColor', label: __( 'Text', 'webhead-search-cloud' ) },
			{ color: 'inputIconColor', label: __( 'Icon', 'webhead-search-cloud' ) },
			{ color: 'inputPlaceholderColor', label: __( 'Placeholder', 'webhead-search-cloud' ) },
			{ color: 'inputBorderColor', label: __( 'Border', 'webhead-search-cloud' ) },
			{ color: 'inputBorderFocusColor', label: __( 'Border (focus)', 'webhead-search-cloud' ) },
			{ size: 'inputRadius', label: __( 'Border radius', 'webhead-search-cloud' ), max: 999 },
		],
	},
	{
		title: __( 'Buttons', 'webhead-search-cloud' ),
		rows: [
			{ color: 'btnBg', hover: 'btnBgHover', label: __( 'Search button bg', 'webhead-search-cloud' ) },
			{ color: 'btnText', hover: 'btnTextHover', label: __( 'Search button text', 'webhead-search-cloud' ) },
			{ color: 'iconColor', hover: 'iconColorHover', label: __( 'Icon buttons', 'webhead-search-cloud' ) },
			{ color: 'iconBgHover', label: __( 'Icon button bg (hover)', 'webhead-search-cloud' ) },
			{ color: 'voiceColor', hover: 'voiceColorHover', label: __( 'Voice icon', 'webhead-search-cloud' ) },
			{ color: 'voiceBg', hover: 'voiceBgHover', label: __( 'Voice background', 'webhead-search-cloud' ) },
			{ color: 'closeColor', hover: 'closeColorHover', label: __( 'Close icon', 'webhead-search-cloud' ) },
			{ color: 'closeBg', hover: 'closeBgHover', label: __( 'Close background', 'webhead-search-cloud' ) },
			{ color: 'clearBtnColor', hover: 'clearBtnColorHover', label: __( 'Clear icon', 'webhead-search-cloud' ) },
			{ color: 'clearBtnBg', hover: 'clearBtnBgHover', label: __( 'Clear background', 'webhead-search-cloud' ) },
			{ size: 'btnRadius', label: __( 'Search button radius', 'webhead-search-cloud' ), max: 999 },
		],
	},
	{
		title: __( 'AI Assistant', 'webhead-search-cloud' ),
		rows: [
			{ color: 'assistantAccent', label: __( 'Accent (avatar, dots)', 'webhead-search-cloud' ) },
			{ color: 'assistantText', label: __( 'Reply text', 'webhead-search-cloud' ) },
			{ color: 'assistantUserBg', label: __( 'Your message background', 'webhead-search-cloud' ) },
			{ color: 'assistantUserText', label: __( 'Your message text', 'webhead-search-cloud' ) },
			{ color: 'assistantRowBg', label: __( 'Compare row shading', 'webhead-search-cloud' ) },
		],
	},
	{
		title: __( 'Suggestions', 'webhead-search-cloud' ),
		rows: [
			{ color: 'panelBg', label: __( 'Panel background', 'webhead-search-cloud' ) },
			{ color: 'panelBorder', label: __( 'Panel border', 'webhead-search-cloud' ) },
			{ color: 'suggestionText', hover: 'suggestionTextHover', label: __( 'Item text', 'webhead-search-cloud' ) },
			{ color: 'suggestionBgHover', label: __( 'Item background (hover)', 'webhead-search-cloud' ) },
			{ size: 'panelRadius', label: __( 'Panel radius', 'webhead-search-cloud' ), max: 40 },
		],
	},
	{
		title: __( 'Recent & popular', 'webhead-search-cloud' ),
		rows: [
			{ color: 'titleColor', label: __( 'Section title', 'webhead-search-cloud' ) },
			{ color: 'chipBg', hover: 'chipBgHover', label: __( 'Chip background', 'webhead-search-cloud' ) },
			{ color: 'chipText', hover: 'chipTextHover', label: __( 'Chip text', 'webhead-search-cloud' ) },
			{ color: 'chipBorder', hover: 'chipBorderHover', label: __( 'Chip border', 'webhead-search-cloud' ) },
			{ color: 'clearText', hover: 'clearTextHover', label: __( 'Clear all', 'webhead-search-cloud' ) },
			{ color: 'clearBgHover', label: __( 'Clear all bg (hover)', 'webhead-search-cloud' ) },
			{ color: 'clearTextActive', label: __( 'Clear all (active)', 'webhead-search-cloud' ) },
			{ color: 'popularText', hover: 'popularTextHover', label: __( 'Popular text', 'webhead-search-cloud' ) },
			{ color: 'popularBgHover', label: __( 'Popular bg (hover)', 'webhead-search-cloud' ) },
			{ size: 'chipRadius', label: __( 'Chip radius', 'webhead-search-cloud' ), max: 999 },
			{ size: 'popularGap', label: __( 'Popular item spacing', 'webhead-search-cloud' ), max: 24 },
			{ size: 'popularRadius', label: __( 'Popular item radius', 'webhead-search-cloud' ), max: 40 },
		],
	},
	{
		title: __( 'Filters', 'webhead-search-cloud' ),
		rows: [
			{ color: 'facetBg', hover: 'facetBgHover', label: __( 'Background', 'webhead-search-cloud' ) },
			{ color: 'facetText', hover: 'facetTextHover', label: __( 'Text', 'webhead-search-cloud' ) },
			{ color: 'facetBgActive', label: __( 'Background (active)', 'webhead-search-cloud' ) },
			{ color: 'facetTextActive', label: __( 'Text (active)', 'webhead-search-cloud' ) },
			{ color: 'facetCount', label: __( 'Count', 'webhead-search-cloud' ) },
			{ size: 'facetRadius', label: __( 'Border radius', 'webhead-search-cloud' ), max: 999 },
			{ size: 'facetsMaxHeight', label: __( 'Max height (px)', 'webhead-search-cloud' ), max: 400, min: 60 },
		],
	},
	{
		title: __( 'Result cards', 'webhead-search-cloud' ),
		rows: [
			{ color: 'cardBg', label: __( 'Background', 'webhead-search-cloud' ) },
			{ color: 'cardBorder', hover: 'cardBorderHover', label: __( 'Border', 'webhead-search-cloud' ) },
			{ color: 'cardTitle', label: __( 'Title', 'webhead-search-cloud' ) },
			{ color: 'priceColor', label: __( 'Price / meta', 'webhead-search-cloud' ) },
			{ size: 'cardRadius', label: __( 'Border radius', 'webhead-search-cloud' ), max: 40 },
			{ size: 'cardPadding', label: __( 'Padding', 'webhead-search-cloud' ), max: 40 },
		],
	},
	{
		title: __( 'Carousel', 'webhead-search-cloud' ),
		rows: [
			{ color: 'arrowColor', label: __( 'Arrow color', 'webhead-search-cloud' ) },
			{ color: 'arrowBg', label: __( 'Arrow background', 'webhead-search-cloud' ) },
			{ color: 'dotColor', label: __( 'Dot color', 'webhead-search-cloud' ) },
			{ color: 'dotColorActive', label: __( 'Dot color (active)', 'webhead-search-cloud' ) },
			{ size: 'carouselGap', label: __( 'Spacing between items', 'webhead-search-cloud' ), max: 48 },
		],
	},
];

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
	const setSize = ( key ) => ( value ) => setAttributes( { [ key ]: undefined === value ? null : value } );

	const renderRow = ( row ) => {
		if ( row.size ) {
			return (
				<RangeControl
					key={ row.size }
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ row.label }
					value={ attributes[ row.size ] ?? undefined }
					onChange={ setSize( row.size ) }
					min={ row.min ?? 0 }
					max={ row.max }
					allowReset
				/>
			);
		}

		return (
			<ColorHoverControl
				key={ row.color }
				label={ row.label }
				value={ attributes[ row.color ] }
				onChange={ setColor( row.color ) }
				hoverValue={ row.hover ? attributes[ row.hover ] : undefined }
				onHoverChange={ row.hover ? setColor( row.hover ) : undefined }
			/>
		);
	};

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
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Placeholder text', 'webhead-search-cloud' ) }
						value={ placeholder }
						placeholder={ __( 'Search…', 'webhead-search-cloud' ) }
						onChange={ ( value ) => setAttributes( { placeholder: value } ) }
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
				{ STYLE_SECTIONS.map( ( section ) => (
					<PanelBody key={ section.title } title={ section.title } initialOpen={ false }>
						<div style={ { display: 'flex', flexDirection: 'column', gap: '4px' } }>
							{ section.rows.map( renderRow ) }
						</div>
					</PanelBody>
				) ) }
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
					<Text>
						{ 'box' === mode
							? __( 'Search Cloud - search box', 'webhead-search-cloud' )
							: __( 'Search Cloud - search icon', 'webhead-search-cloud' ) }
					</Text>
				</span>
			</div>
		</>
	);
};

export default Edit;
