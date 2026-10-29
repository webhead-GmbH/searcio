import { useCallback, useEffect, useId, useLayoutEffect, useRef } from '@wordpress/element';

/** The popover never grows past this, however long its list. */
const MAX_HEIGHT = 560;
/** Nor shrinks below this, whatever room is left. */
const MIN_HEIGHT = 180;
/** Space between the popover and the bottom of the scroll area. */
const EDGE = 16;

const FOCUSABLE = 'a[href], button:not([disabled]):not([aria-disabled="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What Tab reaches inside an element, in order.
 *
 * @param {HTMLElement} root
 * @return {HTMLElement[]}
 */
export const tabbables = ( root ) =>
	root
		? Array.from( root.querySelectorAll( FOCUSABLE ) ).filter( ( node ) => ! node.closest( '[hidden]' ) && node.getClientRects().length > 0 )
		: [];

/**
 * Put the popover under its button and keep it inside the scroll area.
 *
 * Its inline start lines up with the button's - the button's right edge in a
 * right-to-left page - and it is moved back in when that would take it past
 * the header's end. Its height is what is left between its top and the bottom
 * of the scroll area; when that is short and the frame can still grow, the
 * frame grows first, by holding the body taller.
 *
 * @param {HTMLElement} popover
 * @param {HTMLElement} anchor
 */
export const placePopover = ( popover, anchor ) => {
	const header = popover?.offsetParent;

	if ( ! popover || ! anchor || ! header || ! anchor.isConnected ) {
		return;
	}

	const box = header.getBoundingClientRect();
	const button = anchor.getBoundingClientRect();
	const rtl = 'rtl' === window.getComputedStyle( header ).direction;
	const width = popover.offsetWidth;
	const start = rtl ? box.right - button.right : button.left - box.left;

	popover.style.insetInlineStart = `${ Math.max( 0, Math.min( start, box.width - width ) ) }px`;
	popover.style.insetBlockStart = `${ button.bottom - box.top + 8 }px`;
	popover.style.maxHeight = '';

	const scroller = header.closest( '.components-modal__content' );
	const frame = header.closest( '.components-modal__frame' );
	const body = header.closest( '.whsc-modal-body' );

	if ( ! scroller ) {
		return;
	}

	const wanted = Math.min( popover.scrollHeight, MAX_HEIGHT );
	const roomLeft = () => scroller.getBoundingClientRect().bottom - popover.getBoundingClientRect().top - EDGE;
	let room = roomLeft();

	if ( wanted > room && frame && body ) {
		const frameMax = parseFloat( window.getComputedStyle( frame ).maxHeight ) || window.innerHeight;
		const grow = Math.min( wanted - room, frameMax - frame.offsetHeight );

		if ( grow > 1 ) {
			body.style.minHeight = `${ body.offsetHeight + grow }px`;
			room = roomLeft();
		}
	}

	popover.style.maxHeight = `${ Math.max( MIN_HEIGHT, Math.floor( room ) ) }px`;
};

/**
 * One group's values, opened from its button in the filter bar on a tablet
 * or a desktop.
 *
 * Drawn inside the modal's header, not portalled: a portal would be outside
 * the modal's focus trap and focus return. It is a non-modal dialog. It opens
 * with focus on its first field or value. Escape closes it and gives focus
 * back to its button (the default is prevented, so the modal itself ignores
 * that Escape); Tab past its last control closes it and moves on to the next
 * button of the bar; Shift+Tab before its first goes back to its button. A
 * press anywhere else closes it. Closing never undoes a pick: every pick has
 * applied already.
 *
 * @param {Object}      props
 * @param {string}      props.id
 * @param {string}      props.title
 * @param {string}      [props.selection] What is selected, beside the title.
 * @param {string}      [props.kind]      The group's display, which sets the width.
 * @param {?HTMLElement} props.anchor     The button that opened it.
 * @param {*}           [props.layoutKey] Anything whose change can move or resize it.
 * @param {(how: {restore: boolean, next?: boolean, outside?: boolean}) => void} props.onClose
 * @param {JSX.Element} props.children
 * @param {JSX.Element} props.footer
 */
const FilterPopover = ( { id, title, selection, kind, anchor, layoutKey, onClose, children, footer } ) => {
	const ref = useRef( null );
	const titleId = useId();
	const close = useRef( onClose );

	close.current = onClose;

	const place = useCallback( () => placePopover( ref.current, anchor ), [ anchor ] );

	useLayoutEffect( () => {
		place();
	}, [ place, layoutKey ] );

	useEffect( () => {
		const scroller = ref.current?.closest( '.components-modal__content' );

		window.addEventListener( 'resize', place );
		scroller?.addEventListener( 'scroll', place, { passive: true } );

		return () => {
			window.removeEventListener( 'resize', place );
			scroller?.removeEventListener( 'scroll', place );
		};
	}, [ place ] );

	useEffect( () => {
		const first = tabbables( ref.current?.querySelector( '.whsc-pop__body' ) )[ 0 ] || tabbables( ref.current )[ 0 ];

		first?.focus( { preventScroll: true } );
	}, [] );

	useEffect( () => {
		const onPointerDown = ( event ) => {
			if ( ref.current?.contains( event.target ) || anchor?.contains( event.target ) ) {
				return;
			}

			close.current( { restore: false, outside: true } );
		};

		document.addEventListener( 'pointerdown', onPointerDown, true );

		return () => document.removeEventListener( 'pointerdown', onPointerDown, true );
	}, [ anchor ] );

	const onKeyDown = ( event ) => {
		if ( 'Escape' === event.key ) {
			event.preventDefault();
			close.current( { restore: true } );

			return;
		}

		if ( 'Tab' !== event.key ) {
			return;
		}

		const items = tabbables( ref.current );
		const active = ref.current?.ownerDocument.activeElement;

		if ( event.shiftKey && active === items[ 0 ] ) {
			event.preventDefault();
			close.current( { restore: true } );
		} else if ( ! event.shiftKey && active === items[ items.length - 1 ] ) {
			event.preventDefault();
			close.current( { restore: false, next: true } );
		}
	};

	return (
		// A dialog that is not modal: the results behind it stay in reach, and
		// they change as picks apply.
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
		<div
			ref={ ref }
			id={ id }
			className="whsc-pop"
			role="dialog"
			aria-modal="false"
			aria-labelledby={ titleId }
			data-kind={ kind }
			onKeyDown={ onKeyDown }
		>
			<div className="whsc-pop__head">
				<h3 className="whsc-pop__title whsc-facet-group__label" id={ titleId }>{ title }</h3>
				{ selection && <span className="whsc-pop__sel">{ selection }</span> }
			</div>
			<div className="whsc-pop__body">{ children }</div>
			<div className="whsc-pop__foot">{ footer }</div>
		</div>
	);
};

export default FilterPopover;
