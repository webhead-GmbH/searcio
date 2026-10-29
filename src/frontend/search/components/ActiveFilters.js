import { useLayoutEffect, useRef } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * The filters applied, on the result line: one chip per value or bound, each
 * of which takes it away, and one "Reset all".
 *
 * After a removal focus goes to the chip that took the removed one's place,
 * then to "Reset all", and when nothing is left to the result heading - never
 * to the page under the modal. On a phone the stylesheet leaves only "Reset
 * all": the bar's labels and the count on "Filters" already show the
 * selection.
 *
 * @param {Object}   props
 * @param {Array<{key: string, field: string, value: string, name: string, label: string}>} props.chips
 * @param {boolean}  [props.showReset]
 * @param {(chip: Object) => void} props.onRemove
 * @param {() => void} props.onReset
 * @param {{current: ?HTMLElement}} [props.fallbackRef] What takes focus when nothing is left.
 */
const ActiveFilters = ( { chips, showReset = true, onRemove, onReset, fallbackRef } ) => {
	const listRef = useRef( null );
	const resetRef = useRef( null );
	const pending = useRef( null );

	useLayoutEffect( () => {
		if ( null === pending.current ) {
			return;
		}

		const index = pending.current;
		const buttons = Array.from( listRef.current?.querySelectorAll( '.whsc-active-chip' ) || [] );
		const next = buttons[ Math.min( index, buttons.length - 1 ) ] || resetRef.current || fallbackRef?.current;

		pending.current = null;
		next?.focus();
	} );

	if ( 0 === chips.length ) {
		return null;
	}

	return (
		<>
			<ul className="whsc-active" aria-label={ __( 'Active filters', 'searcio' ) } ref={ listRef }>
				{ chips.map( ( chip, index ) => (
					<li className="whsc-active__item" key={ chip.key }>
						<button
							type="button"
							className="whsc-facet whsc-active-chip"
							aria-label={ sprintf(
								/* translators: %s: a filter and its value, e.g. "Colour: Olive". */
								__( 'Remove %s', 'searcio' ),
								sprintf(
									/* translators: 1: filter name, e.g. "Colour". 2: what is selected in it, e.g. "Olive". */
									__( '%1$s: %2$s', 'searcio' ),
									chip.name,
									chip.label
								)
							) }
							onClick={ () => {
								pending.current = index;
								onRemove( chip );
							} }
						>
							<span className="whsc-active-chip__name"><bdi>{ chip.name }</bdi>:</span>
							<span className="whsc-facet__label"><bdi>{ chip.label }</bdi></span>
							<Icon icon={ closeSmall } className="whsc-active-chip__icon" size={ 18 } />
						</button>
					</li>
				) ) }
			</ul>
			{ showReset && (
				<button
					type="button"
					className="whsc-link-btn"
					ref={ resetRef }
					onClick={ () => {
						pending.current = 0;
						onReset();
					} }
				>
					{ __( 'Reset all', 'searcio' ) }
				</button>
			) }
		</>
	);
};

export default ActiveFilters;
