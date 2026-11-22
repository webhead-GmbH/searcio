import {
	createContext,
	createPortal,
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import {
	useConstrainedTabbing,
	useFocusOnMount,
	useFocusReturn,
	useMergeRefs,
	useReducedMotion,
} from '@wordpress/compose';
import { getScrollContainer } from '@wordpress/dom';
import { __ } from '@wordpress/i18n';

// The `onRequestClose` of the modals open at one level: a modal that opens asks
// the others of its level to close, and a modal that closes asks those nested in it.
const ModalContext = createContext( new Set() );

// How many modals hold each class of the body, so the last to close takes it off.
const bodyOpenClasses = new Map();

const EXIT_ANIMATION_NAME = 'components-modal__disappear-animation';

const LIVE_REGION_ROLES = new Set( [ 'alert', 'status', 'log', 'marquee', 'timer' ] );

const hiddenByDepth = [];

/**
 * Hides everything of the page from screen readers but the modal and what
 * speaks for itself. `aria-modal` alone is not kept by every browser.
 *
 * @param {Element} modal
 */
const modalize = ( modal ) => {
	const hidden = [];

	hiddenByDepth.push( hidden );

	Array.from( document.body.children ).forEach( ( element ) => {
		const role = element.getAttribute( 'role' );
		const speaks = 'SCRIPT' === element.tagName
			|| element.hasAttribute( 'hidden' )
			|| element.hasAttribute( 'aria-hidden' )
			|| element.hasAttribute( 'aria-live' )
			|| ( role && LIVE_REGION_ROLES.has( role ) );

		if ( element !== modal && ! speaks ) {
			element.setAttribute( 'aria-hidden', 'true' );
			hidden.push( element );
		}
	} );
};

const unmodalize = () => {
	( hiddenByDepth.pop() || [] ).forEach( ( element ) => element.removeAttribute( 'aria-hidden' ) );
};

/**
 * A key that is part of composing text in an input method is not a key press.
 *
 * @param {Function} handler
 */
const ignoringComposition = ( handler ) => ( event ) => {
	if ( event.nativeEvent?.isComposing || 229 === event.keyCode ) {
		return;
	}

	handler( event );
};

/**
 * Closes with the exit animation of the stylesheet, and waits for it to end.
 */
const useExitAnimation = () => {
	const frameRef = useRef( null );
	const [ leaving, setLeaving ] = useState( false );
	const reducedMotion = useReducedMotion();

	const close = useCallback( () => new Promise( ( resolve ) => {
		const frame = frameRef.current;

		if ( reducedMotion || ! frame ) {
			resolve();

			return;
		}

		const duration = Number.parseFloat( frame.ownerDocument.defaultView?.getComputedStyle( frame ).animationDuration || '0' ) * 1000;
		let onEnd;

		const ended = new Promise( ( done ) => {
			onEnd = ( event ) => {
				if ( EXIT_ANIMATION_NAME === event.animationName ) {
					done();
				}
			};

			frame.addEventListener( 'animationend', onEnd );
			setLeaving( true );
		} );
		// A fifth more than the animation lasts, in case its end is late.
		const timeout = new Promise( ( done ) => setTimeout( done, duration * 1.2 ) );

		Promise.race( [ ended, timeout ] ).then( () => {
			frame.removeEventListener( 'animationend', onEnd );
			setLeaving( false );
			resolve();
		} );
	} ), [ reducedMotion ] );

	return { close, frameRef, leaving };
};

/**
 * A modal dialog, drawn as the one of `@wordpress/components` draws it.
 *
 * The storefront used that package's `Modal`, which brought the whole package
 * with it: the date library, the rich-text editor, the data layer, more than a
 * megabyte of JavaScript on every page with a search trigger, for a dialog.
 * What a modal does is a few hooks of `@wordpress/compose`, which this puts
 * together as the package does (its code, as of version 43, is
 * GPL-2.0-or-later like this plugin): it moves the focus in and keeps it in,
 * returns it where it came from, closes on Escape and on a press outside,
 * hides the rest of the page from screen readers, and closes a modal that is
 * open beside it. It draws the same elements with the same class names, so
 * the stylesheet that drew the package's modal draws this one.
 *
 * A header is not drawn: both modals of the storefront are made without one.
 *
 * @param {Object}   props
 * @param {Function} props.onRequestClose
 * @param {*}        [props.focusOnMount=true]              As `useFocusOnMount`: `false` leaves the focus where it is.
 * @param {boolean}  [props.shouldCloseOnEsc=true]
 * @param {boolean}  [props.shouldCloseOnClickOutside=true]
 * @param {string}   [props.contentLabel]                   The dialog's accessible name.
 * @param {Object}   [props.aria]                           `labelledby` and `describedby`.
 * @param {string}   [props.className]                      On the frame.
 * @param {string}   [props.overlayClassName]
 * @param {string}   [props.bodyOpenClassName='modal-open']
 * @param {string}   [props.role='dialog']
 * @param {Function} [props.onKeyDown]                      On the frame.
 */
const Modal = forwardRef( function Modal( {
	bodyOpenClassName = 'modal-open',
	role = 'dialog',
	focusOnMount = true,
	shouldCloseOnEsc = true,
	shouldCloseOnClickOutside = true,
	aria = {},
	onRequestClose,
	children,
	style,
	overlayClassName,
	className,
	contentLabel,
	onKeyDown,
}, forwardedRef ) {
	const ref = useRef( null );
	const contentRef = useRef( null );
	const childrenRef = useRef( null );
	const focusOnMountRef = useFocusOnMount( focusOnMount );
	const constrainedTabbingRef = useConstrainedTabbing();
	const focusReturnRef = useFocusReturn();
	const [ scrolled, setScrolled ] = useState( false );
	const [ scrollable, setScrollable ] = useState( false );
	const { close, frameRef, leaving } = useExitAnimation();

	const overlayRef = useMergeRefs( [ ref, forwardedRef ] );
	const frameRefs = useMergeRefs( [ frameRef, constrainedTabbingRef, focusReturnRef, focusOnMountRef ] );

	// Whether the content scrolls, which the stylesheet and a keyboard care about.
	const checkScrollable = useCallback( () => {
		if ( contentRef.current ) {
			setScrollable( contentRef.current === getScrollContainer( contentRef.current ) );
		}
	}, [] );

	useEffect( () => {
		modalize( ref.current );

		return unmodalize;
	}, [] );

	// Fresh for the effect below, which runs once.
	const onRequestCloseRef = useRef();

	useEffect( () => {
		onRequestCloseRef.current = onRequestClose;
	}, [ onRequestClose ] );

	const dismissers = useContext( ModalContext );
	const [ nested ] = useState( () => new Set() );

	// One modal at a time at a level: the others are asked to close as this one opens.
	useEffect( () => {
		dismissers.add( onRequestCloseRef );
		dismissers.forEach( ( dismisser ) => {
			if ( dismisser !== onRequestCloseRef ) {
				dismisser.current?.();
			}
		} );

		return () => {
			nested.forEach( ( dismisser ) => dismisser.current?.() );
			dismissers.delete( onRequestCloseRef );
		};
	}, [ dismissers, nested ] );

	useEffect( () => {
		bodyOpenClasses.set( bodyOpenClassName, 1 + ( bodyOpenClasses.get( bodyOpenClassName ) || 0 ) );
		document.body.classList.add( bodyOpenClassName );

		return () => {
			const left = bodyOpenClasses.get( bodyOpenClassName ) - 1;

			if ( 0 === left ) {
				document.body.classList.remove( bodyOpenClassName );
				bodyOpenClasses.delete( bodyOpenClassName );
			} else {
				bodyOpenClasses.set( bodyOpenClassName, left );
			}
		};
	}, [ bodyOpenClassName ] );

	useLayoutEffect( () => {
		if ( ! window.ResizeObserver || ! childrenRef.current ) {
			return undefined;
		}

		const observer = new window.ResizeObserver( checkScrollable );

		observer.observe( childrenRef.current );
		checkScrollable();

		return () => observer.disconnect();
	}, [ checkScrollable ] );

	const onEscape = ( event ) => {
		if ( shouldCloseOnEsc && ( 'Escape' === event.code || 'Escape' === event.key ) && ! event.defaultPrevented ) {
			event.preventDefault();
			event.stopPropagation();
			close().then( () => onRequestClose( event ) );
		}
	};

	const onContentScroll = ( event ) => {
		const top = event?.currentTarget?.scrollTop ?? -1;

		if ( ! scrolled && top > 0 ) {
			setScrolled( true );
		} else if ( scrolled && top <= 0 ) {
			setScrolled( false );
		}
	};

	// A press on the dimmed page closes the modal, unless it began on the modal
	// and ended on the page (a drag), or is not the main button.
	let pressed = null;
	const overlayPress = {
		onPointerDown: ( event ) => {
			if ( event.target === event.currentTarget ) {
				pressed = event.target;
				// Leaves the focus where it is, so that it can be returned.
				event.preventDefault();
			}
		},
		onPointerUp: ( { target, button } ) => {
			const same = target === pressed;

			pressed = null;

			if ( 0 === button && same ) {
				close().then( () => onRequestClose() );
			}
		},
	};

	return createPortal(
		<ModalContext.Provider value={ nested }>
			{ /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */ }
			<div
				ref={ overlayRef }
				className={ [ 'components-modal__screen-overlay', leaving ? 'is-animating-out' : '', overlayClassName ].filter( Boolean ).join( ' ' ) }
				onKeyDown={ ignoringComposition( onEscape ) }
				{ ...( shouldCloseOnClickOutside ? overlayPress : {} ) }
			>
				<div
					className={ [ 'components-modal__frame', className ].filter( Boolean ).join( ' ' ) }
					style={ style }
					ref={ frameRefs }
					role={ role }
					aria-label={ contentLabel }
					aria-labelledby={ contentLabel ? undefined : aria.labelledby }
					aria-describedby={ aria.describedby }
					tabIndex={ -1 }
					onKeyDown={ onKeyDown }
				>
					<div
						className={ [ 'components-modal__content', 'hide-header', scrollable ? 'is-scrollable' : '', scrolled ? 'has-scrolled-content' : '' ].filter( Boolean ).join( ' ' ) }
						role="document"
						onScroll={ onContentScroll }
						ref={ contentRef }
						aria-label={ scrollable ? __( 'Scrollable section', 'searcio' ) : undefined }
						tabIndex={ scrollable ? 0 : undefined }
					>
						<div ref={ childrenRef } className="components-modal__children-container">
							{ children }
						</div>
					</div>
				</div>
			</div>
		</ModalContext.Provider>,
		document.body
	);
} );

export default Modal;
