import { createContext } from '@wordpress/element';

const SettingsContext = createContext( {
	schema: {},
	settings: {},
	hasUnsavedChanges: false,
	isLoading: true,
	settingGroups: [],
	saveSettings: async () => false,
	updateSetting: () => {},
	reloadSettings: async () => {},
} );

export default SettingsContext;
