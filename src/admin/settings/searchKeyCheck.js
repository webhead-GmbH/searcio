/**
 * Whether Searcio takes the storefront's search key, asked by the browser.
 *
 * The connection test asks Searcio with the write key, and said "Connected"
 * while a wrong search key sent every visitor's search to WordPress. A search
 * key works only on the domain its site was connected with, from a visitor's
 * browser: Searcio refuses a search-key request from the site's server, so
 * the screen asks `GET /storefront-config` as a page of the site does.
 */
import { __ } from '@wordpress/i18n';

/**
 * The connection test's result with what Searcio said of the search key, as
 * `search_key: { ok, message }`. The test hands over the key and the address
 * to ask; a result without them, or one that is not connected, is returned
 * as it is. A check that cannot reach Searcio says nothing against the key.
 *
 * @param {?Object}  result  `POST /connection/test`'s answer.
 * @param {Function} request `fetch`, or a stand-in for it.
 * @return {Promise<?Object>} The result, with `search_key` decided.
 */
export const checkSearchKey = async ( result, request = window.fetch?.bind( window ) ) => {
	const asked = result?.search_key;

	if ( ! result?.ok || ! asked || 'object' !== typeof asked || ! ( 'key' in asked ) ) {
		return result;
	}

	const decided = ( ok, message = '' ) => ( { ...result, search_key: { ok, message } } );
	const key = String( asked.key || '' ).trim();

	if ( '' === key ) {
		return decided( false, __( 'No search key is saved, so the site searches with WordPress instead of Searcio. Connect again, or paste the search key under the manual key entry.', 'searcio' ) );
	}

	if ( ! asked.endpoint || 'function' !== typeof request ) {
		return decided( true );
	}

	let status = 0;

	try {
		status = ( await request( `${ String( asked.endpoint ).replace( /\/+$/, '' ) }/storefront-config?key=${ encodeURIComponent( key ) }`, { credentials: 'omit' } ) ).status;
	} catch ( error ) {
		return decided( true );
	}

	if ( 401 === status ) {
		return decided( false, __( 'Searcio does not know the search key, so the site searches with WordPress instead of Searcio. Copy it again from the Searcio dashboard, or connect again.', 'searcio' ) );
	}

	if ( 403 === status ) {
		return decided( false, __( 'Searcio refuses the search key from the address of this site, so the site searches with WordPress instead of Searcio. A search key works only on the domain it was connected with and its subdomains: on a copy of the site under another address this is expected; otherwise connect this site again.', 'searcio' ) );
	}

	return decided( true );
};
