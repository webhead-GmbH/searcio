/**
 * A row that scrolls sideways fades out at its end while there is more to
 * scroll to, so a label the edge cuts reads as cut rather than as a typo. The
 * stylesheet draws the fade on `.has-more`; this keeps the class true.
 */

/**
 * Whether a sideways-scrolling element has more past its end. `scrollLeft`
 * counts down from 0 in a right-to-left page, hence the absolute value; a few
 * pixels of rounding are not "more".
 *
 * @param {{scrollWidth: number, clientWidth: number, scrollLeft: number}} row
 * @return {boolean}
 */
export const hasMoreToScroll = ( row ) => row.scrollWidth - row.clientWidth - Math.abs( row.scrollLeft ) > 4;

/**
 * Keeps `.has-more` on `row` in step with its scroll position.
 *
 * @param {HTMLElement|null} row
 * @return {() => void} Stops it.
 */
export const trackScrollEnd = ( row ) => {
	if ( ! row ) {
		return () => {};
	}

	const update = () => row.classList.toggle( 'has-more', hasMoreToScroll( row ) );

	update();
	row.addEventListener( 'scroll', update, { passive: true } );

	return () => row.removeEventListener( 'scroll', update );
};
