import { useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

import { previewUrl } from '../../placement';

const pluginData = window.searcioData || {};
const PLACEMENT_PATH = pluginData?.api?.placementPath || '/searcio/v1/placement';

/** How long the page waits after a change of what it shows before it loads again. */
const RELOAD_DELAY = 500;

/** How long a change of the look waits before its CSS is asked for. */
const STYLE_DELAY = 150;

// The CSS of the looks asked for, by their JSON, for every preview on the
// screen: the tab's and the editor's draw the same look.
const styles = new Map();

const stylesOf = ( look ) => {
	const key = JSON.stringify( look || {} );

	if ( ! styles.has( key ) ) {
		const request = apiFetch( { path: `${ PLACEMENT_PATH }/look-css`, method: 'POST', data: { look: look || {} } } )
			.catch( ( error ) => {
				styles.delete( key );

				throw error;
			} );

		styles.set( key, request );
	}

	return styles.get( key );
};

const originOf = ( url ) => {
	try {
		return new URL( url, window.location.href ).origin;
	} catch {
		return '';
	}
};

/**
 * A page of the site with the search drawn from the settings on screen, in
 * the theme's own styles.
 *
 * The settings that change what is drawn load the page again, a moment after
 * the last change. The look does not: its CSS is asked for and sent into the
 * page (`Placement_Preview`), which draws it at once.
 *
 * @param {Object}  props
 * @param {Object}  props.preview   `{ url, nonce }` from the endpoint.
 * @param {string}  props.view      `trigger`, `modal` or `floating`.
 * @param {Object}  props.placement The settings to draw.
 * @param {string}  props.title     The frame's name.
 * @param {string}  [props.className]
 * @param {Object}  [props.style]
 * @param {Function} [props.onStyleError] Told the reason when the look's CSS could not be had, and '' once it could.
 */
const LookPreview = ( { preview, view, placement, title, className = '', style, onStyleError } ) => {
	const look = placement?.search?.look || {};
	// The page is drawn without the look, so a change of the look leaves its
	// address alone.
	const page = { ...placement, search: { ...( placement?.search || {} ), look: {} } };
	const target = previewUrl( preview, view, page );
	const [ src, setSrc ] = useState( target );
	const frame = useRef( null );
	const latest = useRef( null );
	const errorHandler = useRef( onStyleError );

	errorHandler.current = onStyleError;

	useEffect( () => {
		const timer = window.setTimeout( () => setSrc( target ), RELOAD_DELAY );

		return () => window.clearTimeout( timer );
	}, [ target ] );

	const send = () => {
		const page_ = frame.current?.contentWindow;
		const origin = originOf( src );

		if ( page_ && origin && latest.current ) {
			page_.postMessage( { type: 'searcio-look', css: latest.current.css || '', fonts: latest.current.fonts || '' }, origin );
		}
	};

	const lookKey = JSON.stringify( look );

	useEffect( () => {
		let current = true;
		const timer = window.setTimeout( () => {
			stylesOf( look )
				.then( ( response ) => {
					if ( current ) {
						latest.current = response;
						send();
						errorHandler.current?.( '' );
					}
				} )
				.catch( ( error ) => current && errorHandler.current?.( error?.message || '' ) );
		}, STYLE_DELAY );

		return () => {
			current = false;
			window.clearTimeout( timer );
		};
		// The look is compared by its JSON: a new object with the same values is the same look.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ lookKey ] );

	// The page says when it can be sent the look: on every load.
	useEffect( () => {
		const onMessage = ( event ) => {
			if ( event.source === frame.current?.contentWindow && 'searcio-look-ready' === event.data?.type ) {
				send();
			}
		};

		window.addEventListener( 'message', onMessage );

		return () => window.removeEventListener( 'message', onMessage );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ src ] );

	if ( ! src ) {
		return null;
	}

	return (
		<iframe
			ref={ frame }
			className={ `whsc-placement-preview whsc-placement-preview--${ view } ${ className }`.trim() }
			style={ style }
			title={ title }
			src={ src }
			onLoad={ send }
		/>
	);
};

export default LookPreview;
