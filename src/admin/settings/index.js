import { createRoot } from '@wordpress/element';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from '@wordpress/theme';
import 'react-toastify/dist/ReactToastify.css';

import './scss/settings.scss';
import SettingsPanel from './components/SettingsPanel';
import SettingsProvider from '../../settings/store/provider';

const container = document.getElementById( 'webhead-search-cloud-root' );

if ( container ) {
	const root = createRoot( container );

	root.render(
		<ThemeProvider isRoot color={ { primary: '#319b80' } }>
			<SettingsProvider>
				<SettingsPanel />
				<ToastContainer />
			</SettingsProvider>
		</ThemeProvider>
	);
}
