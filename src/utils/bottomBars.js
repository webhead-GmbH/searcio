/**
 * Bars a site fixes to the bottom of the screen - WooCommerce's store notice,
 * a cookie banner, a cart bar - and the floating search button, which stood
 * on top of them: over the notice's text, and on a desktop over its close
 * button. The Placement tab's distance from the bottom is one for every
 * screen, and such a bar is often on phones alone, or comes and goes.
 */

/**
 * How far a bar fixed to the bottom of the screen reaches up at a point
 * across it: 0 for none. A fixed layer that covers half the screen or more is
 * an overlay (a menu, a window), not a bar.
 *
 * @param {number}  x     Where to look, across the screen.
 * @param {Element} [own] The button's own element, which is no bar.
 * @return {number} The height of the bar, in pixels.
 */
export const bottomBarHeight = ( x, own ) => {
	if ( 'function' !== typeof document.elementsFromPoint ) {
		return 0;
	}

	const height = window.innerHeight;
	let top = height;

	document.elementsFromPoint( x, height - 2 ).forEach( ( element ) => {
		if ( own?.contains( element ) ) {
			return;
		}

		for ( let node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement ) {
			const position = window.getComputedStyle( node ).position;

			if ( 'fixed' === position || 'sticky' === position ) {
				const rect = node.getBoundingClientRect();

				if ( rect.bottom >= height - 2 && rect.height > 0 && rect.height < height / 2 ) {
					top = Math.min( top, rect.top );
				}

				return;
			}
		}
	} );

	return Math.max( 0, Math.round( height - top ) );
};

/**
 * Keeps `--whsc-floating-lift` on the floating button's element at the
 * height of the bar under it, as the page loads (a banner often comes a
 * moment later), scrolls, is resized or is clicked (a notice dismissed).
 *
 * @param {HTMLElement} element The floating trigger.
 * @return {Function} Stops watching.
 */
export const liftAboveBottomBars = ( element ) => {
	let frame = 0;

	const update = () => {
		frame = 0;

		const rect = element.getBoundingClientRect();
		const x = rect.width > 0 ? rect.left + rect.width / 2 : window.innerWidth - 40;

		element.style.setProperty( '--whsc-floating-lift', `${ bottomBarHeight( x, element ) }px` );
	};
	const schedule = () => {
		if ( ! frame ) {
			frame = window.requestAnimationFrame( update );
		}
	};
	const timers = [ 0, 1000, 3000 ].map( ( delay ) => window.setTimeout( schedule, delay ) );

	window.addEventListener( 'resize', schedule );
	window.addEventListener( 'scroll', schedule, { passive: true } );
	document.addEventListener( 'click', schedule );

	return () => {
		timers.forEach( ( timer ) => window.clearTimeout( timer ) );
		window.cancelAnimationFrame( frame );
		window.removeEventListener( 'resize', schedule );
		window.removeEventListener( 'scroll', schedule );
		document.removeEventListener( 'click', schedule );
		element.style.removeProperty( '--whsc-floating-lift' );
	};
};
