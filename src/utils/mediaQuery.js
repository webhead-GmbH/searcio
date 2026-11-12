import { useEffect, useState } from '@wordpress/element';

/**
 * The storefront's one-column breakpoint, the same 782px the stylesheet uses.
 */
export const NARROW = '(max-width: 782px)';

/**
 * Where the search window is the whole screen: a phone, a tablet held upright,
 * and any screen as short as a phone on its side. The stylesheet's query is
 * the same.
 */
export const FULL_SCREEN = '(max-width: 782px), (max-height: 500px)';

/**
 * Where the results are a grid that scrolls down rather than a row that
 * scrolls sideways: where the window is the whole screen, on a touch screen
 * of any size, where a row is moved with a swipe across it and a swipe down,
 * the one people make, moved nothing, and on a screen held upright up to a
 * tablet's width, which a tablet with a trackpad is: a row of three and a half
 * cards there sat at the top over 700px of nothing.
 */
export const GRID_RESULTS = `${ FULL_SCREEN }, (hover: none) and (pointer: coarse), (max-width: 1024px) and (orientation: portrait)`;

const matches = ( query ) =>
	'undefined' !== typeof window && 'function' === typeof window.matchMedia && window.matchMedia( query ).matches;

/**
 * Whether a media query matches, kept current as the window is resized or a
 * phone turned sideways.
 *
 * @param {string} query A media query, e.g. `NARROW`.
 * @return {boolean} Whether it matches now.
 */
export function useMediaQuery( query ) {
	const [ isMatch, setIsMatch ] = useState( () => matches( query ) );

	useEffect( () => {
		if ( 'undefined' === typeof window || 'function' !== typeof window.matchMedia ) {
			return undefined;
		}

		const list = window.matchMedia( query );
		const update = () => setIsMatch( list.matches );

		update();
		list.addEventListener( 'change', update );

		return () => list.removeEventListener( 'change', update );
	}, [ query ] );

	return isMatch;
}
