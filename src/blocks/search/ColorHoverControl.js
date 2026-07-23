import {
	Button,
	ColorIndicator,
	ColorPalette,
	Dropdown,
	Flex,
	FlexItem,
	TabPanel,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

/**
 * The editor's theme colour palette, read from the block-editor store settings
 * (stable, unlike the `__experimental` colour hooks) so the picker shows the
 * same swatches the rest of the editor does.
 *
 * @return {Array<{name?: string, slug?: string, color: string}>} Palette.
 */
const useThemePalette = () =>
	useSelect( ( select ) => {
		const settings = select( blockEditorStore ).getSettings();

		return settings.colors || settings.__experimentalFeatures?.color?.palette?.theme || [];
	}, [] );

/**
 * One colour row, optionally with Default / Hover tabs — the same shape the core
 * File and Button blocks use, so a hover colour lives inside its own field
 * rather than as a separate row. Pass `hoverValue`/`onHoverChange` to get the
 * tabs; omit them for a plain single colour.
 *
 * @param {Object}   props
 * @param {string}   props.label
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.hoverValue]
 * @param {Function} [props.onHoverChange]
 */
const ColorHoverControl = ( { label, value, onChange, hoverValue, onHoverChange } ) => {
	const colors = useThemePalette();
	const hasHover = 'function' === typeof onHoverChange;

	const picker = ( current, setter ) => (
		<ColorPalette
			colors={ colors }
			value={ current || undefined }
			onChange={ ( next ) => setter( next || '' ) }
			enableAlpha
			clearable
			__experimentalIsRenderedInSidebar
		/>
	);

	return (
		<Dropdown
			className="whsc-color-hover"
			contentClassName="whsc-color-hover__popover"
			popoverProps={ { placement: 'left-start', offset: 24 } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					className="whsc-color-hover__toggle"
					onClick={ onToggle }
					aria-expanded={ isOpen }
					style={ { width: '100%', height: 'auto', justifyContent: 'flex-start', padding: '6px 8px' } }
				>
					<Flex justify="flex-start" align="center" gap={ 2 }>
						<span
							aria-hidden="true"
							style={ { display: 'inline-flex', alignItems: 'center', gap: '2px' } }
						>
							<ColorIndicator colorValue={ value || 'transparent' } />
							{ hasHover && <ColorIndicator colorValue={ hoverValue || 'transparent' } /> }
						</span>
						<FlexItem>{ label }</FlexItem>
					</Flex>
				</Button>
			) }
			renderContent={ () => (
				<div className="whsc-color-hover__content" style={ { minWidth: '240px', padding: '8px' } }>
					{ hasHover ? (
						<TabPanel
							className="whsc-color-hover__tabs"
							tabs={ [
								{ name: 'default', title: __( 'Default', 'webhead-search-cloud' ) },
								{ name: 'hover', title: __( 'Hover', 'webhead-search-cloud' ) },
							] }
						>
							{ ( tab ) =>
								'default' === tab.name
									? picker( value, onChange )
									: picker( hoverValue, onHoverChange )
							}
						</TabPanel>
					) : (
						picker( value, onChange )
					) }
				</div>
			) }
		/>
	);
};

export default ColorHoverControl;
