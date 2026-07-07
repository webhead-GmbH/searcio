import { motion } from 'motion/react';

export const animateText = ( text = '', delay = 0, duration = 0.25 ) => {
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
				} }
			>
				{ word }{ ' ' }
			</motion.span>
		) );
};

export const fadeInUpProps = ( delay = 0, y = 12, duration = 0.25 ) => ( {
	initial: { opacity: 0, y },
	animate: { opacity: 1, y: 0 },
	transition: { duration, delay },
} );

export const renderAnimatedTabTitle = ( label, suffix = '', delay = 0 ) => (
	<span className="webhead-search-cloud-animated-tab-label">
		{ animateText( label, delay, 0.18 ) }
		{ suffix ? (
			<motion.span
				initial={ { opacity: 0 } }
				animate={ { opacity: 1 } }
				transition={ { duration: 0.2, delay: delay + 0.18 } }
				className="webhead-search-cloud-animated-tab-suffix"
			>
				{ suffix }
			</motion.span>
		) : null }
	</span>
);
