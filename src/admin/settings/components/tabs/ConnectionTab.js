import {useContext, useEffect, useState} from '@wordpress/element';
import {
	__experimentalConfirmDialog as ConfirmDialog,
	Button,
	CheckboxControl,
	Notice,
	TextControl,
} from '@wordpress/components';
import {Card, Text} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {Flex} from '../../../../components/Layout';
import {showToast} from '../../../../toast';
import ConnectionExplainer from './ConnectionExplainer';
import ConnectionResultNotice from './ConnectionResultNotice';
import ManualConnectionEntry from './ManualConnectionEntry';

const pluginData = window.webhead_search_cloudData || {};
const CONNECT_PATH = pluginData?.api?.connectPath || '/webhead-search-cloud/v1/connection/connect';
const DISCONNECT_PATH = pluginData?.api?.disconnectPath || '/webhead-search-cloud/v1/connection/disconnect';
const TEST_CONNECTION_PATH = pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';
const CONNECTION_LEGAL_PATH = pluginData?.api?.connectionLegalPath || '/webhead-search-cloud/v1/connection/legal';
const CONNECTION_DEFAULTS = pluginData?.connection?.defaults || {};
const FALLBACK_LEGAL_LINKS = {
	termsUrl: pluginData?.legal?.termsUrl || '',
	privacyUrl: pluginData?.legal?.privacyUrl || '',
	dpaUrl: pluginData?.legal?.dpaUrl || '',
};

const GENERIC_CONNECT_ERROR = __('The connection request failed.', 'webhead-search-cloud');

/** Wraps `text` in a link when `url` is present; a plain string otherwise. `stopPropagation` keeps a click from also toggling the checkbox the link's label belongs to. */
const legalLink = (url, text) => (url
	? <a href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{text}</a>
	: text);

/**
 * Connection tab: zero-friction Connect (docs/api/building-a-plugin.md
 * "Zero-friction connect") as the primary path, with manual key entry
 * collapsed underneath for the `pending_claim` follow-up and key rotation.
 */
