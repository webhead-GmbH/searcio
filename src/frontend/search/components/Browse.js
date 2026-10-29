import { useLayoutEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * The area under the search field.
 *
 * Recent and popular searches are shown while no search is on (`helpers`
 * `all`, beside the highlights) and when a search found nothing (`popular`,
 * as chips under the message, where they help most). With results on screen
 * they are gone, and the results start right under the filter bar. While a
 * search is in flight (`busy`) every clickable term is disabled, so rapid
 * clicks cannot send overlapping requests.
 *
 * Picking a recent or popular search unmounts the button that was pressed,
 * and focus would fall to the page under the modal. It goes to the results
 * heading instead.
 *
 * @param {Object}     props
 * @param {string[]}   props.recent
 * @param {string[]}   props.popularSearches
 * @param {string}     props.mainTitle
 * @param {string}     [props.query]     The search the results are for, beside the count.
 * @param {JSX.Element} [props.meta]     The active filters, on the result line.
 * @param {JSX.Element} props.main
 * @param {boolean}    props.busy
 * @param {string}     [props.helpers]   `all`, `popular` or `none`.
 * @param {{current: ?HTMLElement}} [props.headingRef]
 * @param {(label: string, kind: string) => void} props.onSelect Called with the term and `recent` or `popular`.
 * @param {(label: string) => void} props.onRemoveRecent
 * @param {() => void}              props.onClearRecent
 */
const Browse = ( {
	recent,
	popularSearches,
	mainTitle,
	query = '',
	meta = null,
	main,
	busy,
	helpers = 'all',
	headingRef: givenHeadingRef,
	onSelect,
	onRemoveRecent,
	onClearRecent,
} ) => {
	const ownHeadingRef = useRef( null );
	const headingRef = givenHeadingRef || ownHeadingRef;
	const mounted = useRef( false );
	const showRecent = 'all' === helpers && recent.length > 0;
	const showPopular = 'none' !== helpers && popularSearches.length > 0;

	// Not as the window opens: it focuses its search field itself, and in the
	// Elementor editor's preview it takes no focus at all.
	useLayoutEffect( () => {
		if ( ! mounted.current ) {
			mounted.current = true;

			return;
		}

		const heading = headingRef.current;
		const active = heading?.ownerDocument.activeElement;

		if ( heading && ( ! active || active === heading.ownerDocument.body ) ) {
			heading.focus();
		}
	}, [ helpers, headingRef ] );

	const recentSearches = showRecent && (
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
							onClick={ () => onSelect( label, 'recent' ) }
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

	const popular = showPopular && (
		<div className={ `whsc-browse__aside${ 'popular' === helpers ? ' whsc-browse__aside--after' : '' }` }>
			<h3 className="whsc-section-title">{ __( 'Popular searches', 'searcio' ) }</h3>
			<ul className="whsc-popular-list">
				{ popularSearches.map( ( label ) => (
					<li key={ label }>
						<button
							type="button"
							className="whsc-popular-item"
							title={ label }
							onClick={ () => onSelect( label, 'popular' ) }
							disabled={ busy }
						>
							{ label }
						</button>
					</li>
				) ) }
			</ul>
		</div>
	);

	const heading = mainTitle && (
		<h3 className="whsc-section-title" ref={ headingRef } tabIndex={ -1 }>
			{ mainTitle }
		</h3>
	);

	const results = (
		<div className="whsc-browse__main">
			{ meta || '' !== query.trim() ? (
				<div className="whsc-meta">
					<div className="whsc-meta__title">
						{ heading }
						{ '' !== query.trim() && (
							<span className="whsc-meta__query">
								{ sprintf(
									/* translators: %s: the search term the results are for. */
									__( 'for “%s”', 'searcio' ),
									query.trim()
								) }
							</span>
						) }
					</div>
					{ meta }
				</div>
			) : heading }
			{ main }
		</div>
	);

	const classes = [
		'whsc-browse',
		'all' === helpers && showPopular ? '' : 'whsc-browse--single',
	].filter( Boolean ).join( ' ' );

	return (
		<div className={ classes }>
			{ recentSearches }
			{ 'all' === helpers && popular }
			{ results }
			{ 'popular' === helpers && popular }
		</div>
	);
};

export default Browse;
