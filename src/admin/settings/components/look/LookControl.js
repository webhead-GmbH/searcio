import { useId, useState } from '@wordpress/element';
import { BorderControl, Button, ComboboxControl, RangeControl } from '@wordpress/components';
import { Field, Fieldset, Icon, InputControl, SelectControl, Stack, SwitchControl, Text, VisuallyHidden } from '@wordpress/ui';
import { chevronDown, chevronUp, desktop, mobile, tablet } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

import { forDevice, hasOwn, isResponsive, withDevice } from '../../look';
import { selectProps } from '../../../../utils/select';
import ColorField from './ColorField';

const DEVICE_ICONS = { desktop, tablet, mobile };

/** The name a screen reader gives the device a value is for. */
const deviceNote = ( device ) => ( {
	desktop: __( 'for desktops', 'searcio' ),
	tablet: __( 'for tablets', 'searcio' ),
	mobile: __( 'for phones', 'searcio' ),
}[ device ] );

/**
 * A control's name, with its unit and, for one set per device, the device
 * the value on screen is for.
 */
const Label = ( { label, unit, device } ) => (
	<span className="whsc-look-label">
		<span>{ label }</span>
		{ unit ? <span className="whsc-look-label__unit">{ unit }</span> : null }
		{ device ? (
			<>
				<Icon icon={ DEVICE_ICONS[ device ] } size={ 16 } className="whsc-look-label__device" aria-hidden="true" />
				<VisuallyHidden>{ deviceNote( device ) }</VisuallyHidden>
			</>
		) : null }
	</span>
);

/** The same name as words, for a control that takes its name as a string. */
const labelText = ( label, unit, device ) => [ unit ? `${ label } (${ unit })` : label, device ? deviceNote( device ) : '' ].filter( Boolean ).join( ', ' );

/** What a device without a value of its own shows under the control. */
const inheritedHelp = ( value, device ) =>
	'desktop' !== device && ! hasOwn( value, device ) && undefined !== forDevice( value, device )
		? __( 'The same as on a larger screen, until you change it here.', 'searcio' )
		: undefined;

/**
 * A number on a slider. Empty is the storefront's own; a device without a
 * value takes the larger one's, and shows it.
 */
const SizeControl = ( { label, unit, min, max, step = 1, value, device, responsive, onChange } ) => {
	const shown = responsive ? forDevice( value, device ) : value;

	// The slider names its number field with its label, which has to be words;
	// the name with its unit and its device's icon is drawn over it.
	return (
		<Stack direction="column" gap="xs" className="whsc-look-size">
			<Field.VisualLabel aria-hidden="true">
				<Label label={ label } unit={ unit } device={ responsive ? device : null } />
			</Field.VisualLabel>
			<RangeControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				hideLabelFromVision
				label={ labelText( label, unit, responsive ? device : null ) }
				help={ responsive ? inheritedHelp( value, device ) : undefined }
				min={ min }
				max={ max }
				step={ step }
				allowReset
				resetFallbackValue={ undefined }
				value={ undefined === shown ? undefined : Number( shown ) }
				onChange={ ( next ) => {
					const number = Number.isFinite( next ) ? next : undefined;

					onChange( responsive ? withDevice( value, device, number ) : number );
				} }
			/>
		</Stack>
	);
};

/**
 * Four numbers of px, top, right, bottom and left, per device. One side typed
 * gives the others 0, as the storefront writes them all at once.
 */
const SpacingControl = ( { label, max, value, device, onChange } ) => {
	const sides = forDevice( value, device );
	const names = [ __( 'Top', 'searcio' ), __( 'Right', 'searcio' ), __( 'Bottom', 'searcio' ), __( 'Left', 'searcio' ) ];

	const setSide = ( index, text ) => {
		const next = Array.isArray( sides ) ? [ ...sides ] : [ 0, 0, 0, 0 ];
		const number = parseInt( text, 10 );

		next[ index ] = Number.isFinite( number ) ? Math.min( max, Math.max( 0, number ) ) : 0;
		onChange( withDevice( value, device, next ) );
	};

	return (
		<Fieldset.Root className="whsc-look-spacing">
			<Fieldset.Legend>
				<Label label={ label } unit="px" device={ device } />
			</Fieldset.Legend>
			<div className="whsc-look-spacing__sides">
				{ names.map( ( name, index ) => (
					<InputControl
						key={ name }
						type="number"
						min={ 0 }
						max={ max }
						label={ name }
						value={ Array.isArray( sides ) ? String( sides[ index ] ) : '' }
						onValueChange={ ( text ) => setSide( index, text ) }
					/>
				) ) }
			</div>
			<Stack direction="row" gap="sm" align="center" wrap="wrap">
				{ inheritedHelp( value, device ) ? (
					<Text render={ <p /> } variant="body-sm" className="whsc-look-help">
						{ inheritedHelp( value, device ) }
					</Text>
				) : null }
				<Button
					__next40pxDefaultSize
					variant="tertiary"
					accessibleWhenDisabled
					disabled={ ! hasOwn( value, device ) }
					onClick={ () => onChange( withDevice( value, device, undefined ) ) }
				>
					{ __( 'Reset', 'searcio' ) }
				</Button>
			</Stack>
		</Fieldset.Root>
	);
};

