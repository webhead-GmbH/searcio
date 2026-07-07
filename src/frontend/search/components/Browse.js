import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Recent and popular searches stay visible in every state (idle, searching,
 * results) so the visitor never loses them mid-search. While a search is in
 * flight (`busy`) every clickable term is disabled to stop rapid clicking
 * from spamming overlapping requests.
 *
 * @param {Object}     props
 * @param {string[]}   props.recent
 * @param {string[]}   props.popularSearches
 * @param {string}     props.mainTitle
 * @param {JSX.Element} props.main
 * @param {boolean}    props.busy
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
	onSelect,
	onRemoveRecent,
	onClearRecent,
} ) => {
	const hasPopular = popularSearches.length > 0;

	return (
		<div className="whsc-browse">
			{ recent.length > 0 && (
				<div className="whsc-recent">
					<div className="whsc-recent__head">
						<h3 className="whsc-section-title">{ __( 'Recent searches', 'webhead-search-cloud' ) }</h3>
						<button type="button" className="whsc-clear-all" onClick={ onClearRecent } disabled={ busy }>
							{ __( 'Clear all', 'webhead-search-cloud' ) }
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
									label={ __( 'Remove from recent searches', 'webhead-search-cloud' ) }
									showTooltip={ false }
									onClick={ () => onRemoveRecent( label ) }
									disabled={ busy }
								/>
							</span>
						) ) }
					</div>
				</div>
			) }

			<div className={ `whsc-browse__columns${ hasPopular ? '' : ' whsc-browse__columns--single' }` }>
				{ hasPopular && (
					<div className="whsc-browse__aside">
						<h3 className="whsc-section-title">{ __( 'Popular searches', 'webhead-search-cloud' ) }</h3>
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
				) }

				<div className="whsc-browse__main">
					{ mainTitle && <h3 className="whsc-section-title">{ mainTitle }</h3> }
					{ main }
				</div>
			</div>
		</div>
	);
};

export default Browse;
