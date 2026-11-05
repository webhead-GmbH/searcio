/**
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * Draws this plugin's snackbars, which `showToast()` puts in `core/notices`.
 * The AdminPage shell renders it, so every screen it draws has it once. It
 * reads the plugin's own context only: a snackbar another plugin raises on
 * the same page is that plugin's to draw.
 */
import { SnackbarList } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import './snackbars.scss';

/**
 * The context this plugin's snackbars are kept in, apart from any another
 * plugin raises on the same page. Here and not in `src/toast.js`, so the list
 * imports nothing from a file the plugin may still have in its old form.
 */
export const SNACKBAR_CONTEXT = 'searcio';

export default function Snackbars() {
	const notices = useSelect( ( select ) => select( noticesStore ).getNotices( SNACKBAR_CONTEXT ), [] );
	const { removeNotice } = useDispatch( noticesStore );

	return (
		<SnackbarList
			className="searcio-snackbars"
			notices={ notices.filter( ( notice ) => 'snackbar' === notice.type ) }
			onRemove={ ( id ) => removeNotice( id, SNACKBAR_CONTEXT ) }
		/>
	);
}
