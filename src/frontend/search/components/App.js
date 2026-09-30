import { createPortal, useEffect, useState } from '@wordpress/element';

import Trigger from './Trigger';
import ProductList from './ProductList';
import SearchModal from './SearchModal';

/**
 * Portals each server-rendered trigger placeholder to a real
 * `@wordpress/components` control, and owns one shared full-screen modal so
 * multiple triggers on a page never spawn multiple overlays.
 *
 * @param {Object}    props
 * @param {Element[]} props.triggerElements
 * @param {Element[]} [props.listElements] Product-row placeholders (similar
 *                                         products, a curated category listing).
 */
const App = ( { triggerElements, listElements = [] } ) => {
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

	// The Elementor editor can ask for one widget's modal to stay open while
	// its Style settings change (the widget only sets this while rendering in
	// the editor). Editing a Content setting re-renders the widget, which
	// replaces its trigger element, so this re-runs whenever the set changes.
	const previewIndex = triggerElements.findIndex( ( el ) => '1' === el.dataset.editorPreview );
	// The new trigger usually lands at the same index as the one it replaced,
	// so the index alone would keep the old modal - and its old search term -
	// mounted. Counting preview openings gives the modal a fresh key instead.
	const [ previewRun, setPreviewRun ] = useState( 0 );

	useEffect( () => {
		if ( previewIndex < 0 ) {
			return;
		}

		setQuery( triggerElements[ previewIndex ].dataset.editorQuery || '' );
		setActiveIndex( previewIndex );
		setPreviewRun( ( run ) => run + 1 );
	}, [ triggerElements, previewIndex ] );

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
			{ listElements.map( ( el, index ) => createPortal(
				<ProductList
					source={ el.dataset.source || 'similar' }
					documentId={ el.dataset.docId || '' }
					filterField={ el.dataset.filterField || '' }
					filterValue={ el.dataset.filterValue || '' }
					heading={ el.dataset.heading || '' }
					limit={ Number( el.dataset.limit ) || undefined }
					layout={ el.dataset.layout || 'carousel' }
					showBanner={ '0' !== el.dataset.showBanner }
					cardSource={ el.dataset.cardSource || 'plugin' }
				/>,
				el,
				`list-${ index }`
			) ) }
			{ activeEl && (
				<SearchModal
					key={ `${ activeIndex }-${ previewRun }` }
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
					editorPreview={ '1' === activeEl.dataset.editorPreview }
					initialQuery={ query }
					onQueryChange={ setQuery }
					onRequestClose={ closeModal }
				/>
			) }
		</>
	);
};

export default App;
