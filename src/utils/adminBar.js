/**
 * How far WordPress's toolbar reaches down the screen, in pixels.
 *
 * The toolbar a logged-in user sees is drawn over the page, and a theme may
 * lift it above everything: fisch-gruber.at gives it `z-index: 2147483647`,
 * the highest there is, so no window can be drawn over it and the search
 * window has to start under it instead. From 601px up it is fixed (32px, and
 * 46px up to 782px); on a phone it scrolls away with the page, so what it
 * covers is measured where it is, not assumed. Without the toolbar, as a
 * visitor sees the page, it is 0.
 *
 * @param {Document} doc The page.
 * @return {number} The toolbar's bottom edge in the viewport, at least 0.
 */
export const adminBarOffset = ( doc = document ) => {
	const bar = doc.getElementById( 'wpadminbar' );

	if ( ! bar ) {
		return 0;
	}

	const style = doc.defaultView.getComputedStyle( bar );

	if ( 'none' === style.display || 'hidden' === style.visibility ) {
		return 0;
	}

	return Math.max( 0, Math.round( bar.getBoundingClientRect().bottom ) );
};
