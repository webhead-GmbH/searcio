/**
 * What a click on a result tells the click beacon (`trackClick()` in api.js).
 */

/**
 * The handlers a result's link takes to report that it was opened.
 *
 * A middle click opens the link in a new tab without a `click` event, only an
 * `auxclick` with button 1, so it is listened for too. A click with Ctrl or
 * Cmd held is a `click` and reaches `onClick` as it is.
 *
 * @param {Function} [onOpen] Called with the event when the link is opened.
 * @return {{onClick?: Function, onAuxClick?: Function}} Props for the link, none without a handler.
 */
export const openHandlers = ( onOpen ) => {
	if ( 'function' !== typeof onOpen ) {
		return {};
	}

	return {
		onClick: onOpen,
		onAuxClick: ( event ) => {
			if ( 1 === event.button ) {
				onOpen( event );
			}
		},
	};
};

/**
 * The 1-based position of a product among those that share its `search_id`.
 *
 * Every product the AI assistant shows was found by a catalogue search of its
 * own, and each such search is a list of its own for click ranking: the third
 * product of a reply can be the first result of the search that found it.
 *
 * @param {Array<{search_id?: string}>} products The products in the order they are shown.
 * @param {number}                      index    The clicked product's index among them.
 * @return {number} Its position in its own search.
 */
export const positionInSearch = ( products, index ) => {
	const searchId = products[ index ]?.search_id;

	return products.slice( 0, index ).filter( ( product ) => product?.search_id === searchId ).length + 1;
};