/** A choice of the widget's; its first, '', is the storefront's own. */
const ChoiceControl = ( { label, options, value, onChange } ) => {
	const items = Object.entries( options || {} ).map( ( [ option, name ] ) => ( { value: '' === option ? null : option, label: name } ) );

	return (
		<SelectControl
			label={ label }
			{ ...selectProps( items, value, ( next ) => onChange( next || undefined ) ) }
		/>
	);
};

const googleLabel = ( family ) => sprintf(
	/* translators: %s: name of a font family. */
	__( '%s (Google Fonts)', 'searcio' ),
	family
);

/**
 * A font family: the site's own, or one of Google's, which is loaded from
 * Google's servers for a visitor who opens the search.
 */
const FontControl = ( { label, value, fonts, onChange } ) => (
	<ComboboxControl
		__next40pxDefaultSize
		__nextHasNoMarginBottom
		label={ label }
		help={ fonts.some( ( font ) => font.google && font.value === value )
			? __( 'A Google font: the visitor\'s browser loads it from Google\'s servers when the search opens.', 'searcio' )
			: undefined }
		value={ value || null }
		placeholder={ __( 'The theme\'s font', 'searcio' ) }
		options={ fonts.map( ( font ) => ( { value: font.value, label: font.google ? googleLabel( font.label ) : font.label } ) ) }
		allowReset
		onChange={ ( next ) => onChange( next || undefined ) }
	/>
);

/** A line round a box: its style, its width and its colour. */
const BorderField = ( { label, value, onChange } ) => (
	<BorderControl
		__next40pxDefaultSize
		label={ label }
		colors={ [] }
		enableAlpha
		enableStyle
		withSlider
		disableUnits
		value={ value ? { ...value, width: undefined === value.width ? undefined : `${ value.width }px` } : undefined }
		onChange={ ( next ) => {
			const width = parseInt( next?.width, 10 );

			onChange( next ? {
				...( next.style ? { style: next.style } : {} ),
				...( Number.isFinite( width ) ? { width: Math.min( 20, Math.max( 0, width ) ) } : {} ),
				...( next.color ? { color: next.color } : {} ),
			} : undefined );
		} }
	/>
);

/**
 * The family, weight, slant, case, line, size, line height and spacing of
 * letters of a part, under its button, which opens and closes them. The
 * three sizes are per device.
 */
