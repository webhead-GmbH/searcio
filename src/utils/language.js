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
 * assistant's products are asked for in the page's language, but a service
 * from before that filter answers them in every language, a product's own
 * translation first among its similar products.
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
 * there's nothing to scope by: a site with no language (`currentLang` is set
 * on a multilingual site alone), or a page in a language the site does not
 * index, which searches WordPress instead.
 *
 * A site that restricts no language indexes every one, and each document
 * still carries its own, so a page searches its own language then too. Left
 * unscoped, the English page of a site whose admin had not ticked a language
 * listed its German products beside the English ones.
 *
 * @param {string[]} enabledLanguages
 * @param {string}   currentLang
 */
export const currentLangFilter = ( enabledLanguages, currentLang ) => {
	if ( ! currentLang || ! isLanguageSupported( enabledLanguages, currentLang ) ) {
		return {};
	}

	return { lang: currentLang };
};
