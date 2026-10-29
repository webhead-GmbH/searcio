import { useEffect, useLayoutEffect, useRef, useState } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { chevronDown, funnel } from '@wordpress/icons';
import { __, _n, sprintf } from '@wordpress/i18n';

import { fitFilterButtons, formatCount } from '../../../utils/facets';

/** Space between two buttons of the bar, as the stylesheet sets it. */
const GAP = 8;
/** Room the count on "All filters" takes once a value is picked, kept free from the start. */
const BADGE_ROOM = 28;

/**
 * The row of filter controls under the search field.
 *
 * On a tablet or a desktop: the type switch, as many group buttons as fit (at
 * most `limit`), and "All filters" at the end. On a phone: "Filters" fixed at
 * the start, outside the row that scrolls, so it can never cover a scrolled
 * button, then the type pills and the group buttons in one row that scrolls
 * sideways.
 *
 * Which groups fit is measured when the search, the width or the language
 * changes (`fitKey`), never when a value is picked: an active group keeps the
 * button it has, a group picked inside "All filters" does not move into the
 * bar until the next search, and a selected button shortens its own value
 * rather than pushing another out. Every control is a `.whsc-facet`, so a
 * site's styling of the old filter chips reaches it.
 *
 * @param {Object}   props
 * @param {boolean}  props.narrow       The modal is under 640px wide.
 * @param {Array<{value: string, count: number}>} props.types
 * @param {string[]} props.activeTypes
 * @param {boolean}  props.showTypes
 * @param {(type: string) => void} props.onType '' for all types.
 * @param {Object<string,string>} props.typeLabels
 * @param {string}   [props.allTypesLabel]
 * @param {boolean}  props.showCount
 * @param {string[]} props.groups      In bar order.
 * @param {(field: string) => {text: string, name: string, value: string, more: number, hidden: string}} props.buttonLabel
 * @param {(field: string) => boolean} props.isActive
 * @param {string}   props.openField   The group whose popover or sheet is open.
 * @param {boolean}  props.allOpen     "All filters" is open.
 * @param {string}   props.popoverId
 * @param {number}   props.activeCount
 * @param {number}   props.limit
 * @param {string}   props.fitKey
 * @param {(field: string, button: HTMLElement) => void} props.onGroup
 * @param {(button: HTMLElement) => void} props.onAll
 */
