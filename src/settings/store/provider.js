import { useEffect, useMemo, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import SettingsContext from './context';

const pluginData = window.webhead_search_cloudData || {};

if ( pluginData?.api?.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( pluginData.api.nonce ) );
}

const groupSettings = ( schema ) => {
	const groups = {};

	Object.entries( schema || {} ).forEach( ( [ key, definition ] ) => {
		const section = definition.section || 'general';
		const sectionLabel = definition.section_label || __( 'General', 'webhead-search-cloud' );

		if ( ! groups[ section ] ) {
			groups[ section ] = {
				name: section,
				title: sectionLabel,
				fields: [],
			};
		}

		groups[ section ].fields.push( {
			key,
			definition,
		} );
	} );

	return Object.values( groups );
};

const SettingsProvider = ( { children } ) => {
	const [ schema, setSchema ] = useState( {} );
	const [ settings, setSettings ] = useState( {} );
	const [ persistedSettings, setPersistedSettings ] = useState( {} );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const hasUnsavedChanges = useMemo(
		() => JSON.stringify( settings ) !== JSON.stringify( persistedSettings ),
		[ settings, persistedSettings ]
	);

	useEffect( () => {
		const loadSettings = async () => {
			try {
				const response = await apiFetch( {
					path: pluginData?.api?.settingsPath || '/webhead-search-cloud/v1/settings',
				} );

				setSchema( response.schema || {} );
				setSettings( response.settings || {} );
				setPersistedSettings( response.settings || {} );
			} finally {
				setIsLoading( false );
			}
		};

		void loadSettings();
	}, [] );

	const updateSetting = ( key, value ) => {
		setSettings( ( currentSettings ) => ( {
			...currentSettings,
			[ key ]: value,
		} ) );
	};

	const saveSettings = async () => {
		setIsSaving( true );

		try {
			const response = await apiFetch( {
				path: pluginData?.api?.settingsPath || '/webhead-search-cloud/v1/settings',
				method: 'POST',
				data: {
					settings,
				},
			} );

			setSchema( response.schema || schema );
			setSettings( response.settings || settings );
			setPersistedSettings( response.settings || settings );

			return true;
		} catch ( error ) {
			return false;
		} finally {
			setIsSaving( false );
		}
	};

	return (
		<SettingsContext.Provider
			value={ {
				schema,
				settings,
				hasUnsavedChanges,
				isLoading,
				isSaving,
				settingGroups: groupSettings( schema ),
				saveSettings,
				updateSetting,
			} }
		>
			{ children }
		</SettingsContext.Provider>
	);
};

export default SettingsProvider;
