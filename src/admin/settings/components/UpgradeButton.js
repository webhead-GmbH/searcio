import {useEffect, useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {__} from '@wordpress/i18n';
import {trendingUp} from '@wordpress/icons';
import {motion} from 'motion/react';
import apiFetch from '@wordpress/api-fetch';

import {useFadeInUpProps} from '../../../utils/animation';

const pluginData = window.webhead_search_cloudData || {};
const TEST_CONNECTION_PATH = pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';

/**
 * Header call-to-action shown only when the connected account is on a Free plan.
 * A purple button that deep-links to the Search Cloud billing page so the owner
 * can buy a plan. The plan tier and billing URL come from the /health check
 * (`plan.is_free` / `plan.upgrade_url`, surfaced by Connection_Endpoint::present()).
 *
 * Renders nothing until the health check resolves, and nothing at all when the
 * site isn't connected, the plan isn't free, or no upgrade URL is available.
 */
const UpgradeButton = () => {
	const [plan, setPlan] = useState(null);
	const isConnected = pluginData?.connection?.isConnected === true;
	// Before the early return below: a hook skipped on the first render and
	// called on a later one breaks React's hook order.
	const ctaMotion = useFadeInUpProps(0.2, -12);

	useEffect(() => {
		if (!isConnected) {
			return undefined;
		}

		let cancelled = false;

		(async () => {
			try {
				const response = await apiFetch({path: TEST_CONNECTION_PATH, method: 'POST'});

				if (!cancelled) {
					setPlan(response?.plan || null);
				}
			} catch (error) {
				// Non-fatal: no CTA if the health check can't be reached.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isConnected]);

	if (!plan?.is_free || !plan?.upgrade_url) {
		return null;
	}

	return (
		<motion.div {...ctaMotion} className="whsc-upgrade-cta">
			<Button
				__next40pxDefaultSize
				variant="primary"
				href={plan.upgrade_url}
				target="_blank"
				rel="noreferrer"
				icon={trendingUp}
				iconPosition="left"
				className="whsc-upgrade-button"
				label={__('Upgrade your plan on Search Cloud (opens in a new tab)', 'webhead-search-cloud')}
			>
				{__('Upgrade plan', 'webhead-search-cloud')}
			</Button>
		</motion.div>
	);
};

export default UpgradeButton;
