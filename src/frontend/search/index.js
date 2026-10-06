import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';

import './scss/style.scss';
import App from './components/App';

const hydrated = new WeakSet();

let root = null;
let mountedTriggers = [];
let mountedLists = [];

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

	root.render( <App triggerElements={ mountedTriggers } listElements={ mountedLists } /> );
};

/**
 * Re-scans the whole document for trigger placeholders and re-renders if
 * anything changed. A page builder (Elementor's editor canvas, Elementor Pro
 * popups, any AJAX-loaded content) can add or replace `[data-whsc-trigger]`
 * nodes long after this script's first run, so a one-time
 * `querySelectorAll` at boot would miss them — a persistent `MutationObserver`
 * keeps hydrating new ones and drops stale references to removed ones.
 */
const collect = ( selector, mounted ) => {
	const found = Array.from( document.querySelectorAll( selector ) );
	const stillConnected = mounted.filter( ( el ) => el.isConnected );
	const newEls = found.filter( ( el ) => ! hydrated.has( el ) );

	if ( 0 === newEls.length && stillConnected.length === mounted.length ) {
		return null;
	}

	newEls.forEach( ( el ) => hydrated.add( el ) );

	return [ ...stillConnected, ...newEls ];
};

const sync = () => {
	const triggers = collect( '[data-whsc-trigger]', mountedTriggers );
	// Product rows (similar products, a curated category listing) hydrate the
	// same way and from the same bundle - they render the same cards, in the
	// same styles, against the same API client.
	const lists = collect( '[data-whsc-list]', mountedLists );

	if ( null === triggers && null === lists ) {
		return;
	}

	mountedTriggers = triggers || mountedTriggers;
	mountedLists = lists || mountedLists;

	render();
};

const boot = () => {
	sync();

	new MutationObserver( sync ).observe( document.body, {
		childList: true,
		subtree: true,
	} );
};

// At once when the page has been read, which is the case whenever a caching or
// a consent plugin runs this script late. A `DOMContentLoaded` listener of its
// own would wait for an event that had long fired.
domReady( boot );
