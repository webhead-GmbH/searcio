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
 * Why Searcio refuses the account the keys belong to, or null when it serves
 * it: `{ reason, title, message, support_url }` from `/connection/test`. The
 * keys work either way, so the result itself is `ok`.
 *
 * @param {?Object} result
 * @return {?Object} The account part of the result, for a refused account.
 */
export const accountRefusal = (result) => (
	result?.ok && false === result?.account?.served ? result.account : null
);

/**
 * The way back from a refusal: a plan for an account without one, the
 * billing page for an overdue payment (the plan's upgrade link leads there),
 * support for a suspended one.
 *
 * @param {Object} result
 * @param {Object} refusal
 * @return {{url: string, label: string}} The link, with an empty url when there is none.
 */
const refusalAction = (result, refusal) => {
	switch (refusal.reason) {
		case 'no_active_plan':
			return {url: result.plan?.upgrade_url || '', label: __('Choose a plan', 'searcio')};
		case 'payment_overdue':
			return {url: result.plan?.upgrade_url || '', label: __('Go to billing', 'searcio')};
		default:
			return {url: refusal.support_url || '', label: __('Contact Searcio support', 'searcio')};
	}
};

/**
 * Why the storefront's search key does not work from this site, or '' when
 * it does: the write key can be connected while the search key is wrong, and
 * then every visitor's search is WordPress's own.
 *
 * @param {?Object} result
 * @return {string} The reason, or ''.
 */
export const searchKeyProblem = (result) => (
	result?.ok && false === result?.search_key?.ok ? String(result.search_key.message || '') : ''
);

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

	const refusal = accountRefusal(result);

	if (refusal) {
		return `${refusal.title} ${refusal.message}`;
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

	const keyProblem = searchKeyProblem(result);

	return keyProblem ? `${detail + siteIdSuffix} ${keyProblem}` : detail + siteIdSuffix;
};

const ConnectionResultNotice = ({result}) => {
	const message = resultMessage(result);
	const refusal = accountRefusal(result);

	// The answer of a test or a connect is read out as it arrives: a failure
	// at once, a success when the screen reader is free.
	const keyProblem = searchKeyProblem(result);

	useAnnounce(message, result?.ok && !refusal && !keyProblem ? 'polite' : 'assertive');

	if (!result) {
		return null;
	}

	// Connected, and still nothing works: every search and sync is refused
	// until the owner chooses a plan, or support lifts the suspension.
	if (refusal) {
		const action = refusalAction(result, refusal);

		return (
			<Notice.Root intent="error" className="searcio-account-refusal">
				<Notice.Title>{refusal.title}</Notice.Title>
				<Notice.Description>{refusal.message}</Notice.Description>
				{action.url && (
					<Notice.Actions>
						<Notice.ActionLink href={action.url} openInNewTab>
							{action.label}
						</Notice.ActionLink>
					</Notice.Actions>
				)}
			</Notice.Root>
		);
	}

	return (
		<Notice.Root intent={result.ok && !keyProblem ? 'success' : 'error'}>
			<Notice.Description>{message}</Notice.Description>
		</Notice.Root>
	);
};

export default ConnectionResultNotice;
