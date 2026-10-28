import { useEffect, useState } from '@wordpress/element';
import { InspectorControls, PanelColorSettings, useBlockProps } from '@wordpress/block-editor';
import {
	PanelBody,
	RadioControl,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { Icon, InputControl, SelectControl } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { search as SearchIcon } from '@wordpress/icons';

import { selectProps } from '../../utils/select';
import InspectorStack from '../InspectorStack';

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
		// The item whose value is null is what the select shows for "nothing
		// chosen"; an empty string would show its placeholder instead.
		{ value: null, label: __( 'All types', 'searcio' ) },
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
				<PanelBody title={ __( 'Search settings', 'searcio' ) }>
					<InspectorStack>
						<RadioControl
							label={ __( 'Trigger style', 'searcio' ) }
							selected={ mode }
							options={ [
								{ label: __( 'Search box', 'searcio' ), value: 'box' },
								{ label: __( 'Icon button', 'searcio' ), value: 'icon' },
							] }
							onChange={ ( value ) => setAttributes( { mode: value } ) }
						/>
						<SelectControl
							label={ __( 'Restrict to type', 'searcio' ) }
							{ ...selectProps(
								scopeOptions,
								scopeType,
								( value ) => setAttributes( { scopeType: value ?? '' } )
							) }
						/>
						<SelectControl
							label={ __( 'Card source', 'searcio' ) }
							description={ __( "Design templates per content type in the Searcio panel's card builder. Any type without a published template there falls back to this plugin's own card.", 'searcio' ) }
							{ ...selectProps(
								[
									{ value: 'plugin', label: __( 'Plugin templates', 'searcio' ) },
									{ value: 'server', label: __( 'Searcio templates', 'searcio' ) },
								],
								cardSource,
								( value ) => setAttributes( { cardSource: value } )
							) }
						/>
						<SelectControl
							label={ __( 'Highlights source', 'searcio' ) }
							description={ __( 'What the empty-query "highlights" carousel shows. "Featured" only works once a boolean "featured" custom field is pushed for this type (Indexing tab).', 'searcio' ) }
							{ ...selectProps(
								[
									{ value: 'newest', label: __( 'Newest', 'searcio' ) },
									{ value: 'featured', label: __( 'Featured', 'searcio' ) },
								],
								highlightsSource,
								( value ) => setAttributes( { highlightsSource: value } )
							) }
						/>
						<InputControl
							label={ __( 'Placeholder text', 'searcio' ) }
							value={ placeholder }
							placeholder={ __( 'Search…', 'searcio' ) }
							onValueChange={ ( value ) => setAttributes( { placeholder: value } ) }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Enable voice search', 'searcio' ) }
							help={ __( 'Shows a microphone button in the modal (browser support required).', 'searcio' ) }
							checked={ Boolean( enableVoice ) }
							onChange={ ( value ) => setAttributes( { enableVoice: value } ) }
						/>
						<RadioControl
							label={ __( 'When to search', 'searcio' ) }
							help={ __( "'While typing' searches automatically after 3 characters; 'On submit' waits for Enter or the Search button.", 'searcio' ) }
							selected={ searchTrigger }
							options={ [
								{ label: __( 'On submit (Enter / button)', 'searcio' ), value: 'submit' },
								{ label: __( 'While typing', 'searcio' ), value: 'type' },
							] }
							onChange={ ( value ) => setAttributes( { searchTrigger: value } ) }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Show result count on filters', 'searcio' ) }
							checked={ Boolean( showCount ) }
							onChange={ ( value ) => setAttributes( { showCount: value } ) }
						/>
						<SelectControl
							label={ __( 'Open animation', 'searcio' ) }
							{ ...selectProps(
								[
									{ value: 'none', label: __( 'None', 'searcio' ) },
									{ value: 'fade', label: __( 'Fade', 'searcio' ) },
									{ value: 'slide-down', label: __( 'Slide down', 'searcio' ) },
									{ value: 'slide-up', label: __( 'Slide up', 'searcio' ) },
									{ value: 'zoom', label: __( 'Zoom', 'searcio' ) },
								],
								animation,
								( value ) => setAttributes( { animation: value } )
							) }
						/>
						{ 'none' !== animation && (
							<RangeControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label={ __( 'Animation duration (ms)', 'searcio' ) }
								value={ animationDuration ?? undefined }
								onChange={ setSize( 'animationDuration' ) }
								min={ 0 }
								max={ 1500 }
								step={ 50 }
								allowReset
							/>
						) }
					</InspectorStack>
				</PanelBody>
			</InspectorControls>

			<InspectorControls group="styles">
				<PanelColorSettings
					title={ __( 'Trigger', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'triggerIconColor', __( 'Icon color', 'searcio' ) ),
						color( 'triggerIconColorHover', __( 'Icon color (hover)', 'searcio' ) ),
						color( 'triggerBg', __( 'Background', 'searcio' ) ),
						color( 'triggerBgHover', __( 'Background (hover)', 'searcio' ) ),
					] }
				>
					<InspectorStack>
						{ sizeControl( 'triggerIconSize', __( 'Icon size', 'searcio' ), 60, 12 ) }
						{ sizeControl( 'triggerBtnSize', __( 'Button size', 'searcio' ), 96, 28 ) }
						{ sizeControl( 'triggerRadius', __( 'Border radius', 'searcio' ), 100 ) }
					</InspectorStack>
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Modal', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'bgColor', __( 'Background', 'searcio' ) ),
						color( 'textColor', __( 'Text', 'searcio' ) ),
						color( 'accentColor', __( 'Accent', 'searcio' ) ),
					] }
				>
					<InspectorStack>
						{ sizeControl( 'radiusPanel', __( 'Corner radius', 'searcio' ), 40 ) }
						{ sizeControl( 'modalPadding', __( 'Padding', 'searcio' ), 80 ) }
						{ sizeControl( 'modalGap', __( 'Section spacing', 'searcio' ), 80 ) }
					</InspectorStack>
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Search field', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'inputBgColor', __( 'Background', 'searcio' ) ),
						color( 'inputTextColor', __( 'Text', 'searcio' ) ),
						color( 'inputIconColor', __( 'Icon', 'searcio' ) ),
						color( 'inputPlaceholderColor', __( 'Placeholder', 'searcio' ) ),
						color( 'inputBorderColor', __( 'Border', 'searcio' ) ),
						color( 'inputBorderFocusColor', __( 'Border (focus)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'inputRadius', __( 'Border radius', 'searcio' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Buttons', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'btnBg', __( 'Search button bg', 'searcio' ) ),
						color( 'btnBgHover', __( 'Search button bg (hover)', 'searcio' ) ),
						color( 'btnText', __( 'Search button text', 'searcio' ) ),
						color( 'btnTextHover', __( 'Search button text (hover)', 'searcio' ) ),
						color( 'iconColor', __( 'Icon buttons', 'searcio' ) ),
						color( 'iconColorHover', __( 'Icon buttons (hover)', 'searcio' ) ),
						color( 'iconBgHover', __( 'Icon button bg (hover)', 'searcio' ) ),
						color( 'voiceColor', __( 'Voice icon', 'searcio' ) ),
						color( 'voiceColorHover', __( 'Voice icon (hover)', 'searcio' ) ),
						color( 'voiceBg', __( 'Voice bg', 'searcio' ) ),
						color( 'voiceBgHover', __( 'Voice bg (hover)', 'searcio' ) ),
						color( 'closeColor', __( 'Close icon', 'searcio' ) ),
						color( 'closeColorHover', __( 'Close icon (hover)', 'searcio' ) ),
						color( 'closeBg', __( 'Close bg', 'searcio' ) ),
						color( 'closeBgHover', __( 'Close bg (hover)', 'searcio' ) ),
						color( 'visualColor', __( 'Photo icon', 'searcio' ) ),
						color( 'visualColorHover', __( 'Photo icon (hover)', 'searcio' ) ),
						color( 'visualBg', __( 'Photo bg', 'searcio' ) ),
						color( 'visualBgHover', __( 'Photo bg (hover)', 'searcio' ) ),
						color( 'clearBtnColor', __( 'Clear icon', 'searcio' ) ),
						color( 'clearBtnColorHover', __( 'Clear icon (hover)', 'searcio' ) ),
						color( 'clearBtnBg', __( 'Clear bg', 'searcio' ) ),
						color( 'clearBtnBgHover', __( 'Clear bg (hover)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'btnRadius', __( 'Search button radius', 'searcio' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Suggestions', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'panelBg', __( 'Panel background', 'searcio' ) ),
						color( 'panelBorder', __( 'Panel border', 'searcio' ) ),
						color( 'suggestionText', __( 'Item text', 'searcio' ) ),
						color( 'suggestionTextHover', __( 'Item text (hover)', 'searcio' ) ),
						color( 'suggestionBgHover', __( 'Item background (hover)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'panelRadius', __( 'Panel radius', 'searcio' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Recent & popular', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'titleColor', __( 'Section title', 'searcio' ) ),
						color( 'chipBg', __( 'Chip background', 'searcio' ) ),
						color( 'chipText', __( 'Chip text', 'searcio' ) ),
						color( 'chipBorder', __( 'Chip border', 'searcio' ) ),
						color( 'chipBgHover', __( 'Chip background (hover)', 'searcio' ) ),
						color( 'chipTextHover', __( 'Chip text (hover)', 'searcio' ) ),
						color( 'chipBorderHover', __( 'Chip border (hover)', 'searcio' ) ),
						color( 'clearText', __( 'Clear all', 'searcio' ) ),
						color( 'clearTextHover', __( 'Clear all (hover)', 'searcio' ) ),
						color( 'clearTextActive', __( 'Clear all (active)', 'searcio' ) ),
						color( 'popularText', __( 'Popular text', 'searcio' ) ),
						color( 'popularTextHover', __( 'Popular text (hover)', 'searcio' ) ),
						color( 'popularBgHover', __( 'Popular bg (hover)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'chipRadius', __( 'Chip radius', 'searcio' ), 999 ) }
					{ sizeControl( 'popularGap', __( 'Popular item spacing', 'searcio' ), 24 ) }
					{ sizeControl( 'popularRadius', __( 'Popular item radius', 'searcio' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Type filters', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'facetBg', __( 'Background', 'searcio' ) ),
						color( 'facetText', __( 'Text', 'searcio' ) ),
						color( 'facetBgHover', __( 'Background (hover)', 'searcio' ) ),
						color( 'facetTextHover', __( 'Text (hover)', 'searcio' ) ),
						color( 'facetBgActive', __( 'Background (active)', 'searcio' ) ),
						color( 'facetTextActive', __( 'Text (active)', 'searcio' ) ),
						color( 'facetCount', __( 'Count', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'facetRadius', __( 'Border radius', 'searcio' ), 999 ) }
					{ sizeControl( 'facetsMaxHeight', __( 'Max height (px)', 'searcio' ), 400, 60 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Modal tabs', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'tabText', __( 'Tab text', 'searcio' ) ),
						color( 'tabTextActive', __( 'Tab text (active)', 'searcio' ) ),
						color( 'tabIndicator', __( 'Active indicator', 'searcio' ) ),
						color( 'tabBorder', __( 'Divider', 'searcio' ) ),
					] }
				/>

				<PanelColorSettings
					title={ __( 'AI Assistant', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'assistantAccent', __( 'Accent (avatar, dots)', 'searcio' ) ),
						color( 'assistantText', __( 'Reply text', 'searcio' ) ),
						color( 'assistantUserBg', __( 'Your message background', 'searcio' ) ),
						color( 'assistantUserText', __( 'Your message text', 'searcio' ) ),
						color( 'assistantRowBg', __( 'Compare row shading', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'assistantInputRadius', __( 'Message field radius', 'searcio' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Promotional banner', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'bannerBg', __( 'Background', 'searcio' ) ),
						color( 'bannerText', __( 'Text', 'searcio' ) ),
					] }
				/>

				<PanelColorSettings
					title={ __( 'Guided quiz', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'quizQuestion', __( 'Question text', 'searcio' ) ),
						color( 'quizOptionBg', __( 'Answer background', 'searcio' ) ),
						color( 'quizOptionText', __( 'Answer text', 'searcio' ) ),
						color( 'quizOptionBorder', __( 'Answer border', 'searcio' ) ),
						color( 'quizOptionBgHover', __( 'Answer background (hover)', 'searcio' ) ),
						color( 'quizOptionTextHover', __( 'Answer text (hover)', 'searcio' ) ),
						color( 'quizOptionBorderHover', __( 'Answer border (hover)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'quizOptionRadius', __( 'Answer radius', 'searcio' ), 999 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Result cards', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'cardBg', __( 'Background', 'searcio' ) ),
						color( 'cardBorder', __( 'Border', 'searcio' ) ),
						color( 'cardBorderHover', __( 'Border (hover)', 'searcio' ) ),
						color( 'cardTitle', __( 'Title', 'searcio' ) ),
						color( 'priceColor', __( 'Price / meta', 'searcio' ) ),
						color( 'stockInColor', __( 'In stock', 'searcio' ) ),
						color( 'stockOutColor', __( 'Out of stock', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'cardRadius', __( 'Border radius', 'searcio' ), 40 ) }
					{ sizeControl( 'cardPadding', __( 'Padding', 'searcio' ), 40 ) }
				</PanelColorSettings>

				<PanelColorSettings
					title={ __( 'Carousel', 'searcio' ) }
					initialOpen={ false }
					colorSettings={ [
						color( 'arrowColor', __( 'Arrow color', 'searcio' ) ),
						color( 'arrowBg', __( 'Arrow background', 'searcio' ) ),
						color( 'dotColor', __( 'Dot color', 'searcio' ) ),
						color( 'dotColorActive', __( 'Dot color (active)', 'searcio' ) ),
					] }
				>
					{ sizeControl( 'carouselGap', __( 'Spacing between items', 'searcio' ), 48 ) }
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
							? __( 'Searcio - search box', 'searcio' )
							: __( 'Searcio - search icon', 'searcio' ) }
					</span>
				</span>
			</div>
		</>
	);
};

export default Edit;
