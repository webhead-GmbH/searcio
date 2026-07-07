import {useContext, useState} from '@wordpress/element';
import {Button, Notice, TextControl,} from '@wordpress/components';
import {Card, Text} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {Flex} from '../../../../components/Layout';
import {showToast} from '../../../../toast';

const pluginData = window.webhead_search_cloudData || {};
const SECRET_PLACEHOLDER = '••••••••••••';

/**
 * The service host is hard-coded server-side (not user-editable). Write
 * key/secret are masked: their stored (encrypted) value is never shown, the
 * inputs start blank, and typing a new value is what overwrites the stored
 * one. A saved value is signalled with a dotted placeholder.
 */
const ConnectionTab = () => {
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

	const renderResult = () => {
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
						Number(docs.used).toLocaleString(),
						docs.limit === null || docs.limit === undefined
							? __('unlimited', 'webhead-search-cloud')
							: Number(docs.limit).toLocaleString()
					)
					: __('Connected.', 'webhead-search-cloud');
			// Site id is resolved server-side from the write key/secret and
			// only known once a test succeeds.
			const siteIdSuffix = result.site_id
				? sprintf(
					/* translators: %d: the Search Cloud site id. */
					__(' (site #%d)', 'webhead-search-cloud'),
					result.site_id
				)
				: '';

			return (
				<Notice status="success" isDismissible={false}>
					<p>{detail}{siteIdSuffix}</p>
				</Notice>
			);
		}

		return (
			<Notice status="error" isDismissible={false}>
				<p>{result.message || __('Connection failed.', 'webhead-search-cloud')}</p>
			</Notice>
		);
	};

	const connectionSaveDisabled = isSaving || isLoading || !hasUnsavedChanges;
	const connectionSaveLabel = isSaving
		? __('Saving…', 'webhead-search-cloud')
		: __('Save connection', 'webhead-search-cloud');
	const connectionSaveDescription = !isLoading && !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'webhead-search-cloud')
		: undefined;

	return (
		<Card.Root className="whsc-tab-card">
			<Card.Header className="whsc-tab-card-header">
				<Card.Title render={<h3/>}>
					{__('Search Cloud connection', 'webhead-search-cloud')}
				</Card.Title>
				<Text render={<p/>} variant="body-sm">
					{__(
						'Enter the credentials from your site page in the Search Cloud app. The write key and secret are stored encrypted and never sent to the browser in clear text.',
						'webhead-search-cloud'
					)}
				</Text>
			</Card.Header>
			<Card.Content className="whsc-tab-card-content">
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

				{renderResult()}

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
			</Card.Content>
		</Card.Root>
	);
};

export default ConnectionTab;
