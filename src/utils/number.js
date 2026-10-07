/**
 * Number formatting in the language of the page rather than of the browser.
 *
 * A bare `toLocaleString()` follows the browser, and a browser is often set to
 * another language than the screen it is showing: wp-admin is written in the
 * language of the user's WordPress profile. A translated sentence then carried
 * the digits and the separators of a different language - "۲٬۷۰۰ of ۳۰۰٬۰۰۰"
 * on an English screen in a Persian browser.
 *
 * WordPress puts the language it translated the page into on `<html lang>`: the
 * user's own in wp-admin, the page's on the storefront. That is the one read
 * here, so a number always matches the sentence around it.
 */

const formatters = new Map();

/**
 * The longest leading part of a language tag that `Intl` accepts.
 *
 * A language pack names its tag itself; without one WordPress writes its own
 * locale code with hyphens, and not every locale code is a tag. `pt-PT-ao90`
 * is a `RangeError`, and `pt-PT` is what it means.
 *
 * @param {string} tag
 * @return {string|undefined} Undefined leaves the language to the browser.
 */
const resolveLocale = ( tag ) => {
	const subtags = String( tag || '' ).trim().split( '-' ).filter( Boolean );

	while ( subtags.length ) {
		try {
			return Intl.getCanonicalLocales( subtags.join( '-' ) )[ 0 ];
		} catch ( error ) {
			subtags.pop();
		}
	}

	return undefined;
};

/**
 * The separators are the language's; the digits are the ones WordPress itself
 * writes in every language. `number_format_i18n()` and `@wordpress/date` both
 * keep 0-9, so a count on a Persian or an Arabic screen reads like the counts
 * and the dates WordPress prints beside it.
 *
 * @param {number|string} value
 * @return {string} The grouped number, or '' when the value is not a number.
 */
export const formatNumber = ( value ) => {
	const number = Number( value );

	if ( ! Number.isFinite( number ) ) {
		return '';
	}

	const lang = document.documentElement.lang;

	if ( ! formatters.has( lang ) ) {
		formatters.set( lang, new Intl.NumberFormat( resolveLocale( lang ), { numberingSystem: 'latn' } ) );
	}

	return formatters.get( lang ).format( number );
};
