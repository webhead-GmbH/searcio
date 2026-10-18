import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const pluginData = window.webhead_search_cloudData || {};
const TEST_CONNECTION_PATH = pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';

let asked = null;

/**
 * The health check's answer about the plan, asked for once however many parts
 * of the page want it: the header's upgrade action and the Support Searcio card
 * both do.
 *
 * @return {Promise<Object|null>} `{ is_free, name, upgrade_url }`, or null.
 */
const askForPlan = () => {
	if ( ! asked ) {
		asked = apiFetch( { path: TEST_CONNECTION_PATH, method: 'POST' } )
			.then( ( response ) => ( response?.ok && response.plan ) || null )
			.catch( () => null );
	}

	return asked;
};

/**
 * The plan the connected account is on. Until Search Cloud answers, it is the
 * tier the site last kept (`connection.planTier`), so a Free plan is known as
 * one before the request returns. Null when the site is not connected, or no
 * tier is known.
 *
 * @return {Object|null} `{ is_free, name?, upgrade_url? }`.
 */
export const usePlan = () => {
	const isConnected = pluginData?.connection?.isConnected === true;
	const kept = pluginData?.connection?.planTier || '';
	const [ plan, setPlan ] = useState( isConnected && kept ? { is_free: 'free' === kept } : null );

	useEffect( () => {
		if ( ! isConnected ) {
			return undefined;
		}

		let cancelled = false;

		askForPlan().then( ( answer ) => {
			if ( ! cancelled && answer ) {
				setPlan( answer );
			}
		} );

		return () => {
			cancelled = true;
		};
	}, [ isConnected ] );

	return plan;
};
