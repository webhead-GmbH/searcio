/**
 * Webhead scaffold managed file.
 *
 * The house modal. Reach for this rather than `Modal` from
 * `@wordpress/components` on any admin surface: it carries the blurred backdrop,
 * the open/close motion, and the size presets the rest of the screens use.
 *
 * It is **mounted always and told whether it is open**, because
 * `AnimatePresence` has to outlive its child to run an exit animation:
 *
 *     <TheModal isOpen={ showing } onClose={ () => setShowing( false ) } />   // correct
 *     { showing && <TheModal … /> }                                          // no animation, either way
 *
 * Conditional mounting breaks both halves and neither one errors: `initial={ false }`
 * means a modal mounted already-open simply appears, and unmounting takes
 * `AnimatePresence` away at the same moment as its child, so the exit has nothing
 * left to run on.
 */
import { Button } from '@wordpress/components';
import { createPortal, useCallback, useEffect, useId, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { close as CloseIcon } from '@wordpress/icons';

import { Stack } from '@wordpress/ui';

// The component owns its stylesheet so `components:add modal` needs no wiring
// step: an added modal that renders unstyled reports nothing.
import './modal.scss';

const SIZES = {
	small: 400,
	medium: 500,
	large: 800,
	'x-large': 950,
	full: '95%',
};

const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join( ',' );

/**
 * @param {Object}      props
 * @param {boolean}     props.isOpen                     Whether the modal is showing.
 * @param {Function}    props.onClose                    Called when it should close.
 * @param {string}      props.title                      Announced as the dialog's name.
 * @param {import('react').ReactNode} props.children     Body content.
 * @param {Array}       [props.actions]                  Footer buttons, in order.
 * @param {import('react').ReactNode} [props.footer]     Custom footer, replacing `actions`.
 * @param {boolean}     [props.showCloseButton]          Header close affordance.
 * @param {boolean}     [props.closeOnBackdropClick]     Clicking the backdrop closes it.
 * @param {boolean}     [props.closeOnEscape]            Escape closes it.
 * @param {string}      [props.size]                     small | medium | large | x-large | full.
 * @param {number}      [props.maxWidth]                 Overrides the size preset.
 * @param {Function}    [props.onBeforeClose]            Return false to prevent closing.
 * @param {string}      [props.className]                Extra class on the dialog.
 */
function Modal( {
	isOpen,
	onClose,
	title,
	children,
	actions = [],
	footer,
	showCloseButton = true,
	closeOnBackdropClick = true,
	closeOnEscape = true,
	size = 'medium',
	maxWidth,
	onBeforeClose,
	className = '',
} ) {
	// Generated per instance: a fixed id would collide the moment two modals are
	// mounted at once, and aria-labelledby would then name the wrong dialog.
	const titleId = useId();
	const dialogRef = useRef( null );
	const returnFocusTo = useRef( null );
	const reduceMotion = useReducedMotion();

	const width = maxWidth ?? SIZES[ size ] ?? SIZES.medium;

	const handleClose = useCallback( () => {
		if ( onBeforeClose && false === onBeforeClose() ) {
			return;
		}

		onClose();
	}, [ onBeforeClose, onClose ] );

	// Escape, body scroll lock, and focus: taken on open, returned on close.
	useEffect( () => {
		if ( ! isOpen ) {
			return undefined;
		}

		returnFocusTo.current = document.activeElement;

		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key && closeOnEscape ) {
				handleClose();

				return;
			}

			// Focus stays inside the dialog while it is open, which is what makes
			// it a dialog rather than a decorated div.
			if ( 'Tab' !== event.key || ! dialogRef.current ) {
				return;
			}

			const focusable = [ ...dialogRef.current.querySelectorAll( FOCUSABLE ) ]
				.filter( ( node ) => null !== node.offsetParent );

			if ( 0 === focusable.length ) {
				return;
			}

			const first = focusable[ 0 ];
			const last = focusable[ focusable.length - 1 ];

			if ( event.shiftKey && document.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && document.activeElement === last ) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const focusTimer = window.setTimeout( () => {
			const target = dialogRef.current?.querySelector( FOCUSABLE ) ?? dialogRef.current;
			target?.focus?.();
		}, 0 );

		return () => {
			document.removeEventListener( 'keydown', onKeyDown );
			document.body.style.overflow = previousOverflow;
			window.clearTimeout( focusTimer );

			if ( returnFocusTo.current instanceof HTMLElement ) {
				returnFocusTo.current.focus();
			}
		};
	}, [ isOpen, closeOnEscape, handleClose ] );

	// Every animated property collapses to its finished state when the visitor
	// has asked their system for reduced motion.
	const backdropMotion = reduceMotion
		? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
		: {
			initial: { opacity: 0, backdropFilter: 'blur(0px)' },
			animate: { opacity: 1, backdropFilter: 'blur(5px)' },
			exit: { opacity: 0, backdropFilter: 'blur(0px)' },
			transition: { duration: 0.25, ease: 'easeOut' },
		};

	// The dialog turns in three dimensions on the way in and out. That needs
	// `perspective` on the backdrop and `transform-style: preserve-3d` on the
	// dialog, both of which the stylesheet sets: without them the rotation
	// flattens and the whole effect reads as a plain fade.
	const dialogMotion = reduceMotion
		? {
			initial: { opacity: 1, scale: 1, rotateX: 0, rotateY: 0, z: 0 },
			animate: { opacity: 1, scale: 1, rotateX: 0, rotateY: 0, z: 0 },
			exit: { opacity: 1, scale: 1, rotateX: 0, rotateY: 0, z: 0 },
			transition: { duration: 0 },
		}
		: {
			initial: { opacity: 0, scale: 0.96, rotateX: 12, rotateY: 24, z: -80 },
			animate: { opacity: 1, scale: 1, rotateX: 0, rotateY: 0, z: 0 },
			exit: { opacity: 0, scale: 0.9, rotateX: 12, rotateY: 24, z: -80 },
			transition: { duration: 0.3, ease: [ 0.25, 0.46, 0.45, 0.94 ] },
		};

	const renderFooter = () => {
		if ( footer ) {
			return footer;
		}

		if ( 0 === actions.length ) {
			return null;
		}

		return (
			<div className="webhead-search-cloud-modal__actions">
				{ actions.map( ( action, index ) => (
					<Button
						__next40pxDefaultSize
						key={ action.key || index }
						variant={ action.variant || 'secondary' }
						isDestructive={ action.isDestructive || false }
						disabled={ action.disabled || false }
						icon={ action.icon }
						onClick={ () => {
							action.onClick?.();

							if ( false !== action.closeOnClick ) {
								handleClose();
							}
						} }
						{ ...( action.buttonProps || {} ) }
					>
						{ action.label }
					</Button>
				) ) }
			</div>
		);
	};

	return createPortal(
		<AnimatePresence initial={ false }>
			{ isOpen && (
				<motion.div
					key="backdrop"
					className="webhead-search-cloud-modal__backdrop"
					{ ...backdropMotion }
					onClick={ closeOnBackdropClick ? handleClose : undefined }
				>
					<motion.div
						key="dialog"
						ref={ dialogRef }
						role="dialog"
						aria-modal="true"
						aria-labelledby={ titleId }
						tabIndex={ -1 }
						className={ `webhead-search-cloud-modal ${ className }`.trim() }
						style={ { maxWidth: width } }
						{ ...dialogMotion }
						onClick={ ( event ) => event.stopPropagation() }
					>
						<div className="webhead-search-cloud-modal__header">
							<h2 id={ titleId } className="webhead-search-cloud-modal__title">
								{ title }
							</h2>
							{ showCloseButton && (
								<Button
									__next40pxDefaultSize
									className="webhead-search-cloud-modal__close"
									icon={ CloseIcon }
									label={ __( 'Close', 'webhead-search-cloud' ) }
									onClick={ handleClose }
								/>
							) }
						</div>

						<div className="webhead-search-cloud-modal__body">
							<Stack direction="column" gap="lg">
								{ children }
								{ renderFooter() }
							</Stack>
						</div>
					</motion.div>
				</motion.div>
			) }
		</AnimatePresence>,
		document.body
	);
}

export default Modal;
