import { Children, cloneElement, createPortal, useEffect, useLayoutEffect, useRef, useState } from '@wordpress/element';
import { useInstanceId } from '@wordpress/compose';

const DELAY = 700;

// The gap between the button and the tooltip, as the package leaves it.
const GAP = 4;

// What the stylesheet scopes the surface's overlays by.
const LAYER_CLASS = 'whsc-tooltip-layer';

/** The element the tooltips are drawn in: at the end of `body`, marked as an overlay of the surface. */
const layer = () => {
	let element = document.querySelector( `.${ LAYER_CLASS }` );

	if ( ! element ) {
		element = document.createElement( 'div' );
		element.className = LAYER_CLASS;
		element.setAttribute( 'data-webhead-frontend-overlay', '' );
		document.body.appendChild( element );
	}

	return element;
};

/**
 * A tooltip for an icon button: the text of its label, above it, after the
 * pointer has rested on it for a moment or as soon as it takes focus from the
 * keyboard.
 *
 * The storefront drew these with `Tooltip` of `@wordpress/components`, which
 * is a positioning engine and the package it comes in. This does what an icon
 * button needs of it, in the element and the class that package's stylesheet
 * draws (`components-tooltip`): it opens on hover after 700 ms and on focus
 * from the keyboard, closes on leaving, on blur, on Escape and on a click, is
 * not opened by a touch, sits above its button and goes below it where there is
 * no room, and keeps inside the window.
 *
 * @param {Object}  props
 * @param {string}  props.text     What the tooltip says, the button's label.
 * @param {Element} props.children The button: one element.
 * @param {number}  [props.delay=700]
 */
const Tooltip = ( { text, children, delay = DELAY } ) => {
	const [ anchor, setAnchor ] = useState( null );
	const [ place, setPlace ] = useState( null );
	const timer = useRef( 0 );
	const tip = useRef( null );
	const id = useInstanceId( Tooltip, 'whsc-tooltip' );
	const child = Children.only( children );

	const hide = () => {
		window.clearTimeout( timer.current );
		setAnchor( null );
		setPlace( null );
	};

	useEffect( () => () => window.clearTimeout( timer.current ), [] );

	// Placed once it is drawn and its size is known: above the button, centred,
	// below it where the top of the window is in the way, inside the window.
	useLayoutEffect( () => {
		if ( ! anchor || ! tip.current ) {
			return;
		}

		const button = anchor.getBoundingClientRect();
		const box = tip.current.getBoundingClientRect();
		const width = document.documentElement.clientWidth;
		const above = button.top - box.height - GAP;
		const left = Math.min( Math.max( button.left + ( button.width - box.width ) / 2, 0.5 ), Math.max( width - box.width - 0.5, 0.5 ) );

		setPlace( { top: above >= 0.5 ? above : button.bottom + GAP, left } );
	}, [ anchor, text ] );

	const call = ( name, event ) => child.props[ name ]?.( event );
	const show = ( element, wait ) => {
		window.clearTimeout( timer.current );
		timer.current = window.setTimeout( () => setAnchor( element ), wait );
	};

	const props = {
		onPointerEnter: ( event ) => {
			call( 'onPointerEnter', event );

			// A touch has no pointer resting on the button to speak of.
			if ( 'mouse' === event.pointerType || 'pen' === event.pointerType ) {
				show( event.currentTarget, delay );
			}
		},
		onPointerLeave: ( event ) => {
			call( 'onPointerLeave', event );
			hide();
		},
		onFocus: ( event ) => {
			call( 'onFocus', event );

			let fromKeyboard = false;

			try {
				fromKeyboard = event.currentTarget.matches( ':focus-visible' );
			} catch ( error ) {
				// A browser that does not know the selector shows none.
			}

			if ( fromKeyboard ) {
				show( event.currentTarget, 0 );
			}
		},
		onBlur: ( event ) => {
			call( 'onBlur', event );
			hide();
		},
		onClick: ( event ) => {
			call( 'onClick', event );
			hide();
		},
		onKeyDown: ( event ) => {
			call( 'onKeyDown', event );

			if ( 'Escape' === event.key && anchor ) {
				hide();
			}
		},
	};

	// The tooltip says what the label says, so there is nothing to add to it for a screen reader.
	const described = anchor && text && child.props[ 'aria-label' ] !== text && undefined === child.props[ 'aria-describedby' ];

	return (
		<>
			{ cloneElement( child, described ? { ...props, 'aria-describedby': id } : props ) }
			{ anchor && text && createPortal(
				<div
					ref={ tip }
					id={ id }
					role="tooltip"
					className="components-tooltip"
					style={ { position: 'fixed', top: place?.top ?? 0, left: place?.left ?? 0, visibility: place ? 'visible' : 'hidden' } }
				>
					{ text }
				</div>,
				layer()
			) }
		</>
	);
};

export default Tooltip;
