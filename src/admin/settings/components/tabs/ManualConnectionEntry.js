import {useContext, useState} from '@wordpress/element';
import {Button, TextControl} from '@wordpress/components';
import {Text} from '@wordpress/ui';
import {__} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {Flex} from '../../../../components/Layout';
import {showToast} from '../../../../toast';
import ConnectionResultNotice from './ConnectionResultNotice';

const pluginData = window.webhead_search_cloudData || {};
const SECRET_PLACEHOLDER = '••••••••••••';

/**
 * Manual credential entry: paste the site's write key/secret/search key
 * directly instead of using the zero-friction Connect button. Needed for the
 * `pending_claim` flow (the owner finishes on the Search Cloud dashboard and
 * copies the resulting keys back here) and for key rotation. Collapsed by
 * default; the parent expands it automatically on `pending_claim` or a `409`.
 */
const ManualConnectionEntry = ({pendingClaim}) => {
	const {settings, updateSetting, saveSettings, isSaving, isLoading, hasUnsavedChanges} =
		useContext(SettingsContext);

	const [writeKey, setWriteKey] = useState('');
	const [writeSecret, setWriteSecret] = useState('');
	const [isTesting, setIsTesting] = useState(false);
	const [result, setResult] = useState(null);

	const hasStored = (key) => Boolean(settings[key]);

	const onSave = async () => {
		const success = await saveSettings();

		if (success) {
			setWriteKey('');
			setWriteSecret('');
		}

		showToast(
			success
				? __('Connection settings saved.', 'webhead-search-cloud')
				: __('Could not save the connection settings.', 'webhead-search-cloud'),
			success ? 'success' : 'error'
		);
	};

	const onTest = async () => {
		setIsTesting(true);
		setResult(null);

		try {
			const response = await apiFetch({
				path:
					pluginData?.api?.testConnectionPath ||
					'/webhead-search-cloud/v1/connection/test',
				method: 'POST',
			});

			setResult(response);

			// A pasted-in credential set that just proved itself healthy
			// supersedes the pending-claim notice — clear it so the tab shows
			// the normal Connected state instead of "check your inbox" forever.
			if (response.ok && pendingClaim) {
				updateSetting('connect_pending_claim', false);
				updateSetting('connect_pending_email', '');
				await saveSettings();
			}
		} catch (error) {
			setResult({
				ok: false,
				message:
					error?.message ||
					__('The test request failed.', 'webhead-search-cloud'),
			});
		} finally {
			setIsTesting(false);
		}
	};

	const connectionSaveDisabled = isSaving || isLoading || !hasUnsavedChanges;
	const connectionSaveLabel = isSaving
		? __('Saving…', 'webhead-search-cloud')
		: __('Save connection', 'webhead-search-cloud');
	const connectionSaveDescription = !isLoading && !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'webhead-search-cloud')
		: undefined;

	return (
		<Flex direction="column" gap={16} className="webhead-search-cloud-manual-entry">
			<Text render={<p/>} variant="body-sm">
				{__(
					'Enter the credentials from your site page in the Search Cloud app. The write key and secret are stored encrypted and never sent to the browser in clear text.',
					'webhead-search-cloud'
				)}
			</Text>
			<TextControl
				__next40pxDefaultSize
				label={__('Search key', 'webhead-search-cloud')}
				help={__('Public key (sk_...) used by the browser, restricted by your domain allowlist.', 'webhead-search-cloud')}
				value={settings.search_key ?? ''}
				onChange={(value) => updateSetting('search_key', value)}
			/>
			<TextControl
				__next40pxDefaultSize
				type="password"
				autoComplete="off"
				label={__('Write key', 'webhead-search-cloud')}
				placeholder={hasStored('write_key') ? SECRET_PLACEHOLDER : ''}
				help={
					hasStored('write_key')
						? __('A write key is saved. Leave blank to keep it, or enter a new one to rotate.', 'webhead-search-cloud')
						: __('Server-side write key (wk_...).', 'webhead-search-cloud')
				}
				value={writeKey}
				onChange={(value) => {
					setWriteKey(value);
					updateSetting('write_key', value);
				}}
			/>
			<TextControl
				__next40pxDefaultSize
				type="password"
				autoComplete="off"
				label={__('Write secret', 'webhead-search-cloud')}
				placeholder={hasStored('write_secret') ? SECRET_PLACEHOLDER : ''}
				help={
					hasStored('write_secret')
						? __('A write secret is saved. Leave blank to keep it, or enter a new one to rotate.', 'webhead-search-cloud')
						: __('Server-side write secret.', 'webhead-search-cloud')
				}
				value={writeSecret}
				onChange={(value) => {
					setWriteSecret(value);
					updateSetting('write_secret', value);
				}}
			/>

			<ConnectionResultNotice result={result}/>

			<Flex
				className="webhead-search-cloud-connection-actions"
				align="center"
				gap={12}
				wrap
			>
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					variant="primary"
					isBusy={isSaving}
					disabled={connectionSaveDisabled}
					description={connectionSaveDescription}
					label={connectionSaveLabel}
					onClick={onSave}
					showTooltip={!!connectionSaveDescription}
				>
					{connectionSaveLabel}
				</Button>
				<Button
					__next40pxDefaultSize
					variant="secondary"
					isBusy={isTesting}
					disabled={isTesting || isSaving || isLoading}
					onClick={onTest}
				>
					{isTesting
						? __('Testing…', 'webhead-search-cloud')
						: __('Test connection', 'webhead-search-cloud')}
				</Button>
				<Text render={<span/>} variant="body-sm" className="webhead-search-cloud-connection-hint">
					{__('Test uses your saved credentials - save first.', 'webhead-search-cloud')}
				</Text>
			</Flex>
		</Flex>
	);
};

export default ManualConnectionEntry;
