import { createPortal, useState } from '@wordpress/element';

import Trigger from './Trigger';
import SearchModal from './SearchModal';

/**
 * Portals each server-rendered trigger placeholder to a real
 * `@wordpress/components` control, and owns one shared full-screen modal so
 * multiple triggers on a page never spawn multiple overlays.
 *
 * @param {Object}    props
 * @param {Element[]} props.triggerElements
 */
const App = ( { triggerElements } ) => {
	const [ activeIndex, setActiveIndex ] = useState( null );
	const [ query, setQuery ] = useState( '' );

	const openFresh = ( index ) => {
		setQuery( '' );
		setActiveIndex( index );
	};

	const openWithValue = ( index, value ) => {
		setQuery( value );
		setActiveIndex( index );
	};

	const closeModal = () => {
		const el = null !== activeIndex ? triggerElements[ activeIndex ] : null;

		setActiveIndex( null );

		// Box triggers are hidden behind the modal while open; restore focus on close.
		if ( el && 'box' === el.dataset.mode ) {
			window.requestAnimationFrame( () => el.querySelector( 'input' )?.focus() );
		}
	};

	const activeEl = null !== activeIndex ? triggerElements[ activeIndex ] : null;

	return (
		<>
			{ triggerElements.map( ( el, index ) => createPortal(
				<Trigger
					mode={ el.dataset.mode || 'icon' }
					placeholder={ el.dataset.placeholder || '' }
					iconHtml={ el.dataset.icon || '' }
					value={ activeIndex === index ? query : '' }
					onOpen={ () => openFresh( index ) }
					onBoxChange={ ( value ) => openWithValue( index, value ) }
				/>,
				el,
				index
			) ) }
			{ activeEl && (
				<SearchModal
					key={ activeIndex }
					scopeType={ activeEl.dataset.type || '' }
					placeholder={ activeEl.dataset.placeholder || '' }
					enableVoice={ '1' === activeEl.dataset.voice }
					voiceIconHtml={ activeEl.dataset.voiceIcon || '' }
					cardSource={ activeEl.dataset.cardSource || 'plugin' }
					highlightsSource={ activeEl.dataset.highlightsSource || 'newest' }
					searchTrigger={ activeEl.dataset.searchTrigger || 'submit' }
					instanceClass={ activeEl.dataset.instanceClass || '' }
					showCount={ '0' !== activeEl.dataset.showCount }
					animation={ activeEl.dataset.animation || 'fade' }
					initialQuery={ query }
					onQueryChange={ setQuery }
					onRequestClose={ closeModal }
				/>
			) }
		</>
	);
};

export default App;
