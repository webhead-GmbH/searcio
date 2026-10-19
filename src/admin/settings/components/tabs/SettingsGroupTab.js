// ToggleControl stays on @wordpress/components: it is recommended there, and
// its @wordpress/ui counterpart, SwitchControl, is use-with-caution precisely
// for being mixed with @wordpress/components, which is what this screen does.
// InputControl, TextareaControl and Notice come from @wordpress/ui, because
// the @wordpress/components versions are not-recommended and these are the
// replacements the design system names.
import { useEffect, useRef, useState } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';
import { Card, InputControl, Notice, Stack, Text, TextareaControl } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

import { Grid } from '../../../../components/Layout';

const serializeJsonValue = ( value, definition ) =>
	JSON.stringify(
		value ?? definition.default ?? ( definition.type === 'array' ? [] : {} ),
		null,
		2
	);

/**
 * A JSON textarea has to hold the text being typed, not a re-serialisation of
 * it. Driven straight off the setting, storing the raw text whenever
 * JSON.parse threw, the next render stringified that text: quoting it and
 * escaping its newlines, then escaping those escapes on the keystroke after.
 * Every structural edit passes through invalid JSON - `{ "a": 1 }` cannot be
 * reached without typing `{`, `{"`, `{"a` - so the field corrupted itself as
 * soon as anyone typed in it.
 *
 * The draft also keeps the caret still. Re-serialising with an indent on every
 * keystroke rewrites the text around the cursor even when the value parses.
 */
const JsonFieldControl = ( { settingKey, definition, value, updateSetting } ) => {
	const serialized = serializeJsonValue( value, definition );
	const [ draft, setDraft ] = useState( serialized );
	const [ isInvalid, setIsInvalid ] = useState( false );
	// The serialization the draft last agreed with. Only a change this field
	// did not make - a reload, a save response - replaces the draft; comparing
	// against the incoming value alone would fight the person typing.
	const agreedValue = useRef( serialized );

	useEffect( () => {
		if ( serialized === agreedValue.current ) {
			return;
		}

		agreedValue.current = serialized;
		setDraft( serialized );
		setIsInvalid( false );
	}, [ serialized ] );

	return (
		// A Stack and not a fragment. Card.Content does not space what is put
		// in it, so the notice sat flush against the field above it.
		<Stack direction="column" gap="md">
			<TextareaControl
				label={ definition.label || settingKey }
				hideLabelFromVision
				description={ __( 'Edit the JSON value for this setting.', 'searcio' ) }
				value={ draft }
				onValueChange={ ( nextValue ) => {
					setDraft( nextValue );

					try {
						const parsedValue = JSON.parse( nextValue );

						agreedValue.current = serializeJsonValue( parsedValue, definition );
						setIsInvalid( false );
						updateSetting( settingKey, parsedValue );
					} catch ( error ) {
						// The last value that parsed stays put: writing the
						// half-typed text back is what corrupted the field.
						setIsInvalid( true );
					}
				} }
			/>
			{ isInvalid ? (
				<Notice.Root intent="error">
					<Notice.Description>
						{ __(
							'This is not valid JSON yet, so the change has not been applied. Finish the value to save it.',
							'searcio'
						) }
					</Notice.Description>
				</Notice.Root>
			) : null }
		</Stack>
	);
};

const renderFieldControl = ( field, settings, updateSetting ) => {
	const { key, definition } = field;
	const value = settings[ key ] ?? definition.default;

	if ( definition.type === 'boolean' ) {
		return (
			<ToggleControl
				__nextHasNoMarginBottom
				label={ definition.label || key }
				hideLabelFromVision
				checked={ Boolean( value ) }
				onChange={ ( nextValue ) => updateSetting( key, nextValue ) }
			/>
		);
	}

	if ( definition.type === 'integer' || definition.type === 'number' ) {
		return (
			<InputControl
				type="number"
				label={ definition.label || key }
				hideLabelFromVision
				value={ value ?? '' }
				onValueChange={ ( nextValue ) => {
					if ( nextValue === '' ) {
						updateSetting( key, definition.default );

						return;
					}

					const parsedValue = definition.type === 'integer'
						? parseInt( nextValue, 10 )
						: parseFloat( nextValue );

					updateSetting(
						key,
						Number.isNaN( parsedValue ) ? definition.default : parsedValue
					);
				} }
			/>
		);
	}

	if ( definition.type === 'array' || definition.type === 'object' ) {
		return (
			<JsonFieldControl
				settingKey={ key }
				definition={ definition }
				value={ value }
				updateSetting={ updateSetting }
			/>
		);
	}

	return (
		<InputControl
			type={ definition.masked ? 'password' : 'text' }
			label={ definition.label || key }
			hideLabelFromVision
			value={ value ?? '' }
			onValueChange={ ( nextValue ) => updateSetting( key, nextValue ) }
		/>
	);
};

const renderFieldCard = ( field, settings, updateSetting ) => {
	const { key, definition } = field;
	const isToggle = definition.type === 'boolean';

	return (
		<Card.Root key={ key } className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h2 /> }>{ definition.label || key }</Card.Title>
					{ definition.description ? (
						<Text render={ <p /> } variant="body-sm">
							{ definition.description }
						</Text>
					) : null }
				</div>
				{ /* A switch is the answer to the question its title asks, so it sits on
				   that row. Everything else gets a row of its own below. Either way the
				   label and description are written once: the header owns them, and the
				   control keeps an accessible label only. */ }
				{ isToggle ? (
					<div className="whsc-settings-card-switch">
						{ renderFieldControl( field, settings, updateSetting ) }
					</div>
				) : null }
			</Card.Header>
			{ isToggle ? null : (
				<Card.Content className="whsc-settings-card-content">
					{ renderFieldControl( field, settings, updateSetting ) }
				</Card.Content>
			) }
		</Card.Root>
	);
};

const SettingsGroupTab = ( { fields, settings, updateSetting, children } ) => {
	if ( fields.length === 0 && ! children ) {
		return (
			<Notice.Root intent="info">
				<Notice.Description>
					{ __( 'No settings are registered for this tab yet.', 'searcio' ) }
				</Notice.Description>
			</Notice.Root>
		);
	}

	return (
		// Cards find their own number of columns and never get narrower than they
		// can carry. The grid owns the gap; no card supplies its own margin.
		<Grid
			className="whsc-settings-grid"
			auto={ { base: 280, md: 320 } }
			gap="var(--wpds-dimension-gap-xl)"
			align="start"
		>
			{ fields.map( ( field ) => renderFieldCard( field, settings, updateSetting ) ) }
			{ children }
		</Grid>
	);
};

export default SettingsGroupTab;
