/**
 * The type a post type's documents carry in the index.
 *
 * The Indexing tab lets an admin name it ("artikel" for posts), while a block,
 * a shortcode, a widget and a placement name the post type. A search
 * restricted to posts asked for `type=post` and found nothing once posts were
 * "artikel". The storefront config holds the map (`documentTypes`); a type it
 * does not know, such as one already given as a document type, is kept.
 */

import { getConfig } from './api';

/**
 * @param {string} type A post type, or a document type.
 * @param {Object<string,string>} [map] The map; the storefront config's when omitted.
 * @return {string} The document type, '' for none.
 */
export const documentType = ( type, map = getConfig().documentTypes ) => {
	const key = String( type ?? '' ).trim();
	const types = map && 'object' === typeof map ? map : {};

	return '' !== key && Object.prototype.hasOwnProperty.call( types, key ) && 'string' === typeof types[ key ] ? types[ key ] : key;
};

/**
 * The post type of a hit, from its document id (`{post type}-{post id}`), so a
 * card can be chosen by what the hit is whatever its type was named.
 *
 * @param {{id?: string}} hit
 * @return {string} The post type, '' for an id that does not have one.
 */
export const postTypeOf = ( hit ) => {
	const id = String( hit?.id ?? '' );
	const at = id.lastIndexOf( '-' );

	return at > 0 && /^\d+$/.test( id.slice( at + 1 ) ) ? id.slice( 0, at ) : '';
};
