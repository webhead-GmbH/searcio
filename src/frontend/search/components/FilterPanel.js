import { useState } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { chevronDown, search as searchIcon } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

import { arrangeTree, formatCount, freezeValueOrder, topValues } from '../../../utils/facets';
import PriceRange from './PriceRange';

/** Values a list shows before "Show all". */
export const TOP_N = 8;
/** Colour and image pills shown before "Show all". */
const COLOR_TOP_N = 12;
/** A list longer than this gets a field to search it. */
const SEARCH_WITHIN = 12;
/** "Show all" for one or two more values would cost as much room as the values. */
const SLACK = 2;

const fold = ( text ) => String( text ?? '' ).toLocaleLowerCase().normalize( 'NFD' ).replace( /[̀-ͯ]/g, '' );

/**
 * The values of one group as a panel shows them: in the order the panel had
 * when it opened, each with its count now. A list hides a value the other
 * filters leave at 0, unless it is selected or was on screen when the panel
 * opened - then it stays, dimmed and disabled, so no row moves under the
 * pointer. Tiles keep every value in its place.
 *
 * @param {Object} options
 * @param {Array<{value: string, count: number}>} options.values
 * @param {string[]} options.selected
 * @param {string[]} [options.frozen]
 * @param {boolean}  [options.natural]
 * @param {boolean}  [options.keepEmpty]
 * @param {string}   [options.locale]
 * @return {Array<{value: string, count: number, selected: boolean, disabled: boolean}>}
 */
export const panelEntries = ( { values, selected, frozen, natural = false, keepEmpty = false, locale } ) => {
	const counts = {};

	( values || [] ).forEach( ( entry ) => {
		counts[ entry.value ] = Number( entry.count ) || 0;
	} );

	const fresh = Object.keys( counts );
	const order = frozen && frozen.length > 0
		? [ ...frozen, ...freezeValueOrder( fresh.filter( ( value ) => ! frozen.includes( value ) ), counts, [], { natural, locale } ) ]
		: freezeValueOrder( fresh, counts, selected, { natural, locale } );

	return [ ...new Set( [ ...order, ...( selected || [] ) ] ) ]
		.map( ( value ) => {
			const count = counts[ value ] || 0;
			const isSelected = ( selected || [] ).includes( value );

			return { value, count, selected: isSelected, disabled: 0 === count && ! isSelected };
		} )
		.filter( ( entry ) => keepEmpty || entry.count > 0 || entry.selected || ( frozen || [] ).includes( entry.value ) );
};

const ShowAll = ( { expanded, total, label, onToggle } ) => (
	<button
		type="button"
		className="whsc-more"
		aria-expanded={ expanded }
		// A plural of a shop's own attribute name is not available, so the
		// visible text carries the number and the name carries the group.
		aria-label={ expanded ? undefined : sprintf(
			/* translators: 1: number of values. 2: filter name, e.g. "Category". */
			__( 'Show all %1$d values for %2$s', 'searcio' ),
			total,
			label
		) }
		onClick={ onToggle }
	>
		{ expanded
			? __( 'Show fewer', 'searcio' )
			: sprintf(
				/* translators: %d: number of values. */
				__( 'Show all %d', 'searcio' ),
				total
			) }
		<Icon icon={ chevronDown } className="whsc-chev" size={ 20 } />
	</button>
);

const Checkbox = ( { field, entry, onToggle, className } ) => (
	<input
		type="checkbox"
		className={ className }
		value={ entry.value }
		checked={ entry.selected }
		disabled={ entry.disabled }
		onChange={ () => onToggle( field, entry.value ) }
	/>
);

/**
 * One group's values: a checkbox list, colour or image pills, size tiles or
 * two bounds. The popover, the phone's sheet and each section of "All filters"
 * draw a group with this.
 *
 * Every value is a real checkbox in a fieldset named by the group, tiles and
 * pills too: their box is hidden and their label shows the ring.
 *
 * @param {Object}   props
 * @param {string}   props.field
 * @param {string}   props.label
 * @param {string}   props.display     `list`, `color`, `image`, `tiles` or `range`.
 * @param {Array<{value: string, count: number}>} [props.values]
 * @param {string[]} [props.selected]
 * @param {string[]} [props.frozen]    The order the panel opened with.
 * @param {Object<string,string>} [props.colors]
 * @param {Object<string,string>} [props.secondColors] For a value of two colours.
 * @param {Object<string,string>} [props.images]
 * @param {Object<string,string>} [props.labels]       The short text a shop shows for a value on a tile.
 * @param {{depth: number, parents: Object<string,string>}} [props.tree] For a list drawn as the shop's tree.
 * @param {boolean}  [props.showCount]
 * @param {string}   [props.locale]
 * @param {(field: string, value: string) => void} props.onToggle
 * @param {Object}   [props.range]     For `range`: `span`, `active`, `onApply` and the formatting of {@see PriceRange}.
 */
