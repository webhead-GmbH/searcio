import {
	Notice,
	TextControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { Card, Text } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

import { Grid } from '../../../../components/Layout';

const renderFieldControl = ( field, settings, updateSetting ) => {
	const { key, definition } = field;
	const value = settings[ key ] ?? definition.default;
	const help = definition.description || undefined;

	if ( definition.type === 'boolean' ) {
		return (
			<ToggleControl
				label={ definition.label || key }
				checked={ Boolean( value ) }
				help={ help }
				onChange={ ( nextValue ) => updateSetting( key, nextValue ) }
			/>
		);
	}

	if ( definition.type === 'integer' || definition.type === 'number' ) {
		return (
			<TextControl
				__next40pxDefaultSize
				type="number"
				label={ definition.label || key }
				value={ value ?? '' }
				help={ help }
				onChange={ ( nextValue ) => {
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
			<TextareaControl
				label={ definition.label || key }
				help={ help || __( 'Edit the JSON value for this setting.', 'webhead-search-cloud' ) }
				value={ JSON.stringify(
					value ?? definition.default ?? ( definition.type === 'array' ? [] : {} ),
					null,
					2
				) }
				onChange={ ( nextValue ) => {
					try {
						updateSetting( key, JSON.parse( nextValue ) );
					} catch ( error ) {
						updateSetting( key, nextValue );
					}
				} }
			/>
		);
	}

	return (
		<TextControl
			__next40pxDefaultSize
			type={ definition.masked ? 'password' : 'text' }
			label={ definition.label || key }
			value={ value ?? '' }
			help={ help }
			onChange={ ( nextValue ) => updateSetting( key, nextValue ) }
		/>
	);
};

const renderFieldCard = ( field, settings, updateSetting ) => {
	const { key, definition } = field;

	return (
		<Card.Root key={ key } className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h3 /> }>{ definition.label || key }</Card.Title>
					{ definition.description ? (
						<Text render={ <p /> } variant="body-sm">
							{ definition.description }
						</Text>
					) : null }
				</div>
			</Card.Header>
			<Card.Content className="whsc-settings-card-content">
				{ renderFieldControl( field, settings, updateSetting ) }
			</Card.Content>
		</Card.Root>
	);
};

const SettingsGroupTab = ( { fields, settings, updateSetting, children } ) => {
	if ( fields.length === 0 && ! children ) {
		return (
			<Notice status="info" isDismissible={ false }>
				<p>{ __( 'No settings are registered for this tab yet.', 'webhead-search-cloud' ) }</p>
			</Notice>
		);
	}

	return (
		<Grid
			className="whsc-settings-grid"
			auto={ { base: 280, md: 320 } }
			gap={ { base: 16, md: 20 } }
			align="start"
		>
			{ fields.map( ( field ) => renderFieldCard( field, settings, updateSetting ) ) }
			{ children }
		</Grid>
	);
};

export default SettingsGroupTab;
