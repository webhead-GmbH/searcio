import {useContext, useState} from '@wordpress/element';
import { Button } from '@wordpress/components';
import { InputControl, Notice, Stack, Text } from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {showToast} from '../../../../toast';
import ConnectionResultNotice from './ConnectionResultNotice';
import {useAnnounce} from '../../../../utils/announce';

const pluginData = window.webhead_search_cloudData || {};
const SECRET_PLACEHOLDER = '••••••••••••';

/**
 * Manual credential entry: paste the site's write key/secret/search key
 * directly instead of using the zero-friction Connect button. Needed for the
 * `pending_claim` flow (the owner finishes on the Searcio dashboard and
 * copies the resulting keys back here) and for key rotation. Collapsed by
 * default; the parent expands it automatically on `pending_claim` or a `409`.
 */
const ManualConnectionEntry = ({pendingClaim}) => {
	const {settings, updateSetting, saveSettings, saveError, clearSaveError, isSaving, isLoading, hasUnsavedChanges} =
		useContext(SettingsContext);

	const [writeKey, setWriteKey] = useState('');
	const [writeSecret, setWriteSecret] = useState('');
	const [isTesting, setIsTesting] = useState(false);
	const [result, setResult] = useState(null);

	const hasStored = (key) => Boolean(settings[key]);

	const onSave = async () => {
		const success = await saveSettings();

		// A failure is reported by the notice above the buttons, with the
		// reason the REST API gave; a toast as well would say it twice.
		if (!success) {
			return;
		}

		setWriteKey('');
		setWriteSecret('');

		showToast(__('Connection settings saved.', 'searcio'), 'success');
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
			// supersedes the pending-claim notice - clear it so the tab shows
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
					__('The test request failed.', 'searcio'),
			});
		} finally {
			setIsTesting(false);
		}
	};

	const connectionSaveDisabled = isSaving || isLoading || !hasUnsavedChanges;
	const connectionSaveLabel = isSaving
		? __('Saving…', 'searcio')
		: __('Save connection', 'searcio');
	const connectionSaveDescription = !isLoading && !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'searcio')
		: undefined;

	// A failed save is read out as its notice appears.
	useAnnounce(saveError ? sprintf(
		/* translators: %s: reason the settings could not be saved, as reported by the REST API. */
		__('The settings could not be saved: %s', 'searcio'),
		saveError
	) : '', 'assertive');

	return (
		<Stack direction="column" gap="lg" className="webhead-search-cloud-manual-entry">
			<Text render={<p/>} variant="body-sm">
				{__(
					'Enter the credentials from your site page in the Searcio app. The write key and secret are stored encrypted and never sent to the browser in clear text.',
					'searcio'
				)}
			</Text>
			<InputControl
				label={__('Search key', 'searcio')}
				description={__('Public key (sk_...) used by the browser, restricted by your domain allowlist.', 'searcio')}
				value={settings.search_key ?? ''}
				onValueChange={(value) => updateSetting('search_key', value)}
			/>
			<InputControl
				type="password"
				autoComplete="off"
				label={__('Write key', 'searcio')}
				placeholder={hasStored('write_key') ? SECRET_PLACEHOLDER : ''}
				description={
					hasStored('write_key')
						? __('A write key is saved. Leave blank to keep it, or enter a new one to rotate.', 'searcio')
						: __('Server-side write key (wk_...).', 'searcio')
				}
				value={writeKey}
				onValueChange={(value) => {
					setWriteKey(value);
					updateSetting('write_key', value);
				}}
			/>
			<InputControl
				type="password"
				autoComplete="off"
				label={__('Write secret', 'searcio')}
				placeholder={hasStored('write_secret') ? SECRET_PLACEHOLDER : ''}
				description={
					hasStored('write_secret')
						? __('A write secret is saved. Leave blank to keep it, or enter a new one to rotate.', 'searcio')
						: __('Server-side write secret.', 'searcio')
				}
				value={writeSecret}
				onValueChange={(value) => {
					setWriteSecret(value);
					updateSetting('write_secret', value);
				}}
			/>

			<ConnectionResultNotice result={result}/>

			{saveError && (
				<Notice.Root intent="error">
					<Notice.Description>
						{sprintf(
							/* translators: %s: reason the settings could not be saved, as reported by the REST API. */
							__('The settings could not be saved: %s', 'searcio'),
							saveError
						)}
					</Notice.Description>
					<Notice.CloseIconButton onClick={clearSaveError}/>
				</Notice.Root>
			)}

			<Stack
				className="webhead-search-cloud-connection-actions"
				direction="row"
				align="center"
				gap="md"
				wrap="wrap"
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
						? __('Testing…', 'searcio')
						: __('Test connection', 'searcio')}
				</Button>
				<Text render={<span/>} variant="body-sm" className="webhead-search-cloud-connection-hint">
					{__('Test uses your saved credentials - save first.', 'searcio')}
				</Text>
			</Stack>
		</Stack>
	);
};

export default ManualConnectionEntry;
