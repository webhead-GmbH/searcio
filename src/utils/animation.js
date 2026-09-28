import { motion, useReducedMotion } from 'motion/react';

/**
 * The WordPress Design System motion tokens, in the units Motion takes.
 *
 * These mirror `--wpds-motion-*` from `@wordpress/theme`, which ships them as
 * CSS custom properties that a JavaScript transition object cannot read. The
 * values are asserted against that stylesheet by the scaffold tests, so the
 * copy cannot drift the way a hand-maintained duplicate otherwise would.
 *
 * Duration by weight: xs micro-delays, sm micro-interactions like focus rings
 * and state changes, md standard menu and popover transitions, lg deliberate
 * slides and reveals, xl complex multi-step transitions.
 *
 * Easing by intent: subtle for hover, colour and background; balanced for
 * on-screen movement such as resizing and layout shifts; expressive for
 * enter/exit and spatial transitions.
 */
export const motionToken = {
	duration: {
		xs: 0.05,
		sm: 0.1,
		md: 0.2,
		lg: 0.3,
		xl: 0.4,
	},
	easing: {
		subtle: [ 0.15, 0, 0.15, 1 ],
		balanced: [ 0.4, 0, 0.2, 1 ],
		expressive: [ 0.25, 0, 0, 1 ],
	},
};

/**
 * Motion honours `prefers-reduced-motion` only where it is asked to.
 *
 * `useReducedMotion` reads the media query, so a caller that ignores it
 * animates for everyone — including people who have asked the operating system
 * not to. These helpers collapse to the finished state instead of animating.
 */
export const useMotionPreference = () => {
	const prefersReducedMotion = useReducedMotion();

	return {
		prefersReducedMotion: Boolean( prefersReducedMotion ),
		duration: ( value ) => ( prefersReducedMotion ? 0 : value ),
	};
};

/**
 * A word-by-word reveal that stops being a reveal when asked to.
 *
 * This is a component rather than a plain function on purpose: reading the
 * preference means calling `useReducedMotion`, and a hook can only be called
 * from a component. As a function it could not ask, so it never did — a title
 * with five words still animated for about half a second with the operating
 * system's "reduce motion" setting on.
 */
const AnimatedText = ( { text = '', delay = 0, duration = motionToken.duration.md } ) => {
	const { prefersReducedMotion } = useMotionPreference();

	if ( prefersReducedMotion ) {
		// The finished state, not a faster reveal.
		return <>{ String( text ) }</>;
	}

	return String( text )
		.split( ' ' )
		.filter( Boolean )
		.map( ( word, index ) => (
			<motion.span
				key={ `${ word }-${ index }` }
				initial={ { opacity: 0 } }
				animate={ { opacity: 1 } }
				transition={ {
					duration,
					delay: ( index / 10 ) + delay,
					ease: motionToken.easing.balanced,
				} }
			>
				{ word }{ ' ' }
			</motion.span>
		) );
};

export const animateText = ( text = '', delay = 0, duration = motionToken.duration.md ) => (
	<AnimatedText text={ text } delay={ delay } duration={ duration } />
);

export const useFadeInUpProps = ( delay = 0, y = 12, duration = motionToken.duration.lg ) => {
	const { prefersReducedMotion } = useMotionPreference();

	if ( prefersReducedMotion ) {
		// No offset to travel and no time to travel it: the element is simply
		// there, which is what "reduced motion" asks for.
		return { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } };
	}

	return {
		initial: { opacity: 0, y },
		animate: { opacity: 1, y: 0 },
		transition: { duration, delay, ease: motionToken.easing.expressive },
	};
};

export const renderAnimatedTabTitle = ( label, suffix = '', delay = 0 ) => (
	<span className="webhead-search-cloud-animated-tab-label">
		{ animateText( label, delay, motionToken.duration.md ) }
		{ suffix ? (
			<motion.span
				initial={ { opacity: 0 } }
				animate={ { opacity: 1 } }
				transition={ {
					duration: motionToken.duration.md,
					delay: delay + motionToken.duration.md,
					ease: motionToken.easing.balanced,
				} }
				className="webhead-search-cloud-animated-tab-suffix"
			>
				{ suffix }
			</motion.span>
		) : null }
	</span>
);
