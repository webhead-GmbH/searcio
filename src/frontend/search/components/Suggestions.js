import { useEffect, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { closeSmall } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Floating, dismissible autocomplete dropdown anchored under the search
 * input. Never pushes page content — it's absolutely positioned by its
 * parent (a `position: relative` wrapper) — and closes on an explicit
 * button, outside click, or Escape (captured before the modal's own Escape
 * handler so it dismisses the dropdown first, not the whole modal).
 *
 * @param {Object}                props
 * @param {string}                props.id
 * @param {string[]}              props.suggestions
 * @param {(label: string) => void} props.onSelect
 * @param {() => void}            props.onDismiss
 */
const Suggestions = ( { id, suggestions, onSelect, onDismiss } ) => {
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

	return (
		<div className="whsc-suggestions" ref={ containerRef }>
			<Button
				className="whsc-suggestions__close"
				icon={ closeSmall }
				label={ __( 'Dismiss suggestions', 'webhead-search-cloud' ) }
				showTooltip={ false }
				onClick={ onDismiss }
			/>
			<ul
				id={ id }
				className="whsc-suggestions__list"
				role="listbox"
				aria-label={ __( 'Search suggestions', 'webhead-search-cloud' ) }
			>
				{ suggestions.map( ( label ) => (
					<li key={ label } role="presentation">
						<button
							type="button"
							className="whsc-suggestion"
							role="option"
							aria-selected="false"
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
