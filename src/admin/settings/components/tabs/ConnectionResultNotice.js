import {Notice} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';

import {formatNumber} from '../../../../utils/number';
import {useAnnounce} from '../../../../utils/announce';

/**
 * Renders a health-check style result (`{ ok, documents, site_id, message }`)
 * as a success/error Notice. Shared by the Connect button's own result and
 * the manual "Test connection" action - both hit the same `/connection/test`
 * response shape.
 */
/**
 * What a result says, in the words its notice prints.
 *
 * @param {?Object} result
 * @return {string} The message, or '' without a result.
 */
const resultMessage = (result) => {
	if (!result) {
		return '';
	}

	if (!result.ok) {
		return result.message || __('Connection failed.', 'searcio');
	}

	const docs = result.documents || {};
	const detail =
		docs.used !== null && docs.used !== undefined
			? sprintf(
				/* translators: 1: used documents, 2: document limit. */
				__('Connected - %1$s / %2$s documents indexed.', 'searcio'),
				formatNumber(docs.used),
				docs.limit === null || docs.limit === undefined
					? __('unlimited', 'searcio')
					: formatNumber(docs.limit)
			)
			: __('Connected.', 'searcio');
	const siteIdSuffix = result.site_id
		? sprintf(
			/* translators: %d: the Searcio site id. */
			__(' (site #%d)', 'searcio'),
			result.site_id
		)
		: '';

	return detail + siteIdSuffix;
};

const ConnectionResultNotice = ({result}) => {
	const message = resultMessage(result);

	// The answer of a test or a connect is read out as it arrives: a failure
	// at once, a success when the screen reader is free.
	useAnnounce(message, result?.ok ? 'polite' : 'assertive');

	if (!result) {
		return null;
	}

	return (
		<Notice.Root intent={result.ok ? 'success' : 'error'}>
			<Notice.Description>{message}</Notice.Description>
		</Notice.Root>
	);
};

export default ConnectionResultNotice;
