import { createRoot } from '@wordpress/element';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from '@wordpress/theme';
import 'react-toastify/dist/ReactToastify.css';

import SettingsPanel from './components/SettingsPanel';
import SettingsProvider from '../../settings/store/provider';
// After the components. The AdminPage shell brings the stylesheet every screen
// shares, and this screen's own rules are written to follow it.
import './scss/settings.scss';

const container = document.getElementById( 'webhead-search-cloud-root' );

if ( container ) {
	const root = createRoot( container );

	root.render(
		<ThemeProvider isRoot color={ { primary: '#101010' } }>
			<SettingsProvider>
				<SettingsPanel />
				<ToastContainer />
			</SettingsProvider>
		</ThemeProvider>
	);
}
