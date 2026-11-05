/**
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * What a screen says when something is done: one of WordPress's own snackbars,
 * kept in `core/notices` under this plugin's context, and drawn by
 * `<Snackbars />`, which the AdminPage shell renders on every screen.
 *
 *     showToast( __( 'Settings saved.', 'text-domain' ) );
 *     showToast( __( 'The export could not be written.', 'text-domain' ), 'error' );
 *
 * A confirmation clears itself. An error or a warning stays until it is
 * closed, as the design system asks of anything that may need a decision; a
 * failure that has a place on the screen is a `Notice` there instead. Each
 * kind carries its icon, since a snackbar has no colour of its own, and the
 * snackbar speaks its message as a status, which does not cut into what a
 * screen reader is reading.
 *
 * `options` go to `createNotice()`: `actions` for an undo, `explicitDismiss`
 * to change whether it waits to be closed.
 */
import { dispatch } from '@wordpress/data';
import { Icon, caution, check, error, info } from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';

import { SNACKBAR_CONTEXT } from './components/Snackbars';

export { SNACKBAR_CONTEXT };

const ICONS = { success: check, info, warning: caution, error };

export const showToast = ( message, type = 'success', options = {} ) => {
	const status = ICONS[ type ] ? type : 'success';

	dispatch( noticesStore ).createNotice( status, String( message ?? '' ), {
		icon: <Icon icon={ ICONS[ status ] } />,
		explicitDismiss: 'error' === status || 'warning' === status,
		...options,
		context: SNACKBAR_CONTEXT,
		type: 'snackbar',
	} );
};
