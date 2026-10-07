import {Notice} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';

import {formatNumber} from '../../../../utils/number';

/**
 * Renders a health-check style result (`{ ok, documents, site_id, message }`)
 * as a success/error Notice. Shared by the Connect button's own result and
 * the manual "Test connection" action - both hit the same `/connection/test`
 * response shape.
 */
const ConnectionResultNotice = ({result}) => {
	if (!result) {
		return null;
	}

	if (result.ok) {
		const docs = result.documents || {};
		const detail =
			docs.used !== null && docs.used !== undefined
				? sprintf(
					/* translators: 1: used documents, 2: document limit. */
					__('Connected - %1$s / %2$s documents indexed.', 'webhead-search-cloud'),
					formatNumber(docs.used),
					docs.limit === null || docs.limit === undefined
						? __('unlimited', 'webhead-search-cloud')
						: formatNumber(docs.limit)
				)
				: __('Connected.', 'webhead-search-cloud');
		const siteIdSuffix = result.site_id
			? sprintf(
				/* translators: %d: the Search Cloud site id. */
				__(' (site #%d)', 'webhead-search-cloud'),
				result.site_id
			)
			: '';

		return (
			<Notice.Root intent="success">
				<Notice.Description>{detail}{siteIdSuffix}</Notice.Description>
			</Notice.Root>
		);
	}

	return (
		<Notice.Root intent="error">
			<Notice.Description>
				{result.message || __('Connection failed.', 'webhead-search-cloud')}
			</Notice.Description>
		</Notice.Root>
	);
};

export default ConnectionResultNotice;
