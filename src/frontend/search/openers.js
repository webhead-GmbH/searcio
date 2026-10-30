/**
 * Opens the search from what is not one of its own triggers: an element of
 * the theme named by a CSS selector on the Placement tab, any element with the
 * class `searcio-open`, a link to `#searcio`, and the keyboard shortcut.
 *
 * Each asks by dispatching {@link OPEN_EVENT} on `window`, which the App
 * answers by opening the window of the site's own trigger.
 */

/** The event that asks the App to open the search, with `detail.query` as the text to start with. */
export const OPEN_EVENT = 'whsc:open';

/** What opens the search on any site, with nothing to set. */
export const BUILT_IN_SELECTOR = '.searcio-open, a[href$="#searcio"]';

/**
 * Whether the browser can read a selector. One it cannot is left out, so a
 * typing mistake on the Placement tab turns that one off and not the others.
 *
 * @param {string} selector
 * @return {boolean} Whether it can be matched against.
 */
export const isValidSelector = ( selector ) => {
	if ( 'string' !== typeof selector || '' === selector.trim() ) {
		return false;
	}

	try {
		document.createDocumentFragment().querySelector( selector );

		return true;
	} catch {
		return false;
	}
};

/**
 * @param {string}  [query]
 * @param {Window} [win]
 */
export const requestOpen = ( query = '', win = window ) => {
	win.dispatchEvent( new CustomEvent( OPEN_EVENT, { detail: { query } } ) );
};

const isTextField = ( el ) =>
	el instanceof HTMLTextAreaElement ||
	( el instanceof HTMLInputElement && ! [ 'button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'file', 'hidden' ].includes( el.type ) );

/** A field the visitor types in, where "/" is a character and not the shortcut. */
const isEditable = ( el ) => isTextField( el ) || el instanceof HTMLSelectElement || Boolean( el?.isContentEditable );

/**
 * Starts listening, and returns what stops it.
 *
 * Clicks are read on `window` while they are on their way down, before any
 * handler of the theme on the element or on the document: the theme's own
 * dropdown, lightbox or overlay must not open behind the search as well.
 *
 * @param {Object}   [options]
 * @param {string[]} [options.selectors] The theme's search icon or field.
 * @param {boolean}  [options.shortcut]  Whether Ctrl/Cmd+K and "/" open it.
 * @param {Window}   [options.win]
 * @return {Function} Removes the listeners.
 */
export const attachOpeners = ( { selectors = [], shortcut = false, win = window } = {} ) => {
	const matcher = [ BUILT_IN_SELECTOR, ...selectors.filter( isValidSelector ) ].join( ', ' );

	// The search's own markup is never an opener, whatever a selector matches:
	// a broad one such as `input[type=search]` would match its own field.
	const opener = ( target ) => {
		const el = target instanceof Element ? target.closest( matcher ) : null;

		return el && ! el.closest( '[data-webhead-frontend-root], .whsc-modal-overlay, .whsc-sheet-overlay' ) ? el : null;
	};

	const onClick = ( event ) => {
		const el = opener( event.target );

		// A field opens when it takes the focus, which a click gives it.
		if ( ! el || isTextField( el ) ) {
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		requestOpen( '', win );
	};

	// A tap on a phone and a press of a mouse button come first: a theme that
	// opens its search there must not open it.
	const onPress = ( event ) => {
		const el = opener( event.target );

		if ( el && ! isTextField( el ) ) {
			event.stopImmediatePropagation();
		}
	};

	const onFocus = ( event ) => {
		const el = opener( event.target );

		if ( ! el || ! isTextField( el ) ) {
			return;
		}

		// What was typed before the search loaded goes along with it.
		const query = el.value || '';

		el.blur();
		requestOpen( query, win );
	};

	const onKey = ( event ) => {
		if ( event.defaultPrevented || event.isComposing ) {
			return;
		}

		const withModifier = ( event.ctrlKey || event.metaKey ) && ! event.altKey && 'k' === event.key.toLowerCase();
		const slash = '/' === event.key && ! event.ctrlKey && ! event.metaKey && ! event.altKey && ! isEditable( win.document.activeElement );

		if ( ! withModifier && ! slash ) {
			return;
		}

		// Not while the search is open: Ctrl+K there belongs to its field.
		if ( win.document.querySelector( '.whsc-modal-overlay' ) ) {
			return;
		}

		event.preventDefault();
		requestOpen( '', win );
	};

	win.addEventListener( 'click', onClick, true );
	win.addEventListener( 'pointerdown', onPress, true );
	win.addEventListener( 'touchstart', onPress, { capture: true, passive: true } );
	win.addEventListener( 'focusin', onFocus, true );

	if ( shortcut ) {
		win.addEventListener( 'keydown', onKey );
	}

	return () => {
		win.removeEventListener( 'click', onClick, true );
		win.removeEventListener( 'pointerdown', onPress, true );
		win.removeEventListener( 'touchstart', onPress, { capture: true } );
		win.removeEventListener( 'focusin', onFocus, true );
		win.removeEventListener( 'keydown', onKey );
	};
};
