/**
 * Reading out a notice that appears.
 *
 * `Notice` from `@wordpress/ui` announced itself up to 0.23 and stopped at
 * 0.24: a notice drawn after a failed request was silent for a screen reader.
 * The code that shows one now says it, once, as it appears: assertively for
 * an error that needs attention now, politely otherwise. A notice that is on
 * the screen when it opens is part of the screen and says nothing.
 */
import { useEffect, useRef } from '@wordpress/element';
import { speak } from '@wordpress/a11y';

/**
 * Reads `message` out whenever it changes to a text after the first render;
 * nothing while it is empty, and nothing for what the screen opened with.
 * Give it the same words the notice prints.
 *
 * @param {string}                  message
 * @param {'polite'|'assertive'}    [politeness]
 */
export const useAnnounce = ( message, politeness = 'polite' ) => {
	const opened = useRef( false );

	useEffect( () => {
		if ( ! opened.current ) {
			opened.current = true;

			return;
		}

		if ( 'string' === typeof message && '' !== message ) {
			speak( message, politeness );
		}
	}, [ message, politeness ] );
};
