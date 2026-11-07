import { useEffect, useRef, useState } from '@wordpress/element';

/**
 * The assistant's reply, typed out. The service streams the reply in pieces
 * of a phrase or a sentence, and drawn as they came each one appeared at once;
 * typed out, the reply reads as being written.
 *
 * Typing never holds the reply back for long: each frame shows at least
 * {@see MIN_STEP} more characters (in practice a word), and a
 * {@see CATCH_UP_FRAMES}th of what is still to type while the typing is
 * behind, so even a long backlog is on screen within a second.
 */
export const MIN_STEP = 2;

export const CATCH_UP_FRAMES = 10;

/**
 * How much of `text` the next frame shows, from `shown` characters. It ends on
 * a whole word: half a word reads as a typo, and half of a Markdown mark ("**"
 * of bold, the "[" of a link) as a stray symbol.
 *
 * @param {string} text  What has arrived so far.
 * @param {number} shown How much of it is on screen.
 * @return {number} How much the next frame shows.
 */
export const nextLength = ( text, shown ) => {
	if ( shown >= text.length ) {
		return text.length;
	}

	const next = shown + Math.max( MIN_STEP, Math.ceil( ( text.length - shown ) / CATCH_UP_FRAMES ) );

	if ( next >= text.length ) {
		return text.length;
	}

	const space = text.slice( next ).search( /\s/ );

	return -1 === space ? text.length : next + space;
};

const reducedMotion = () => 'function' === typeof window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/**
 * `text` typed out from where it stands, one frame at a time; all of it at
 * once when `animate` is false or the visitor asks for less motion.
 *
 * @param {string}   text            The text so far; it may grow.
 * @param {Object}   options
 * @param {boolean}  options.animate Whether to type it out.
 * @param {Function} [options.onType] Called after each frame, e.g. to keep the end in view.
 * @return {{ text: string, typing: boolean }} What is on screen, and whether more is to come.
 */
export const useTypewriter = ( text, { animate, onType } ) => {
	const reduce = useRef( reducedMotion() ).current;
	const typed = ! animate || reduce;
	const shown = useRef( typed ? text.length : 0 );
	const [ , redraw ] = useState( 0 );
	const typeRef = useRef( onType );

	typeRef.current = onType;

	if ( typed ) {
		shown.current = text.length;
	}

	useEffect( () => {
		if ( typed || shown.current >= text.length ) {
			return undefined;
		}

		let frame = 0;
		const tick = () => {
			shown.current = nextLength( text, shown.current );
			redraw( ( count ) => count + 1 );
			typeRef.current?.();

			if ( shown.current < text.length ) {
				frame = window.requestAnimationFrame( tick );
			}
		};

		frame = window.requestAnimationFrame( tick );

		return () => window.cancelAnimationFrame( frame );
	}, [ text, typed ] );

	return { text: text.slice( 0, shown.current ), typing: shown.current < text.length };
};
