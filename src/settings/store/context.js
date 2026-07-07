import { createContext } from '@wordpress/element';

const SettingsContext = createContext( {
	schema: {},
	settings: {},
	hasUnsavedChanges: false,
	isLoading: true,
	settingGroups: [],
	saveSettings: async () => false,
	updateSetting: () => {},
} );

export default SettingsContext;
