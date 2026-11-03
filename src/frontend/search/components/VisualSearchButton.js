import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Button from './Button';

import { cameraIcon } from './icons';

/**
 * Search by photo instead of by words, for the shopper who can point at the
 * thing but not name it.
 *
 * Rendered only when `/storefront-config` advertises the capability, so a
 * shopper never sees a control that could only answer 403
 * (`docs/api/visual-search.md`).
 *
 * `capture="environment"` asks a phone for the rear camera directly rather
 * than the photo picker; a desktop browser ignores it and opens a file dialog,
 * which is the wanted behaviour on both.
 *
 * @param {Object}   props
 * @param {Function} props.onSelect Called with the chosen File.
 * @param {boolean}  [props.busy]   A photo search is already running.
 */
const VisualSearchButton = ( { onSelect, busy } ) => {
	const inputRef = useRef( null );

	const onChange = ( event ) => {
		const file = event.target.files?.[ 0 ];

		// Reset first: picking the same file twice in a row fires no `change`
		// event otherwise, so a repeat upload would look like a dead button.
		event.target.value = '';

		if ( file ) {
			onSelect( file );
		}
	};

	return (
		<>
			<Button
				className="whsc-visual-btn"
				icon={ <span className="whsc-visual-icon">{ cameraIcon }</span> }
				label={ __( 'Search by photo', 'searcio' ) }
				showTooltip={ false }
				disabled={ busy }
				onClick={ () => inputRef.current?.click() }
			/>
			<input
				ref={ inputRef }
				type="file"
				className="whsc-visual-input"
				accept="image/*"
				capture="environment"
				tabIndex={ -1 }
				aria-hidden="true"
				onChange={ onChange }
			/>
		</>
	);
};

export default VisualSearchButton;
