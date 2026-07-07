/**
 * Shared currency-formatting helper. The Search Cloud API always returns
 * prices as bare numbers — both in a hit's own fields, and (for
 * server-designed card templates, `card-templates.md`) as `{{price}}`-style
 * placeholder values or as a "price component"'s field mapping. Currency
 * presentation happens client-side, by default from the localized
 * WooCommerce config so the plugin's own card templates (`templates.js`) and
 * a bare `{{price}}` placeholder (`serverCards.js`) match the rest of the
 * store — but a price *component* carries its own baked-in currency config
 * as data attributes, which `serverCards.js` passes in instead, since the
 * template was designed against that exact config.
 */
import { getConfig } from './api';

/**
 * Format a raw number using the store's decimal/thousand separators and then
 * apply the currency symbol in its configured position — matching WooCommerce
 * output (e.g. `1.234,50 €`).
 *
 * @param {number|string} price
 * @param {Object}        [currencyOverride] Use this exact config instead of
 *                                            the site's own localized one —
 *                                            a server "price component"
 *                                            (`card-templates.md`) carries
 *                                            its own baked-in
 *                                            currency/decimals/separators as
 *                                            data attributes, which must win
 *                                            over the site's config since the
 *                                            template was designed against
 *                                            them specifically.
 * @return {string} Formatted price with symbol, or '' when not finite.
 */
export const formatPrice = ( price, currencyOverride ) => {
	const number = Number( price );

	if ( ! Number.isFinite( number ) ) {
		return '';
	}

	const currency = currencyOverride || getConfig().currency || {};
	const decimals = currency.decimals ?? 2;
	const decimalSep = currency.decimalSep ?? '.';
	const thousandSep = currency.thousandSep ?? ',';
	const symbol = currency.symbol || '';

	const [ int, dec ] = Math.abs( number ).toFixed( decimals ).split( '.' );
	const grouped = int.replace( /\B(?=(\d{3})+(?!\d))/g, thousandSep );
	const amount = ( number < 0 ? '-' : '' ) + ( dec ? `${ grouped }${ decimalSep }${ dec }` : grouped );

	switch ( currency.position ) {
		case 'left':
			return `${ symbol }${ amount }`;
		case 'left_space':
			return `${ symbol } ${ amount }`;
		case 'right':
			return `${ amount }${ symbol }`;
		case 'right_space':
			return `${ amount } ${ symbol }`;
		default:
			return symbol ? `${ symbol }${ amount }` : amount;
	}
};

/**
 * Field names this plugin's own `Woo.php` indexer pushes for a WooCommerce
 * product (see `document-schema.md`'s "custom fields (dynamic)" — the API
 * itself doesn't reserve these names, but this plugin always uses them, so a
 * server-designed template's `{{price}}` etc. placeholder can be formatted
 * with confidence rather than guessed at.
 */
export const PRICE_FIELDS = new Set( [ 'price', 'regular_price', 'sale_price', 'price_min', 'price_max' ] );