const TypographyControl = ( { label, value, device, fonts, onChange } ) => {
	const [ isOpen, setIsOpen ] = useState( false );
	const panelId = useId();
	const current = value || {};
	const set = ( key, next ) => {
		const out = { ...current };

		if ( undefined === next || null === next || '' === next ) {
			delete out[ key ];
		} else {
			out[ key ] = next;
		}

		onChange( out );
	};

	const weights = [
		{ value: null, label: __( 'Default', 'searcio' ) },
		{ value: '100', label: __( '100 - Thin', 'searcio' ) },
		{ value: '200', label: __( '200 - Extra light', 'searcio' ) },
		{ value: '300', label: __( '300 - Light', 'searcio' ) },
		{ value: '400', label: __( '400 - Normal', 'searcio' ) },
		{ value: '500', label: __( '500 - Medium', 'searcio' ) },
		{ value: '600', label: __( '600 - Semi bold', 'searcio' ) },
		{ value: '700', label: __( '700 - Bold', 'searcio' ) },
		{ value: '800', label: __( '800 - Extra bold', 'searcio' ) },
		{ value: '900', label: __( '900 - Black', 'searcio' ) },
	];
	const styles = [
		{ value: null, label: __( 'Default', 'searcio' ) },
		{ value: 'normal', label: __( 'Normal', 'searcio' ) },
		{ value: 'italic', label: __( 'Italic', 'searcio' ) },
		{ value: 'oblique', label: __( 'Oblique', 'searcio' ) },
	];
	const transforms = [
		{ value: null, label: __( 'Default', 'searcio' ) },
		{ value: 'none', label: __( 'As written', 'searcio' ) },
		{ value: 'uppercase', label: __( 'Uppercase', 'searcio' ) },
		{ value: 'lowercase', label: __( 'Lowercase', 'searcio' ) },
		{ value: 'capitalize', label: __( 'Capitalised', 'searcio' ) },
	];
	const decorations = [
		{ value: null, label: __( 'Default', 'searcio' ) },
		{ value: 'none', label: __( 'None', 'searcio' ) },
		{ value: 'underline', label: __( 'Underline', 'searcio' ) },
		{ value: 'overline', label: __( 'Overline', 'searcio' ) },
		{ value: 'line-through', label: __( 'Line through', 'searcio' ) },
	];

	const size = forDevice( current.size, device );
	const summary = [
		current.family,
		current.weight,
		undefined === size ? null : `${ size }px`,
	].filter( Boolean ).join( ' · ' ) || __( 'Default', 'searcio' );

	return (
		<div className="whsc-look-typography">
			<Button
				__next40pxDefaultSize
				variant="secondary"
				className="whsc-placement-color__toggle"
				aria-expanded={ isOpen }
				aria-controls={ panelId }
				onClick={ () => setIsOpen( ! isOpen ) }
			>
				<span className="whsc-placement-color__name">{ label }</span>
				<span className="whsc-placement-color__value">{ summary }</span>
				<Icon icon={ isOpen ? chevronUp : chevronDown } size={ 20 } className="whsc-look-typography__chevron" aria-hidden="true" />
			</Button>
			{ isOpen && (
				<Stack direction="column" gap="lg" id={ panelId } className="whsc-look-typography__panel">
					<FontControl label={ __( 'Font family', 'searcio' ) } value={ current.family } fonts={ fonts } onChange={ ( next ) => set( 'family', next ) } />
					<SizeControl
						label={ __( 'Size', 'searcio' ) }
						unit="px"
						min={ 6 }
						max={ 120 }
						value={ current.size }
						device={ device }
						responsive
						onChange={ ( next ) => set( 'size', next ) }
					/>
					<div className="whsc-look-typography__pair">
						<SelectControl label={ __( 'Weight', 'searcio' ) } { ...selectProps( weights, current.weight, ( next ) => set( 'weight', next ) ) } />
						<SelectControl label={ __( 'Style', 'searcio' ) } { ...selectProps( styles, current.style, ( next ) => set( 'style', next ) ) } />
						<SelectControl label={ __( 'Letter case', 'searcio' ) } { ...selectProps( transforms, current.transform, ( next ) => set( 'transform', next ) ) } />
						<SelectControl label={ __( 'Decoration', 'searcio' ) } { ...selectProps( decorations, current.decoration, ( next ) => set( 'decoration', next ) ) } />
					</div>
					<SizeControl
						label={ __( 'Line height', 'searcio' ) }
						min={ 0.5 }
						max={ 4 }
						step={ 0.05 }
						value={ current.line_height }
						device={ device }
						responsive
						onChange={ ( next ) => set( 'line_height', next ) }
					/>
					<SizeControl
						label={ __( 'Letter spacing', 'searcio' ) }
						unit="px"
						min={ -5 }
						max={ 20 }
						step={ 0.1 }
						value={ current.letter_spacing }
						device={ device }
						responsive
						onChange={ ( next ) => set( 'letter_spacing', next ) }
					/>
					<Stack direction="row" gap="sm">
						<Button
							__next40pxDefaultSize
							variant="tertiary"
							accessibleWhenDisabled
							disabled={ 0 === Object.keys( current ).length }
							onClick={ () => onChange( undefined ) }
						>
							{ __( 'Use the default', 'searcio' ) }
						</Button>
					</Stack>
				</Stack>
			) }
		</div>
	);
};

/**
 * One setting of the Look, drawn by its type (`Look_Schema`).
 *
 * @param {Object}             props
 * @param {Object}             props.control  From the schema.
 * @param {*}                  props.value    What the look holds for it.
 * @param {string}             props.device   The device being edited.
 * @param {Object[]}           props.fonts    From `fontOptions()`.
 * @param {function(*): void}  props.onChange Receives the new value; `undefined` takes it away.
 */
const LookControl = ( { control, value, device, fonts, onChange } ) => {
	switch ( control.type ) {
		case 'color':
			return <ColorField label={ control.label } value={ value || '' } onChange={ ( next ) => onChange( next || undefined ) } />;

		case 'size':
			return (
				<SizeControl
					label={ control.label }
					unit={ control.unit }
					min={ control.min }
					max={ control.max }
					value={ value }
					device={ device }
					responsive={ isResponsive( control ) }
					onChange={ onChange }
				/>
			);

		case 'spacing':
			return <SpacingControl label={ control.label } max={ control.max } value={ value } device={ device } onChange={ onChange } />;

		case 'choice':
			return <ChoiceControl label={ control.label } options={ control.options } value={ value } onChange={ onChange } />;

		case 'toggle':
			return (
				<SwitchControl
					label={ control.label }
					checked={ true === value }
					onCheckedChange={ ( checked ) => onChange( checked ? true : undefined ) }
				/>
			);

		case 'font':
			return <FontControl label={ control.label } value={ value } fonts={ fonts } onChange={ onChange } />;

		case 'border':
			return <BorderField label={ control.label } value={ value } onChange={ onChange } />;

		case 'typography':
			return <TypographyControl label={ control.label } value={ value } device={ device } fonts={ fonts } onChange={ onChange } />;
	}

	return null;
};

export default LookControl;
