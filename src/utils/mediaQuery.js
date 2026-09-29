import { useEffect, useState } from '@wordpress/element';

/**
 * The storefront's one-column breakpoint, the same 782px the stylesheet uses.
 */
export const NARROW = '(max-width: 782px)';

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
