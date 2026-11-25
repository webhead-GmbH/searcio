import { createPortal, useEffect, useState } from '@wordpress/element';

import { OPEN_EVENT } from '../openers';
import Trigger from './Trigger';
import ProductList from './ProductList';
import SearchModal from './SearchModal';
import { documentType } from '../../../utils/documentType';
import { liftAboveBottomBars } from '../../../utils/bottomBars';
import { getConfig, isConfigured, isLanguageSupported } from '../../../utils/api';
import { isShareHash, isWrittenShareHash, parseShareHash, shareFields } from '../../../utils/shareLink';

/**
 * The trigger whose window a request to open the search opens: the site's own,
 * or the first one on a page the site printed none on.
 *
 * @param {Element[]} triggerElements
 * @return {number} Its index.
 */
const ownTriggerIndex = ( triggerElements ) => {
	const site = triggerElements.findIndex( ( el ) => undefined !== el.dataset.whscSite );

	return site >= 0 ? site : 0;
};

/**
 * Portals each server-rendered trigger placeholder to a real React
 * control, and owns one shared full-screen modal so
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
	// The type, the filters and the bounds of the link the window was opened with
	// (its words are `query`), and how many links have opened it: a link pasted
	// into a page that is open opens the window afresh.
	const [ share, setShare ] = useState( null );
	const [ shareRun, setShareRun ] = useState( 0 );

	const openFresh = ( index ) => {
		setShare( null );
		setQuery( '' );
		setActiveIndex( index );
	};

	const openWithValue = ( index, value ) => {
		setShare( null );
		setQuery( value );
		setActiveIndex( index );
	};

	// A theme's element, a `#searcio` link or the keyboard shortcut asks for
	// the search (see `openers.js`): it opens as the site's own trigger
	// configures it, or as the first trigger on the page where the site
	// printed none.
	useEffect( () => {
		const onOpenRequest = ( event ) => {
			const index = ownTriggerIndex( triggerElements );

			if ( ! triggerElements[ index ] ) {
				return;
			}

			setShare( null );
			setQuery( event.detail?.query || '' );
			setActiveIndex( index );
		};

		window.addEventListener( OPEN_EVENT, onOpenRequest );

		return () => window.removeEventListener( OPEN_EVENT, onOpenRequest );
	}, [ triggerElements ] );

	// A link to a search (`#searcio?q=...`, see `utils/shareLink.js`) opens the
	// window of the site's own trigger on that search: when the page loads, and
	// when a link is pasted into the address of a page that is open. What the
	// window wrote into the address itself is no news. Where Searcio does not
	// search the page the link is left alone: opening it would hand the visitor
	// to WordPress's own search, away from the page the link names.
	useEffect( () => {
		const openShared = () => {
			const { hash } = window.location;

			if ( ! isShareHash( hash ) || isWrittenShareHash( hash ) || ! isConfigured() || ! isLanguageSupported() ) {
				return;
			}

			const shared = parseShareHash( hash, shareFields( getConfig() ) );
			const index = ownTriggerIndex( triggerElements );

			if ( ! shared || ! triggerElements[ index ] ) {
				return;
			}

			setQuery( shared.query );
			setShare( { types: shared.types, facets: shared.facets, ranges: shared.ranges } );
			setShareRun( ( run ) => run + 1 );
			setActiveIndex( index );
		};

		openShared();
		window.addEventListener( 'hashchange', openShared );

		return () => window.removeEventListener( 'hashchange', openShared );
	}, [ triggerElements ] );

	// The floating button stands on a bar the site fixes to the bottom of the
	// screen, a store notice or a cookie banner, not over it.
	useEffect( () => {
		const stops = triggerElements
			.filter( ( el ) => el.classList.contains( 'whsc-trigger--floating' ) )
			.map( ( el ) => liftAboveBottomBars( el ) );

		return () => stops.forEach( ( stop ) => stop() );
	}, [ triggerElements ] );

	const closeModal = () => {
		const el = null !== activeIndex ? triggerElements[ activeIndex ] : null;

		setActiveIndex( null );
		setShare( null );

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
					floatingStyle={ el.dataset.floating || 'icon' }
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
					key={ `${ activeIndex }-${ previewRun }-${ shareRun }` }
					scopeType={ documentType( activeEl.dataset.type ) }
					placeholder={ activeEl.dataset.placeholder || '' }
					enableVoice={ '1' === activeEl.dataset.voice }
					voiceIconHtml={ activeEl.dataset.voiceIcon || '' }
					cardSource={ activeEl.dataset.cardSource || 'plugin' }
					highlightsSource={ activeEl.dataset.highlightsSource || 'newest' }
					searchTrigger={ activeEl.dataset.searchTrigger || 'submit' }
					instanceClass={ activeEl.dataset.instanceClass || '' }
					showCount={ '0' !== activeEl.dataset.showCount }
					animation={ activeEl.dataset.animation || 'fade' }
					// Absent on a trigger printed before the setting existed (a cached
					// page): the default, not 0, which would hide every group.
					facetBarLimit={ /^\d+$/.test( activeEl.dataset.facetBarLimit || '' ) ? Number( activeEl.dataset.facetBarLimit ) : undefined }
					editorPreview={ '1' === activeEl.dataset.editorPreview }
					initialQuery={ query }
					initialShare={ share }
					onQueryChange={ setQuery }
					onRequestClose={ closeModal }
				/>
			) }
		</>
	);
};

export default App;
