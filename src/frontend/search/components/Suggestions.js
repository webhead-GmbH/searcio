import { useEffect, useRef } from '@wordpress/element';
import { closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import Button from './Button';

/**
 * The id of one option, which the search field names as its active descendant
 * while the arrow keys move through the list.
 *
 * @param {string} id    The list's id.
 * @param {number} index
 * @return {string}
 */
export const optionId = ( id, index ) => `${ id }-option-${ index }`;

/**
 * Floating, dismissible autocomplete dropdown anchored under the search
 * input. Never pushes page content - it's absolutely positioned by its
 * parent (a `position: relative` wrapper) - and closes on an explicit
 * button, outside click, or Escape (captured before the modal's own Escape
 * handler so it dismisses the dropdown first, not the whole modal).
 *
 * The arrow keys are the search field's (see `SearchModal`): focus stays in
 * the field, where the visitor is typing, and the option they have moved to is
 * marked here and named to assistive technology through the field's
 * `aria-activedescendant`.
 *
 * @param {Object}                props
 * @param {string}                props.id
 * @param {string[]}              props.suggestions
 * @param {number}                [props.activeIndex] The option the arrow keys are on, or -1.
 * @param {(label: string) => void} props.onSelect
 * @param {() => void}            props.onDismiss
 */
const Suggestions = ( { id, suggestions, activeIndex = -1, onSelect, onDismiss } ) => {
	const containerRef = useRef( null );

	useEffect( () => {
		const onOutsideClick = ( event ) => {
			if ( containerRef.current && ! containerRef.current.contains( event.target ) ) {
				onDismiss();
			}
		};

		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key ) {
				// The field is `type="search"`, whose own Escape empties it: without
				// this, closing the dropdown also threw away the query and its results.
				event.preventDefault();
				event.stopPropagation();
				onDismiss();
			}
		};

		document.addEventListener( 'mousedown', onOutsideClick );
		document.addEventListener( 'keydown', onKeyDown, { capture: true } );

		return () => {
			document.removeEventListener( 'mousedown', onOutsideClick );
			document.removeEventListener( 'keydown', onKeyDown, { capture: true } );
		};
	}, [ onDismiss ] );

	// A long list scrolls inside the modal; the option the keys moved to is
	// brought into view, and nothing moves when it already is.
	useEffect( () => {
		if ( activeIndex < 0 ) {
			return;
		}

		containerRef.current?.ownerDocument
			.getElementById( optionId( id, activeIndex ) )
			?.scrollIntoView?.( { block: 'nearest' } );
	}, [ id, activeIndex ] );

	return (
		<div className="whsc-suggestions" ref={ containerRef }>
			<Button
				className="whsc-suggestions__close"
				icon={ closeSmall }
				label={ __( 'Dismiss suggestions', 'searcio' ) }
				showTooltip={ false }
				onClick={ onDismiss }
			/>
			<ul
				id={ id }
				className="whsc-suggestions__list"
				role="listbox"
				aria-label={ __( 'Search suggestions', 'searcio' ) }
			>
				{ suggestions.map( ( label, index ) => (
					<li key={ label } role="presentation">
						<button
							type="button"
							id={ optionId( id, index ) }
							className={ `whsc-suggestion${ index === activeIndex ? ' is-active' : '' }` }
							role="option"
							aria-selected={ index === activeIndex }
							onClick={ () => onSelect( label ) }
						>
							{ label }
						</button>
					</li>
				) ) }
			</ul>
		</div>
	);
};

export default Suggestions;
