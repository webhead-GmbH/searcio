import { Button, ColorIndicator, ColorPicker, Dropdown } from '@wordpress/components';
import { Stack } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

/**
 * One colour: a button with its swatch, its name and its value, which opens a
 * picker. Empty is the storefront's own colour.
 *
 * @param {Object}                 props
 * @param {string}                 props.label
 * @param {string}                 props.value    A CSS colour, or ''.
 * @param {function(string): void} props.onChange
 */
const ColorField = ( { label, value, onChange } ) => (
	<Dropdown
		className="whsc-placement-color"
		popoverProps={ { placement: 'bottom-start' } }
		renderToggle={ ( { isOpen, onToggle } ) => (
			<Button
				__next40pxDefaultSize
				variant="secondary"
				className="whsc-placement-color__toggle"
				aria-expanded={ isOpen }
				onClick={ onToggle }
			>
				<ColorIndicator colorValue={ value || 'transparent' } className="whsc-placement-color__swatch" />
				<span className="whsc-placement-color__name">{ label }</span>
				<span className="whsc-placement-color__value">{ value || __( 'Default', 'searcio' ) }</span>
			</Button>
		) }
		renderContent={ () => (
			<Stack direction="column" gap="sm" className="whsc-placement-color__panel">
				<ColorPicker color={ value || '#ffffff' } enableAlpha onChange={ onChange } />
				<Stack direction="row" gap="sm">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						accessibleWhenDisabled
						disabled={ ! value }
						onClick={ () => onChange( '' ) }
					>
						{ __( 'Use the default', 'searcio' ) }
					</Button>
				</Stack>
			</Stack>
		) }
	/>
);

export default ColorField;