const FilterPanel = ( { field, label, display, values = [], selected = [], frozen = [], colors = {}, secondColors = {}, images = {}, labels = {}, tree, showCount = true, locale, onToggle, range = {} } ) => {
	const [ showAll, setShowAll ] = useState( false );
	const [ term, setTerm ] = useState( '' );

	if ( 'range' === display ) {
		return <PriceRange field={ field } label={ label } { ...range } />;
	}

	const opened = panelEntries( { values, selected, frozen, natural: 'tiles' === display, keepEmpty: 'tiles' === display, locale } );
	const entries = 'list' === display ? arrangeTree( opened, tree ) : opened;
	const count = ( entry ) => showCount && <span className="whsc-facet__count">{ formatCount( entry.count ) }</span>;
	const legend = <legend className="whsc-visually-hidden">{ label }</legend>;

	if ( 0 === entries.length ) {
		return <p className="whsc-opts__none">{ __( 'No values match the other filters.', 'searcio' ) }</p>;
	}

	if ( 'tiles' === display ) {
		return (
			<fieldset className="whsc-opts">
				{ legend }
				<ul className="whsc-tiles">
					{ entries.map( ( entry ) => (
						<li className="whsc-tiles__item" key={ entry.value }>
							<label className={ `whsc-facet whsc-tile${ entry.selected ? ' is-active' : '' }${ entry.disabled ? ' is-empty' : '' }` }>
								<Checkbox field={ field } entry={ entry } onToggle={ onToggle } className="whsc-hidden-input" />
								<span className="whsc-facet__label"><bdi>{ labels[ entry.value ] || entry.value }</bdi></span>
								{ count( entry ) }
							</label>
						</li>
					) ) }
				</ul>
			</fieldset>
		);
	}

	const limit = 'list' === display ? TOP_N : COLOR_TOP_N;
	const long = entries.length > limit + SLACK;
	const searchable = 'list' === display && entries.length > SEARCH_WITHIN;
	const wanted = fold( term.trim() );
	let shown = entries;

	if ( '' !== wanted ) {
		shown = entries.filter( ( entry ) => fold( entry.value ).includes( wanted ) );
	} else if ( long && ! showAll ) {
		shown = topValues( entries, selected, limit );
	}

	const more = '' === wanted && long && (
		<ShowAll expanded={ showAll } total={ entries.length } label={ label } onToggle={ () => setShowAll( ! showAll ) } />
	);

	if ( 'color' === display || 'image' === display ) {
		const dot = ( value ) => ( secondColors[ value ]
			? `linear-gradient(135deg, ${ colors[ value ] } 50%, ${ secondColors[ value ] } 50%)`
			: colors[ value ] );

		return (
			<fieldset className="whsc-opts">
				{ legend }
				<ul className="whsc-swatches">
					{ shown.map( ( entry ) => (
						<li className="whsc-swatches__item" key={ entry.value }>
							<label className={ `whsc-facet whsc-swatch${ entry.selected ? ' is-active' : '' }${ entry.disabled ? ' is-empty' : '' }` }>
								<Checkbox field={ field } entry={ entry } onToggle={ onToggle } className="whsc-hidden-input" />
								{ 'image' === display
									? <img className="whsc-swatch__image" src={ images[ entry.value ] } alt="" loading="lazy" />
									: <span className="whsc-swatch__dot" style={ { '--whsc-dot': dot( entry.value ) } } /> }
								<span className="whsc-facet__label"><bdi>{ entry.value }</bdi></span>
								{ count( entry ) }
							</label>
						</li>
					) ) }
				</ul>
				{ more }
			</fieldset>
		);
	}

	return (
		<fieldset className="whsc-opts">
			{ legend }
			{ searchable && (
				<div className="whsc-within">
					<Icon icon={ searchIcon } className="whsc-within__icon" size={ 18 } />
					<input
						type="search"
						className="whsc-within__input"
						value={ term }
						placeholder={ sprintf(
							/* translators: %s: filter name, e.g. "Category". */
							__( 'Search %s', 'searcio' ),
							label
						) }
						aria-label={ sprintf(
							/* translators: %s: filter name, e.g. "Category". */
							__( 'Search %s', 'searcio' ),
							label
						) }
						autoComplete="off"
						onChange={ ( event ) => setTerm( event.target.value ) }
					/>
				</div>
			) }
			<ul className="whsc-opts__list">
				{ shown.map( ( entry ) => (
					// A search within the list reads as one list.
					<li
						className="whsc-opts__item"
						key={ entry.value }
						style={ entry.level && '' === wanted ? { '--whsc-level': entry.level } : undefined }
					>
						<label className={ `whsc-opt${ entry.disabled ? ' is-empty' : '' }` }>
							<Checkbox field={ field } entry={ entry } onToggle={ onToggle } className="whsc-box" />
							<span className="whsc-facet__label"><bdi>{ entry.value }</bdi></span>
							{ count( entry ) }
						</label>
					</li>
				) ) }
			</ul>
			{ '' !== wanted && 0 === shown.length && (
				<p className="whsc-opts__none">
					{ sprintf(
						/* translators: %s: what was typed into a filter's search field. */
						__( 'Nothing matches “%s”.', 'searcio' ),
						term.trim()
					) }
				</p>
			) }
			{ more }
		</fieldset>
	);
};

export default FilterPanel;
