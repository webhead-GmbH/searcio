import { createRoot } from '@wordpress/element';

import './scss/style.scss';
import App from './components/App';

const hydrated = new WeakSet();

let root = null;
let mountedTriggers = [];

const getMountEl = () => {
	let mountEl = document.getElementById( 'webhead-search-cloud-root' );

	if ( ! mountEl ) {
		mountEl = document.createElement( 'div' );
		mountEl.id = 'webhead-search-cloud-root';
		// Scopes the shared frontend reset to the portalled modal, which lives
		// under `document.body` and is not a descendant of any trigger's own
		// `data-webhead-frontend-root` element (see `Trigger_Markup::render()`).
		mountEl.setAttribute( 'data-webhead-frontend-root', '' );
		document.body.appendChild( mountEl );
	}

	return mountEl;
};

const render = () => {
	if ( ! root ) {
		root = createRoot( getMountEl() );
	}

	root.render( <App triggerElements={ mountedTriggers } /> );
};

/**
 * Re-scans the whole document for trigger placeholders and re-renders if
 * anything changed. A page builder (Elementor's editor canvas, Elementor Pro
 * popups, any AJAX-loaded content) can add or replace `[data-whsc-trigger]`
 * nodes long after this script's first run, so a one-time
 * `querySelectorAll` at boot would miss them — a persistent `MutationObserver`
 * keeps hydrating new ones and drops stale references to removed ones.
 */
const sync = () => {
	const found = Array.from( document.querySelectorAll( '[data-whsc-trigger]' ) );
	const stillConnected = mountedTriggers.filter( ( el ) => el.isConnected );
	const newEls = found.filter( ( el ) => ! hydrated.has( el ) );

	if ( 0 === newEls.length && stillConnected.length === mountedTriggers.length ) {
		return;
	}

	newEls.forEach( ( el ) => hydrated.add( el ) );
	mountedTriggers = [ ...stillConnected, ...newEls ];

	render();
};

const boot = () => {
	sync();

	new MutationObserver( sync ).observe( document.body, {
		childList: true,
		subtree: true,
	} );
};

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
