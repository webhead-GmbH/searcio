import { createContext } from '@wordpress/element';

const SettingsContext = createContext( {
	schema: {},
	settings: {},
	hasUnsavedChanges: false,
	isLoading: true,
	isSaving: false,
	loadError: null,
	saveError: null,
	clearSaveError: () => {},
	settingGroups: [],
	retryLoad: () => {},
	reloadSettings: async () => {},
	saveSettings: async () => false,
	updateSetting: () => {},
} );

export default SettingsContext;
