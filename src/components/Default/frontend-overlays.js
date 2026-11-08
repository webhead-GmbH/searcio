/**
 * Webhead scaffold managed file. scaffold:update may refresh this file.
 *
 * Marks what WordPress draws at the end of `body` for a surface with
 * `data-webhead-frontend-overlay`: the container of every popover, menu and
 * tooltip of `@wordpress/components`, a modal, and the slot `@wordpress/ui`
 * draws its overlays in. The frontend reset scopes them by that attribute when
 * a surface's stylesheet loads it with `$marked-overlays: true`; import this
 * from the entry of that surface:
 *
 *     import '../../components/Default/frontend-overlays';
 *
 * Each of those is appended to `body` itself, so this watches the children of
 * `body` and nothing below them: what a surface changes inside itself, as a
 * search box does on every keystroke, wakes nothing here.
 */
const OVERLAYS = '.components-popover__fallback-container, .components-modal__screen-overlay, [data-wp-compat-overlay-slot], .components-snackbar-list';
const MARK = 'data-webhead-frontend-overlay';

const mark = ( node ) => {
	if ( node instanceof Element && node.matches( OVERLAYS ) && ! node.hasAttribute( MARK ) ) {
		node.setAttribute( MARK, '' );
	}
};

const watch = () => {
	Array.from( document.body.children ).forEach( mark );

	new MutationObserver( ( records ) => {
		records.forEach( ( record ) => record.addedNodes.forEach( mark ) );
	} ).observe( document.body, { childList: true } );
};

if ( 'undefined' !== typeof document ) {
	if ( document.body ) {
		watch();
	} else {
		document.addEventListener( 'DOMContentLoaded', watch, { once: true } );
	}
}
