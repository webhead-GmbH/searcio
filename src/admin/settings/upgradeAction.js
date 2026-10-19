import { __ } from '@wordpress/i18n';
import { trendingUp } from '@wordpress/icons';

import { usePlan } from './plan';

/**
 * The header action offered only when the connected account is on a Free plan:
 * it opens the Searcio billing page so the owner can buy a plan. The plan
 * tier and billing URL come from the /health check (`plan.is_free` /
 * `plan.upgrade_url`, surfaced by Connection_Endpoint::present()).
 *
 * Answers a descriptor for the page shell, which decides how a header action
 * looks, or null until the health check resolves and whenever the site is not
 * connected, the plan is not free, or no upgrade URL is available.
 */
export const useUpgradeAction = () => {
	const plan = usePlan();

	if ( ! plan?.is_free || ! plan?.upgrade_url ) {
		return null;
	}

	return {
		key: 'upgrade',
		label: __( 'Upgrade plan', 'searcio' ),
		icon: trendingUp,
		onClick: () => window.open( plan.upgrade_url, '_blank', 'noopener,noreferrer' ),
	};
};
