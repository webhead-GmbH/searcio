import { useEffect, useId, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import { parseAmount } from '../../../utils/facets';

const APPLY_DELAY = 700;

/**
 * Two bounds for a numeric facet field - price above all, but rating and
 * review count work the same way.
 *
 * A number is not a chip. The API aggregates facets into exact values, which
 * for a price field means one bucket per price, so chips were never a usable
 * control here (and, since a numeric field has no `.keyword` to aggregate on,
 * there were no buckets at all). `range[field]=min:max` is the API's answer,
 * and two bounds are the honest control for it: the catalogue's true minimum
 * and maximum are not exposed anywhere, so a slider would have to invent its
 * own scale. The span of the loaded results is offered as placeholder text and
 * as a hint that says what it is - never as a cap on what can be typed.
 *
 * A bound applies on Enter, when the field is left, when the panel closes and
 * 700ms after typing stops, rather than on every key: a partly typed number
 * ("1" on the way to "150") is a different, wrong filter. The fields are text
 * with a decimal keyboard, since a number field refuses "1.299,50"; what is
 * typed is read the way the shop writes numbers. A lower bound above the upper
 * one swaps the two.
 *
 * @param {Object}   props
 * @param {string}   props.field
 * @param {string}   props.label       The field's name, e.g. "Price".
 * @param {{min: number, max: number}} [props.span] What the loaded results cover.
 * @param {{min?: string, max?: string}} [props.active] The bound applied.
 * @param {(field: string, bound: {min: string, max: string}) => void} props.onApply
 * @param {(value: string) => string} [props.format] Writes a bound, e.g. as a price.
 * @param {string}   [props.unit]      A symbol beside the fields, e.g. "€".
 * @param {boolean}  [props.unitBefore] The symbol goes before the number.
 * @param {string}   [props.decimalSep] The shop's decimal separator.
 */
const PriceRange = ( { field, label, span, active, onApply, format = ( value ) => value, unit = '', unitBefore = false, decimalSep = '.' } ) => {
	const hintId = useId();
	const applied = { min: String( active?.min ?? '' ), max: String( active?.max ?? '' ) };
	const [ draft, setDraft ] = useState( applied );
	const timer = useRef( null );
	const latest = useRef( { draft, applied, onApply } );

	latest.current = { draft, applied, onApply };

	const apply = ( next = latest.current.draft ) => {
		window.clearTimeout( timer.current );

		let min = parseAmount( next.min, decimalSep );
		let max = parseAmount( next.max, decimalSep );

		if ( '' !== min && '' !== max && Number( min ) > Number( max ) ) {
			[ min, max ] = [ max, min ];
			setDraft( { min, max } );
		}

		const current = latest.current.applied;

		if ( min !== current.min || max !== current.max ) {
			latest.current.onApply( field, { min, max } );
		}
	};

	// A bound taken away elsewhere (the chip on the result line, "Reset")
	// empties its field; a bound this field applied is left as it was typed.
	useEffect( () => {
		setDraft( ( current ) => (
			parseAmount( current.min, decimalSep ) === applied.min && parseAmount( current.max, decimalSep ) === applied.max
				? current
				: applied
		) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only when the applied bound changes.
	}, [ applied.min, applied.max ] );

	// Closing the panel applies what was typed, like leaving the field does.
	useEffect( () => () => {
		if ( null !== timer.current ) {
			apply();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- on unmount only.
	}, [] );

	const change = ( side, value ) => {
		const next = { ...latest.current.draft, [ side ]: value.replace( /[^\d.,\s]/g, '' ) };

		setDraft( next );
		window.clearTimeout( timer.current );
		timer.current = window.setTimeout( () => {
			timer.current = null;
			apply( next );
		}, APPLY_DELAY );
	};

	const input = ( side, name, visible ) => (
		<label className="whsc-price__field">
			<span className="whsc-price__label" aria-hidden="true">{ visible }</span>
			<span className="whsc-price__box">
				{ unit && unitBefore && <span className="whsc-price__unit" aria-hidden="true">{ unit }</span> }
				<input
					type="text"
					inputMode="decimal"
					autoComplete="off"
					className="whsc-price__input"
					value={ draft[ side ] }
					placeholder={ span ? String( span[ side ] ) : '' }
					aria-label={ name }
					aria-describedby={ span ? hintId : undefined }
					onChange={ ( event ) => change( side, event.target.value ) }
					onBlur={ () => apply() }
					onKeyDown={ ( event ) => {
						if ( 'Enter' === event.key ) {
							event.preventDefault();
							apply();
						}
					} }
				/>
				{ unit && ! unitBefore && <span className="whsc-price__unit" aria-hidden="true">{ unit }</span> }
			</span>
		</label>
	);

	return (
		<div className="whsc-price">
			<div className="whsc-price__row">
				{ input(
					'min',
					sprintf(
						/* translators: %s: field name, e.g. "Price". */
						__( 'Minimum %s', 'searcio' ),
						label
					),
					/* translators: the short visible label over a filter's lower bound. */
					__( 'Min.', 'searcio' )
				) }
				<span className="whsc-price__dash" aria-hidden="true">-</span>
				{ input(
					'max',
					sprintf(
						/* translators: %s: field name, e.g. "Price". */
						__( 'Maximum %s', 'searcio' ),
						label
					),
					/* translators: the short visible label over a filter's upper bound. */
					__( 'Max.', 'searcio' )
				) }
			</div>
			{ span && (
				<p className="whsc-price__hint" id={ hintId }>
					{ sprintf(
						/* translators: 1: lowest value among the loaded results, e.g. "99 €". 2: highest, e.g. "249 €". */
						__( 'Range of the loaded results: %1$s to %2$s', 'searcio' ),
						format( String( span.min ) ),
						format( String( span.max ) )
					) }
				</p>
			) }
		</div>
	);
};

export default PriceRange;