const FilterBar = ( {
	narrow,
	types,
	activeTypes,
	showTypes,
	onType,
	typeLabels,
	allTypesLabel,
	showCount,
	groups,
	buttonLabel,
	isActive,
	openField,
	allOpen,
	popoverId,
	activeCount,
	limit,
	fitKey,
	onGroup,
	onAll,
} ) => {
	const barRef = useRef( null );
	const scrollRef = useRef( null );
	const [ visible, setVisible ] = useState( null );
	const groupKey = groups.join( '|' );

	useLayoutEffect( () => {
		const bar = barRef.current;

		if ( ! bar ) {
			return;
		}

		const active = groups.filter( isActive );

		// A phone's row scrolls, so it shows the groups up to the limit
		// without measuring them.
		if ( narrow ) {
			setVisible( limit <= 0 ? [] : [ ...new Set( [ ...active, ...groups.filter( ( field ) => ! active.includes( field ) ).slice( 0, Math.max( 0, limit - active.length ) ) ] ) ] );

			return;
		}

		const buttons = Array.from( bar.querySelectorAll( '.whsc-filter-btn[data-field]' ) );
		// Shown for the measuring and hidden again as React last left them:
		// React only writes `hidden` when its own value changes, so one left
		// shown here would stay shown.
		const wasHidden = buttons.map( ( button ) => button.hidden );

		bar.classList.add( 'is-measuring' );
		buttons.forEach( ( button ) => {
			button.hidden = false;
		} );

		const fixed = Array.from( bar.children )
			.filter( ( child ) => ! child.matches( '.whsc-filter-btn[data-field]' ) )
			.reduce( ( sum, child ) => sum + child.getBoundingClientRect().width + GAP, 0 ) + ( activeCount > 0 ? 0 : BADGE_ROOM );
		const widths = buttons.map( ( button ) => [ button.dataset.field, button.getBoundingClientRect().width ] );

		bar.classList.remove( 'is-measuring' );
		buttons.forEach( ( button, index ) => {
			button.hidden = wasHidden[ index ];
		} );
		setVisible( fitFilterButtons( { widths, available: bar.clientWidth - fixed, pinned: active, limit, gap: GAP } ) );
		// Only a new search, width or language measures again - never a pick.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ fitKey, groupKey, narrow, limit, showTypes ] );

	// The phone's row fades out at its end while there is more to scroll to.
	// `scrollLeft` counts down from 0 in a right-to-left page.
	useEffect( () => {
		const row = scrollRef.current;

		if ( ! row ) {
			return undefined;
		}

		const update = () => row.classList.toggle( 'has-more', row.scrollWidth - row.clientWidth - Math.abs( row.scrollLeft ) > 4 );

		update();
		row.addEventListener( 'scroll', update, { passive: true } );

		return () => row.removeEventListener( 'scroll', update );
	} );

	const shown = ( field ) => null === visible || visible.includes( field );

	const typeButton = ( value, label, count ) => {
		const pressed = '' === value ? 0 === activeTypes.length : activeTypes.includes( value );

		return (
			<button
				key={ value || 'all' }
				type="button"
				aria-pressed={ pressed }
				className={ `whsc-facet whsc-type${ pressed ? ' is-active' : '' }` }
				onClick={ () => onType( value ) }
			>
				<span className="whsc-facet__label">{ label }</span>
				{ showCount && undefined !== count && <span className="whsc-facet__count">{ formatCount( count ) }</span> }
			</button>
		);
	};

	const typeSwitch = showTypes && (
		// A group of independent toggle buttons, not a tablist: more than one
		// type can be pressed at once.
		<div className="whsc-types" role="group" aria-label={ __( 'Filter by type', 'searcio' ) }>
			{ /* On a phone "All" is the state with no type pressed. */ }
			{ ! narrow && typeButton( '', allTypesLabel || __( 'All', 'searcio' ) ) }
			{ types.map( ( facet ) => typeButton( facet.value, typeLabels[ facet.value ] || facet.value, facet.count ) ) }
		</div>
	);

	const groupButtons = groups.map( ( field ) => {
		const label = buttonLabel( field );
		const active = isActive( field );
		const open = openField === field;

		return (
			<button
				key={ field }
				type="button"
				data-field={ field }
				hidden={ ! shown( field ) }
				className={ `whsc-facet whsc-filter-btn${ active ? ' is-active' : '' }` }
				aria-haspopup="dialog"
				aria-expanded={ open }
				aria-controls={ open && ! narrow ? popoverId : undefined }
				// The values the "+1" stands for are read out too, so the name
				// runs on from what the button shows: "Colour: Olive, Black".
				aria-label={ label.more > 0 ? `${ label.text }${ label.hidden }` : undefined }
				onClick={ ( event ) => onGroup( field, event.currentTarget ) }
			>
				<span className="whsc-facet__label">
					{ '' === label.value ? label.name : (
						<>
							{ sprintf(
								/* translators: %s: filter name, e.g. "Colour"; the selected value follows. */
								__( '%s:', 'searcio' ),
								label.name
							) }
							{ ' ' }
							<bdi>{ label.value }</bdi>
						</>
					) }
				</span>
				{ label.more > 0 && <span className="whsc-filter-btn__more" aria-hidden="true">+{ label.more }</span> }
				<Icon icon={ chevronDown } className="whsc-chev" size={ 20 } />
			</button>
		);
	} );

	const allButton = (
		<button
			type="button"
			className={ `whsc-facet whsc-filter-btn whsc-filter-btn--all${ activeCount > 0 ? ' has-badge' : '' }` }
			aria-haspopup="dialog"
			aria-expanded={ allOpen }
			onClick={ ( event ) => onAll( event.currentTarget ) }
		>
			<Icon icon={ funnel } className="whsc-filter-btn__icon" size={ 20 } />
			<span className="whsc-facet__label">{ narrow ? __( 'Filters', 'searcio' ) : __( 'All filters', 'searcio' ) }</span>
			{ activeCount > 0 && (
				<>
					<span className="whsc-visually-hidden">
						{ sprintf(
							/* translators: %d: number of filter values applied. */
							_n( ', %d active', ', %d active', activeCount, 'searcio' ),
							activeCount
						) }
					</span>
					<span className="whsc-badge" aria-hidden="true">{ activeCount }</span>
				</>
			) }
		</button>
	);

	const hasGroups = groups.length > 0;
	const divider = typeSwitch && hasGroups && <span className="whsc-filterbar__divider" aria-hidden="true" />;

	if ( ! typeSwitch && ! hasGroups ) {
		return null;
	}

	return (
		<div className={ `whsc-filterbar${ narrow ? ' is-narrow' : '' }` } role="group" aria-label={ __( 'Filters', 'searcio' ) } ref={ barRef }>
			{ narrow ? (
				<>
					{ hasGroups && allButton }
					<div className="whsc-filterbar__scroll" ref={ scrollRef }>
						{ typeSwitch }
						{ divider }
						{ groupButtons }
					</div>
				</>
			) : (
				<>
					{ typeSwitch }
					{ divider }
					{ groupButtons }
					{ hasGroups && allButton }
				</>
			) }
		</div>
	);
};

export default FilterBar;
