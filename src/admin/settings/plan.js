import { useEffect, useState } from '@wordpress/element';
import { readOnce } from './remote';

const pluginData = window.searcioData || {};
const TEST_CONNECTION_PATH = pluginData?.api?.testConnectionPath || '/searcio/v1/connection/test';

/**
 * The health check's answer (`/connection/test`), or null when it failed:
 * one request for every part of the screen that asks (`remote.js`).
 *
 * @return {Promise<Object|null>} What `Connection_Endpoint::present()` returns.
 */
const askForHealth = () =>
	readOnce( { path: TEST_CONNECTION_PATH, method: 'POST' } )
		.then( ( response ) => ( response?.ok ? response : null ) )
		.catch( () => null );

/**
 * One value of the health check, for a connected site: `initial` at once,
 * then what `pick` reads from the answer, when it reads something.
 *
 * @param {function(Object): *} pick
 * @param {*}                   initial
 * @return {*} The value, or null for a site that is not connected.
 */
const useHealthValue = ( pick, initial ) => {
	const isConnected = pluginData?.connection?.isConnected === true;
	const [ value, setValue ] = useState( isConnected ? initial : null );

	useEffect( () => {
		if ( ! isConnected ) {
			return undefined;
		}

		let cancelled = false;

		askForHealth().then( ( answer ) => {
			const picked = answer ? pick( answer ) : null;

			if ( ! cancelled && picked ) {
				setValue( picked );
			}
		} );

		return () => {
			cancelled = true;
		};
		// `pick` is fixed per caller.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isConnected ] );

	return value;
};

/**
 * The connected account's plan, from the health check: `{ is_free, name,
 * upgrade_url }`. Until it answers, the tier last seen (`planTier`) stands in,
 * so a Free plan is known at once.
 *
 * @return {Object|null} `{ is_free, name?, upgrade_url? }`.
 */
export const usePlan = () => {
	const kept = pluginData?.connection?.planTier || '';

	return useHealthValue( ( answer ) => answer.plan || null, kept ? { is_free: 'free' === kept } : null );
};

/**
 * Where this site's search statistics are on Searcio's dashboard: the
 * dashboard at once, and the site's own statistics page once the health check
 * names it (`Connection_Endpoint::statistics_url()`).
 *
 * @return {string|null} The address, or null for a site that is not connected.
 */
export const useStatisticsUrl = () =>
	useHealthValue( ( answer ) => answer.statistics_url || null, pluginData?.connection?.statisticsUrl || null );
