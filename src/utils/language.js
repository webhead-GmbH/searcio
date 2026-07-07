/**
 * Pure helpers for scoping search by the visitor's current WPML/Polylang
 * language. Kept side-effect free and decoupled from
 * `window.webheadSearchCloudFrontend` so they're unit-testable — `api.js`
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
