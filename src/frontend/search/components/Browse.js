import { useLayoutEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

import { NARROW, useMediaQuery } from '../../../utils/mediaQuery';

/**
 * Recent and popular searches stay visible in every state (idle, searching,
 * results) so the visitor never loses them mid-search. While a search is in
 * flight (`busy`) every clickable term is disabled to stop rapid clicking
 * from spamming overlapping requests.
 *
 * On a narrow screen everything stacks in one column, and with the helpers
 * first the results landed below them - at 320px entirely out of sight, so
 * submitting a search changed nothing on screen. There, once a search is on,
 * the results come first and the helpers follow. The DOM order changes rather
 * than the CSS `order`, so keyboard focus moves in the order things are seen.
 * The results keep their place in the tree either way - only the helpers move
 * round them - so a carousel, its page and the focus inside it survive the
 * switch; and a helper that moves while it has focus (a popular search picked
 * on a phone) hands focus to the results heading instead of dropping it.
 *
 * @param {Object}     props
 * @param {string[]}   props.recent
 * @param {string[]}   props.popularSearches
 * @param {string}     props.mainTitle
 * @param {JSX.Element} props.main
 * @param {boolean}    props.busy
 * @param {boolean}    props.searchActive Whether a search is running or showing results.
 * @param {(label: string) => void} props.onSelect
 * @param {(label: string) => void} props.onRemoveRecent
 * @param {() => void}              props.onClearRecent
 */
const Browse = ( {
	recent,
	popularSearches,
	mainTitle,
	main,
	busy,
	searchActive = false,
	onSelect,
	onRemoveRecent,
	onClearRecent,
} ) => {
	const hasPopular = popularSearches.length > 0;
	const isNarrow = useMediaQuery( NARROW );
	const resultsFirst = searchActive && isNarrow;
	const headingRef = useRef( null );

	// Moving a helper unmounts the button that was pressed, and focus falls to
	// the page body, outside the modal. Give it to the results instead.
	useLayoutEffect( () => {
		const heading = headingRef.current;
		const active = heading?.ownerDocument.activeElement;

		if ( resultsFirst && heading && ( ! active || active === heading.ownerDocument.body ) ) {
			heading.focus();
		}
	}, [ resultsFirst ] );

	const recentSearches = recent.length > 0 && (
		<div className="whsc-recent">
			<div className="whsc-recent__head">
				<h3 className="whsc-section-title">{ __( 'Recent searches', 'searcio' ) }</h3>
				<button type="button" className="whsc-clear-all" onClick={ onClearRecent } disabled={ busy }>
					{ __( 'Clear all', 'searcio' ) }
				</button>
			</div>
			<div className="whsc-chip-row">
				{ recent.map( ( label ) => (
					<span className="whsc-chip" key={ label }>
						<button
							type="button"
							className="whsc-chip__label"
							title={ label }
							onClick={ () => onSelect( label ) }
							disabled={ busy }
						>
							{ label }
						</button>
						<Button
							className="whsc-chip__remove"
							icon={ closeSmall }
							label={ __( 'Remove from recent searches', 'searcio' ) }
							showTooltip={ false }
							onClick={ () => onRemoveRecent( label ) }
							disabled={ busy }
						/>
					</span>
				) ) }
			</div>
		</div>
	);

	const popular = hasPopular && (
		<div className="whsc-browse__aside">
			<h3 className="whsc-section-title">{ __( 'Popular searches', 'searcio' ) }</h3>
			<ul className="whsc-popular-list">
				{ popularSearches.map( ( label ) => (
					<li key={ label }>
						<button
							type="button"
							className="whsc-popular-item"
							title={ label }
							onClick={ () => onSelect( label ) }
							disabled={ busy }
						>
							{ label }
						</button>
					</li>
				) ) }
			</ul>
		</div>
	);

	const results = (
		<div className="whsc-browse__main">
			{ mainTitle && (
				<h3 className="whsc-section-title" ref={ headingRef } tabIndex={ -1 }>
					{ mainTitle }
				</h3>
			) }
			{ main }
		</div>
	);

	const classes = [
		'whsc-browse',
		hasPopular ? '' : 'whsc-browse--single',
		resultsFirst ? 'whsc-browse--results-first' : '',
	].filter( Boolean ).join( ' ' );

	return (
		<div className={ classes }>
			{ ! resultsFirst && recentSearches }
			{ ! resultsFirst && popular }
			{ results }
			{ resultsFirst && recentSearches }
			{ resultsFirst && popular }
		</div>
	);
};

export default Browse;
