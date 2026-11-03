import { useId, useLayoutEffect, useRef } from '@wordpress/element';
import { Modal } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import Button from './Button';

import { tabbables } from './FilterPopover';

/**
 * "All filters", and every group on a phone, in a dialog of their own: a
 * drawer at the inline end of the window when the modal is 640px wide or
 * more, a sheet from the bottom below that.
 *
 * It is a `Modal` of `@wordpress/components` nested in the search modal, which
 * the package supports through its context: it brings the focus trap, Escape
 * that closes this dialog and not the one under it, focus back to what opened
 * it, and the page and the search modal taken out of reach while it is open.
 * Closing it keeps every pick; they have applied already.
 *
 * @param {Object}   props
 * @param {string}   props.variant      `drawer` or `sheet`.
 * @param {string}   props.title
 * @param {string}   [props.selection]  What is selected, beside the title.
 * @param {boolean}  [props.single]     One group's values rather than every group.
 * @param {string}   [props.instanceClass] The placement's class, for its colours.
 * @param {() => void} props.onClose
 * @param {JSX.Element} props.children
 * @param {JSX.Element} props.footer
 */
const FilterSheet = ( { variant, title, selection, single = false, instanceClass = '', onClose, children, footer } ) => {
	const titleId = useId();
	const bodyRef = useRef( null );

	// Portalled to `body` like the search modal, so it needs the same root
	// attribute for the surface's rules to reach it (see SearchModal) - before
	// it is first painted, or it would show for a frame unstyled.
	useLayoutEffect( () => {
		document.querySelectorAll( '.whsc-sheet-overlay' ).forEach( ( overlay ) => overlay.setAttribute( 'data-webhead-frontend-root', '' ) );

		// The first value rather than the field that searches the values: on a
		// phone a focused text field opens the keyboard over half the sheet.
		const items = tabbables( bodyRef.current );
		const first = items.find( ( node ) => ! node.matches( 'input[type="search"], input[type="text"]' ) ) || items[ 0 ];

		first?.focus( { preventScroll: true } );
	}, [] );

	return (
		<Modal
			__experimentalHideHeader
			focusOnMount={ false }
			onRequestClose={ onClose }
			className={ `whsc-sheet whsc-sheet--${ variant }${ single ? ' whsc-sheet--single' : '' }${ instanceClass ? ` ${ instanceClass }` : '' }` }
			overlayClassName={ `whsc-sheet-overlay${ instanceClass ? ` ${ instanceClass }` : '' }` }
			aria={ { labelledby: titleId } }
		>
			{ 'sheet' === variant && <div className="whsc-sheet__grab" aria-hidden="true" /> }
			<div className="whsc-sheet__head">
				<h2 className="whsc-sheet__title whsc-facet-group__label" id={ titleId }>{ title }</h2>
				{ selection && <span className="whsc-pop__sel">{ selection }</span> }
				<Button
					className="whsc-sheet__close"
					icon={ closeSmall }
					label={ __( 'Close filters', 'searcio' ) }
					showTooltip={ false }
					onClick={ onClose }
				/>
			</div>
			<div className="whsc-sheet__body" ref={ bodyRef }>{ children }</div>
			<div className="whsc-sheet__foot">{ footer }</div>
		</Modal>
	);
};

export default FilterSheet;
