/**
 * Pure helpers for scoping search by the visitor's current WPML/Polylang
 * language. Kept side-effect free and decoupled from
 * `window.searcioFrontend` so they're unit-testable - `api.js`
 * supplies the live config values as plain arguments.
 */

/**
 * An unrestricted site (empty enabled list) treats every language as
 * supported.
 *
 * @param {string[]} enabledLanguages
 * @param {string}   currentLang
 */
export const isLanguageSupported = ( enabledLanguages, currentLang ) => {
	const enabled = enabledLanguages || [];

	return 0 === enabled.length || enabled.includes( currentLang || '' );
};

/**
 * The hits that belong on a page in `lang`: those in that language, and those
 * the index holds without one. Photo search, similar products and the
 * assistant's products take no language filter, so on a multilingual shop they
 * come back in every language, a product's own translation first among its
 * similar products.
 *
 * @param {Array<Object>} hits
 * @param {string}        [lang] The page's language, or none to keep every hit.
 * @return {Array<Object>} A new list; the input is left alone.
 */
export const inLanguage = ( hits, lang ) => {
	const list = Array.isArray( hits ) ? hits : [];

	if ( ! lang ) {
		return [ ...list ];
	}

	return list.filter( ( hit ) => {
		const own = hit?.source?.lang;

		return 'string' !== typeof own || '' === own || own === lang;
	} );
};

/**
 * `{lang: '<code>'}` merge-in for `search()`'s `filters` option, or `{}` when
 * there's nothing to scope by.
 *
 * @param {string[]} enabledLanguages
 * @param {string}   currentLang
 */
export const currentLangFilter = ( enabledLanguages, currentLang ) => {
	const enabled = enabledLanguages || [];

	if ( 0 === enabled.length || ! currentLang || ! enabled.includes( currentLang ) ) {
		return {};
	}

	return { lang: currentLang };
};
