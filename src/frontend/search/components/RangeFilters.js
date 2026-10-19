import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import { humanizeFieldLabel } from '../../../utils/facets';

/**
 * Bounds for the numeric fields a site has configured as facets - price above
 * all, but rating and review count work the same way.
 *
 * A number is not a chip. The API aggregates facets into exact values, which
 * for a price field means one bucket per price, so chips were never a usable
 * control here (and, since a numeric field has no `.keyword` to aggregate on,
 * there were no buckets at all). `range[field]=min:max` is the API's answer,
 * and two bounds are the honest control for it: the catalogue's true minimum
 * and maximum are not exposed anywhere, so a slider would have to invent its
 * own scale. The span of the loaded results is offered as placeholder text -
 * a hint about what is on screen, never a cap on what can be typed.
 *
 * @param {Object}   props
 * @param {Object<string,{min: number, max: number}>} props.fields  Range-filterable fields and the span the loaded hits cover.
 * @param {Object<string,{min: string, max: string}>} props.active  Bounds currently applied.
 * @param {(field: string, bound: {min: string, max: string}) => void} props.onApply
 * @param {boolean}  props.busy
 */
const RangeFilters = ( { fields, active, onApply, busy } ) => {
	const entries = Object.entries( fields || {} );
	const [ drafts, setDrafts ] = useState( {} );
	const activeCount = Object.keys( active || {} ).length;

	// A photo search - or anything else that drops every applied bound - has to
	// empty the inputs too, or they would keep showing a filter that is no
	// longer on the results.
	useEffect( () => {
		if ( 0 === activeCount ) {
			setDrafts( {} );
		}
	}, [ activeCount ] );

	if ( 0 === entries.length ) {
		return null;
	}

	const draftFor = ( field ) => drafts[ field ] || active?.[ field ] || { min: '', max: '' };

	const setBound = ( field, side, value ) =>
		setDrafts( ( current ) => ( {
			...current,
			[ field ]: { ...draftFor( field ), [ side ]: value },
		} ) );

	return (
		<>
			{ entries.map( ( [ field, span ] ) => {
				const label = humanizeFieldLabel( field );
				const draft = draftFor( field );
				const applied = active?.[ field ] || {};
				const hasApplied = '' !== ( applied.min || '' ) || '' !== ( applied.max || '' );

				return (
					<form
						className="whsc-facet-group whsc-range"
						key={ field }
						onSubmit={ ( event ) => {
							event.preventDefault();
							onApply( field, draft );
						} }
					>
						<span className="whsc-facet-group__label">{ label }</span>
						<div className="whsc-range__row">
							<input
								type="number"
								inputMode="decimal"
								step="any"
								className="whsc-range__input"
								value={ draft.min }
								placeholder={ String( span.min ) }
								aria-label={ sprintf(
									/* translators: %s: field name, e.g. "Price". */
									__( 'Minimum %s', 'searcio' ),
									label
								) }
								onChange={ ( event ) => setBound( field, 'min', event.target.value ) }
								disabled={ busy }
							/>
							<span className="whsc-range__dash" aria-hidden="true">-</span>
							<input
								type="number"
								inputMode="decimal"
								step="any"
								className="whsc-range__input"
								value={ draft.max }
								placeholder={ String( span.max ) }
								aria-label={ sprintf(
									/* translators: %s: field name, e.g. "Price". */
									__( 'Maximum %s', 'searcio' ),
									label
								) }
								onChange={ ( event ) => setBound( field, 'max', event.target.value ) }
								disabled={ busy }
							/>
							{ /* The modal already carries a "Clear" on the search box and a
							     "Clear all" over recent searches, and a second numeric field
							     would add a second "Apply" - so the accessible name has to say
							     which filter this one belongs to. The visible word stays the
							     first word of that name, which is what voice control matches
							     on (WCAG 2.5.3). */ }
							<button
								type="submit"
								className="whsc-range__apply"
								aria-label={ sprintf(
									/* translators: %s: field name, e.g. "Price". */
									__( 'Apply %s filter', 'searcio' ),
									label
								) }
								disabled={ busy }
							>
								{ __( 'Apply', 'searcio' ) }
							</button>
							{ hasApplied && (
								<button
									type="button"
									className="whsc-range__clear"
									aria-label={ sprintf(
										/* translators: %s: field name, e.g. "Price". */
										__( 'Clear %s filter', 'searcio' ),
										label
									) }
									onClick={ () => {
										setDrafts( ( current ) => ( { ...current, [ field ]: { min: '', max: '' } } ) );
										onApply( field, { min: '', max: '' } );
									} }
									disabled={ busy }
								>
									{ __( 'Clear', 'searcio' ) }
								</button>
							) }
						</div>
					</form>
				);
			} ) }
		</>
	);
};

export default RangeFilters;