const ConnectionTab = () => {
	const {settings, isLoading, reloadSettings} = useContext(SettingsContext);

	const [termsPrivacy, setTermsPrivacy] = useState(false);
	const [dpa, setDpa] = useState(false);
	const [showEmailOverride, setShowEmailOverride] = useState(false);
	const [overrideEmail, setOverrideEmail] = useState('');
	const [overrideAdminName, setOverrideAdminName] = useState('');
	const [overrideCompanyName, setOverrideCompanyName] = useState('');
	const [isConnecting, setIsConnecting] = useState(false);
	const [connectError, setConnectError] = useState(null);
	const [connectedResult, setConnectedResult] = useState(null);
	const [manualEntryExpanded, setManualEntryExpanded] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
	const [legalLinks, setLegalLinks] = useState(FALLBACK_LEGAL_LINKS);

	const isConnected = Boolean(settings.write_key) && Boolean(settings.write_secret);
	const pendingClaim = Boolean(settings.connect_pending_claim);
	const pendingClaimEmail = settings.connect_pending_email || '';
	const effectiveEmail = showEmailOverride && overrideEmail
		? overrideEmail
		: (CONNECTION_DEFAULTS.email || '');

	// Auto-run the health check the moment credentials exist - freshly
	// connected or from a prior session - so the Connected card shows without
	// a manual "Test connection" click.
	useEffect(() => {
		if (isLoading || connectedResult || !isConnected) {
			return undefined;
		}

		let cancelled = false;

		(async () => {
			try {
				const response = await apiFetch({path: TEST_CONNECTION_PATH, method: 'POST'});

				if (!cancelled) {
					setConnectedResult(response);
				}
			} catch (error) {
				if (!cancelled) {
					setConnectedResult({
						ok: false,
						message: error?.message || __('The test request failed.', 'webhead-search-cloud'),
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [isLoading, isConnected, connectedResult]);

	// A pending claim always needs the pasted-keys path to finish.
	useEffect(() => {
		if (pendingClaim) {
			setManualEntryExpanded(true);
		}
	}, [pendingClaim]);

	// Live Search Cloud-configured legal links (GET /connect), fetched here
	// rather than localized on page load so an unreachable Search Cloud never
	// delays opening any other settings tab. The plugin's own placeholder
	// constants keep the checkboxes/tooltip usable in the meantime.
	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const response = await apiFetch({path: CONNECTION_LEGAL_PATH});

				if (!cancelled && response) {
					setLegalLinks({
						termsUrl: response.terms || FALLBACK_LEGAL_LINKS.termsUrl,
						privacyUrl: response.privacy || FALLBACK_LEGAL_LINKS.privacyUrl,
						dpaUrl: response.dpa || FALLBACK_LEGAL_LINKS.dpaUrl,
					});
				}
			} catch (error) {
				// Keep the fallback links - non-fatal.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleConnectOutcome = async (outcome) => {
		if ('pending_claim' === outcome?.flow) {
			setManualEntryExpanded(true);
			await reloadSettings();

			return;
		}

		if ('connected' === outcome?.flow) {
			setConnectedResult(outcome);
			await reloadSettings();

			return;
		}

		setConnectError(outcome?.message || GENERIC_CONNECT_ERROR);

		if (outcome?.reveal_manual_entry) {
			setManualEntryExpanded(true);
		}
	};

	const onConnect = async () => {
		setIsConnecting(true);
		setConnectError(null);

		try {
			const response = await apiFetch({
				path: CONNECT_PATH,
				method: 'POST',
				data: {
					email: showEmailOverride ? overrideEmail : '',
					admin_name: showEmailOverride ? overrideAdminName : '',
					site_name: showEmailOverride ? overrideCompanyName : '',
					terms_privacy: termsPrivacy,
					dpa,
				},
			});

			await handleConnectOutcome(response);
		} catch (error) {
			await handleConnectOutcome(error);
		} finally {
			setIsConnecting(false);
		}
	};

	const onDisconnect = async () => {
		setDisconnectConfirmOpen(false);
		setIsDisconnecting(true);

		try {
			await apiFetch({path: DISCONNECT_PATH, method: 'POST'});
			await reloadSettings();

			setConnectedResult(null);
			setManualEntryExpanded(false);
			setTermsPrivacy(false);
			setDpa(false);
			setShowEmailOverride(false);

			showToast(__('Disconnected from Search Cloud.', 'webhead-search-cloud'), 'success');
		} catch (error) {
			showToast(
				error?.message || __('Could not disconnect.', 'webhead-search-cloud'),
				'error'
			);
		} finally {
			setIsDisconnecting(false);
		}
	};

	const connectDisabled = isConnecting || !termsPrivacy;
	const connectLabel = isConnecting
		? __('Connecting…', 'webhead-search-cloud')
		: __('Connect to Search Cloud', 'webhead-search-cloud');

	return (
		<Card.Root className="whsc-tab-card">
			<Card.Header className="whsc-tab-card-header">
				<Card.Title render={<h3/>}>
					{__('Search Cloud connection', 'webhead-search-cloud')}
				</Card.Title>
				<Text render={<p/>} variant="body-sm">
					{__(
						'Connect this site to webhead Search Cloud to start syncing content and enable search.',
						'webhead-search-cloud'
					)}
				</Text>
			</Card.Header>
			<Card.Content className="whsc-tab-card-content">
				{isConnected ? (
					<Flex direction="column" gap={16}>
						<ConnectionResultNotice result={connectedResult}/>

						<Flex align="center" gap={12} wrap>
							<Button
								__next40pxDefaultSize
								variant="secondary"
								isDestructive
								isBusy={isDisconnecting}
								disabled={isDisconnecting}
								onClick={() => setDisconnectConfirmOpen(true)}
							>
								{__('Disconnect', 'webhead-search-cloud')}
							</Button>
							<Button
								variant="tertiary"
								onClick={() => setManualEntryExpanded((expanded) => !expanded)}
							>
								{manualEntryExpanded
									? __('Hide advanced: manual key entry', 'webhead-search-cloud')
									: __('Advanced: manual key entry / rotate keys', 'webhead-search-cloud')}
							</Button>
						</Flex>

						{manualEntryExpanded && (
							<div className="whsc-card whsc-card--dotted webhead-search-cloud-manual-entry-card">
								<ManualConnectionEntry pendingClaim={false}/>
							</div>
						)}

						<ConfirmDialog
							isOpen={disconnectConfirmOpen}
							onConfirm={onDisconnect}
							onCancel={() => setDisconnectConfirmOpen(false)}
							confirmButtonText={__('Disconnect', 'webhead-search-cloud')}
						>
							{__(
								'This removes the saved connection credentials from this site only. It does not delete or change anything in your Search Cloud account.',
								'webhead-search-cloud'
							)}
						</ConfirmDialog>
					</Flex>
				) : (
					<Flex direction="column" align="center" gap={20} className="webhead-search-cloud-connect-hero">
						{pendingClaim && (
							<Notice status="info" isDismissible={false}>
								<p>
									{sprintf(
										/* translators: %s: the email address a confirmation link was sent to. */
										__(
											'An account already exists for %s. Check that inbox for a confirmation link, finish connecting on the Search Cloud dashboard, then paste the resulting keys below.',
											'webhead-search-cloud'
										),
										pendingClaimEmail
									)}
								</p>
							</Notice>
						)}

						{connectError && (
							<Notice status="error" isDismissible={false}>
								<p>{connectError}</p>
							</Notice>
						)}

						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							variant="primary"
							isBusy={isConnecting}
							disabled={connectDisabled}
							description={
								!termsPrivacy
									? __('Accept the Terms of Service and Privacy Policy to continue.', 'webhead-search-cloud')
									: undefined
							}
							showTooltip={!termsPrivacy}
							onClick={onConnect}
							className="webhead-search-cloud-connect-cta"
						>
							{connectLabel}
						</Button>

						<Flex direction="column" align="center" gap={8} className="webhead-search-cloud-connect-consents">
							<CheckboxControl
								__nextHasNoMarginBottom
								checked={termsPrivacy}
								onChange={setTermsPrivacy}
								label={
									<>
										{__('I accept the', 'webhead-search-cloud')}{' '}
										{legalLink(legalLinks.termsUrl, __('Terms of Service', 'webhead-search-cloud'))}
										{' '}{__('and', 'webhead-search-cloud')}{' '}
										{legalLink(legalLinks.privacyUrl, __('Privacy Policy', 'webhead-search-cloud'))}.
										{' '}{__('(required)', 'webhead-search-cloud')}
									</>
								}
							/>
							<CheckboxControl
								__nextHasNoMarginBottom
								checked={dpa}
								onChange={setDpa}
								label={
									<>
										{__('I accept the', 'webhead-search-cloud')}{' '}
										{legalLink(legalLinks.dpaUrl, __('Data Processing Agreement', 'webhead-search-cloud'))}.
										{' '}{__('(optional)', 'webhead-search-cloud')}
									</>
								}
							/>
						</Flex>

						<Flex align="center" justify="center" gap={4} wrap>
							<Text render={<span/>} variant="body-sm" className="webhead-search-cloud-connection-hint">
								{effectiveEmail
									? sprintf(
										/* translators: %s: the email address used to connect. */
										__("You'll connect using %s. A new Search Cloud account is created if it doesn't have one yet; otherwise this site connects to its existing account.", 'webhead-search-cloud'),
										effectiveEmail
									)
									: __('An admin email is required to connect.', 'webhead-search-cloud')}
							</Text>
							<ConnectionExplainer legal={legalLinks}/>
						</Flex>

						<Button
							variant="link"
							onClick={() => setShowEmailOverride((open) => !open)}
						>
							{showEmailOverride
								? __('Use the default email instead', 'webhead-search-cloud')
								: __('Not this email?', 'webhead-search-cloud')}
						</Button>

						{showEmailOverride && (
							<Flex direction="column" gap={12} className="webhead-search-cloud-email-override">
								<TextControl
									__next40pxDefaultSize
									type="email"
									label={__('Email', 'webhead-search-cloud')}
									value={overrideEmail}
									onChange={setOverrideEmail}
								/>
								<TextControl
									__next40pxDefaultSize
									label={__('Your name (optional)', 'webhead-search-cloud')}
									value={overrideAdminName}
									onChange={setOverrideAdminName}
								/>
								<TextControl
									__next40pxDefaultSize
									label={__('Company name (optional)', 'webhead-search-cloud')}
									help={__('Used as the Search Cloud account name.', 'webhead-search-cloud')}
									value={overrideCompanyName}
									onChange={setOverrideCompanyName}
								/>
							</Flex>
						)}

						<Button
							variant="tertiary"
							onClick={() => setManualEntryExpanded((expanded) => !expanded)}
						>
							{manualEntryExpanded
								? __('Hide advanced: manual key entry', 'webhead-search-cloud')
								: __('Advanced: manual key entry', 'webhead-search-cloud')}
						</Button>

						{manualEntryExpanded && (
							<div className="whsc-card whsc-card--dotted webhead-search-cloud-manual-entry-card">
								<ManualConnectionEntry pendingClaim={pendingClaim}/>
							</div>
						)}
					</Flex>
				)}
			</Card.Content>
		</Card.Root>
	);
};

export default ConnectionTab;
