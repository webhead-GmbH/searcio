import { __ } from '@wordpress/i18n';
import { chartBar } from '@wordpress/icons';

import { useStatisticsUrl } from './plan';

/**
 * The header action that opens this site's search statistics on Searcio's
 * dashboard in a new tab, for a connected site. The statistics are the
 * dashboard's; the plugin links to them rather than drawing a copy.
 *
 * Answers a descriptor for the page shell, or null for a site that is not
 * connected.
 */
export const useStatisticsAction = () => {
	const url = useStatisticsUrl();

	if ( ! url ) {
		return null;
	}

	return {
		key: 'statistics',
		label: __( 'Search statistics', 'searcio' ),
		icon: chartBar,
		onClick: () => window.open( url, '_blank', 'noopener,noreferrer' ),
	};
};
