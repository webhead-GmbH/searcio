import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { trendingUp } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

const pluginData = window.webhead_search_cloudData || {};
const TEST_CONNECTION_PATH = pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';

/**
 * The header action offered only when the connected account is on a Free plan:
 * it opens the Search Cloud billing page so the owner can buy a plan. The plan
 * tier and billing URL come from the /health check (`plan.is_free` /
 * `plan.upgrade_url`, surfaced by Connection_Endpoint::present()).
 *
 * Answers a descriptor for the page shell, which decides how a header action
 * looks, or null until the health check resolves and whenever the site is not
 * connected, the plan is not free, or no upgrade URL is available.
 */
export const useUpgradeAction = () => {
	const [ plan, setPlan ] = useState( null );
	const isConnected = pluginData?.connection?.isConnected === true;

	useEffect( () => {
		if ( ! isConnected ) {
			return undefined;
		}

		let cancelled = false;

		( async () => {
			try {
				const response = await apiFetch( { path: TEST_CONNECTION_PATH, method: 'POST' } );

				if ( ! cancelled ) {
					setPlan( response?.plan || null );
				}
			} catch ( error ) {
				// Non-fatal: no action if the health check can't be reached.
			}
		} )();

		return () => {
			cancelled = true;
		};
	}, [ isConnected ] );

	if ( ! plan?.is_free || ! plan?.upgrade_url ) {
		return null;
	}

	return {
		key: 'upgrade',
		label: __( 'Upgrade plan', 'webhead-search-cloud' ),
		icon: trendingUp,
		onClick: () => window.open( plan.upgrade_url, '_blank', 'noopener,noreferrer' ),
	};
};
