import {useContext, useEffect, useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {Card, CheckboxControl, CollapsibleCard, InputControl, Notice, Stack, Text} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {Grid} from '../../../../components/Layout';
import Modal from '../../../../components/Modal';
import {showToast} from '../../../../toast';
import TabIntro from '../TabIntro';
import ConnectionExplainer from './ConnectionExplainer';
import ConnectionResultNotice from './ConnectionResultNotice';
import LegalLinks from './LegalLinks';
import UsageCard from './UsageCard';
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

const GENERIC_CONNECT_ERROR = __('The connection request failed.', 'searcio');

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
						message: error?.message || __('The test request failed.', 'searcio'),
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
	// delays opening any other settings tab. The plugin's own constants keep
	// the consents usable in the meantime.
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
		setIsDisconnecting(true);

		try {
			await apiFetch({path: DISCONNECT_PATH, method: 'POST'});
			await reloadSettings();

			setConnectedResult(null);
			setManualEntryExpanded(false);
			setTermsPrivacy(false);
			setDpa(false);
			setShowEmailOverride(false);

			showToast(__('Disconnected from Search Cloud.', 'searcio'), 'success');
		} catch (error) {
			showToast(
				error?.message || __('Could not disconnect.', 'searcio'),
				'error'
			);
		} finally {
			setIsDisconnecting(false);
		}
	};

	const connectDisabled = isConnecting || !termsPrivacy;
	const connectLabel = isConnecting
		? __('Connecting…', 'searcio')
		: __('Connect to Search Cloud', 'searcio');

	// One disclosure for the pasted-keys path, whichever state the tab is in.
	const manualEntry = (
		<CollapsibleCard.Root
			open={manualEntryExpanded}
			onOpenChange={setManualEntryExpanded}
			className="whsc-card whsc-card--dotted webhead-search-cloud-manual-entry-card"
		>
			<CollapsibleCard.Header render={<h3/>}>
				{isConnected
					? __('Advanced: manual key entry / rotate keys', 'searcio')
					: __('Advanced: manual key entry', 'searcio')}
			</CollapsibleCard.Header>
			<CollapsibleCard.Content className="whsc-card__content">
				<ManualConnectionEntry pendingClaim={!isConnected && pendingClaim}/>
			</CollapsibleCard.Content>
		</CollapsibleCard.Root>
	);

	return (
		<Stack direction="column" gap="lg" className="webhead-search-cloud-connection">
			<TabIntro
				title={__('Search Cloud connection', 'searcio')}
				description={__(
					'Connect this site to webhead Search Cloud to start syncing content and enable search.',
					'searcio'
				)}
			/>

			{isConnected ? (
				<>
					<ConnectionResultNotice result={connectedResult}/>

					{/* The same health response the notice above reads. A spent
					    allowance is why a storefront stops returning results, so it
					    belongs where an admin looks when search "breaks". */}
					<UsageCard usage={connectedResult?.usage}/>

					<Stack direction="row" gap="sm" align="center" wrap="wrap">
						<Button
							__next40pxDefaultSize
							variant="secondary"
							isDestructive
							isBusy={isDisconnecting}
							disabled={isDisconnecting}
							onClick={() => setDisconnectConfirmOpen(true)}
						>
							{__('Disconnect', 'searcio')}
						</Button>
					</Stack>

					{manualEntry}
				</>
			) : (
				<>
					{pendingClaim && (
						<Notice.Root intent="info">
							<Notice.Description>
								{sprintf(
									/* translators: %s: the email address a confirmation link was sent to. */
									__(
										'An account already exists for %s. Check that inbox for a confirmation link, finish connecting on the Search Cloud dashboard, then paste the resulting keys below.',
										'searcio'
									),
									pendingClaimEmail
								)}
							</Notice.Description>
						</Notice.Root>
					)}

					{connectError && (
						<Notice.Root intent="error">
							<Notice.Description>{connectError}</Notice.Description>
						</Notice.Root>
					)}

					{/* The one column that centres what is in it: the connect
					    moment is a button, two consents and a sentence, and each
					    is meant to be as wide as it is. */}
					<Stack direction="column" align="center" gap="lg" className="webhead-search-cloud-connect-hero">
						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							variant="primary"
							isBusy={isConnecting}
							disabled={connectDisabled}
							description={
								!termsPrivacy
									? __('Accept the Terms of Service and Privacy Policy to continue.', 'searcio')
									: undefined
							}
							showTooltip={!termsPrivacy}
							onClick={onConnect}
							className="webhead-search-cloud-connect-cta"
						>
							{connectLabel}
						</Button>

						<Stack direction="column" gap="md" className="webhead-search-cloud-connect-consents">
							<CheckboxControl
								label={__('I accept the Terms of Service and Privacy Policy (required)', 'searcio')}
								details={
									<LegalLinks
										links={[
											{url: legalLinks.termsUrl, label: __('Terms of Service', 'searcio')},
											{url: legalLinks.privacyUrl, label: __('Privacy Policy', 'searcio')},
										]}
									/>
								}
								checked={termsPrivacy}
								onCheckedChange={(checked) => setTermsPrivacy(Boolean(checked))}
							/>
							<CheckboxControl
								label={__('I accept the Data Processing Agreement (optional)', 'searcio')}
								details={
									<LegalLinks
										links={[
											{url: legalLinks.dpaUrl, label: __('Data Processing Agreement', 'searcio')},
										]}
									/>
								}
								checked={dpa}
								onCheckedChange={(checked) => setDpa(Boolean(checked))}
							/>
						</Stack>

						<Text render={<p/>} variant="body-sm" className="webhead-search-cloud-connection-hint">
							{effectiveEmail
								? sprintf(
									/* translators: %s: the email address used to connect. */
									__("You'll connect using %s. A new Search Cloud account is created if it doesn't have one yet; otherwise this site connects to its existing account.", 'searcio'),
									effectiveEmail
								)
								: __('An admin email is required to connect.', 'searcio')}
						</Text>

						<Stack direction="row" gap="lg" justify="center" align="center" wrap="wrap">
							<Button
								variant="link"
								className="webhead-search-cloud-email-override-toggle"
								aria-expanded={showEmailOverride}
								onClick={() => setShowEmailOverride((open) => !open)}
							>
								{showEmailOverride
									? __('Use the default email instead', 'searcio')
									: __('Not this email?', 'searcio')}
							</Button>
							<ConnectionExplainer legal={legalLinks}/>
						</Stack>
					</Stack>

					{showEmailOverride && (
						<Card.Root className="whsc-card whsc-card--dotted webhead-search-cloud-email-override">
							<Card.Content className="whsc-card__content">
								<Grid minColumnWidth={{base: 200, md: 220}} gap="var(--wpds-dimension-gap-md)" align="start">
									<InputControl
										type="email"
										label={__('Email', 'searcio')}
										value={overrideEmail}
										onValueChange={setOverrideEmail}
									/>
									<InputControl
										label={__('Your name (optional)', 'searcio')}
										value={overrideAdminName}
										onValueChange={setOverrideAdminName}
									/>
									<InputControl
										label={__('Company name (optional)', 'searcio')}
										description={__('Used as the Search Cloud account name.', 'searcio')}
										value={overrideCompanyName}
										onValueChange={setOverrideCompanyName}
									/>
								</Grid>
							</Card.Content>
						</Card.Root>
					)}

					{manualEntry}
				</>
			)}

			{/* Disconnecting deletes the site and its index on Search Cloud, which
			    no click undoes, so it is asked about in a dialog that only its own
			    buttons close, and the one that goes ahead says what it deletes. */}
			<Modal
				isOpen={disconnectConfirmOpen}
				onClose={() => setDisconnectConfirmOpen(false)}
				title={__('Disconnect from Search Cloud?', 'searcio')}
				size="small"
				showCloseButton={false}
				closeOnEscape={false}
				closeOnBackdropClick={false}
				actions={[
					{
						label: __('Cancel', 'searcio'),
						variant: 'tertiary',
					},
					{
						label: __('Disconnect and delete the index', 'searcio'),
						variant: 'primary',
						isDestructive: true,
						onClick: onDisconnect,
					},
				]}
			>
				<Text>
					{__(
						"This removes the site from Search Cloud and permanently deletes its search index there. The storefront falls back to WordPress's own search until you connect again and run a sync. Nothing in WordPress is deleted.",
						'searcio'
					)}
				</Text>
			</Modal>
		</Stack>
	);
};

export default ConnectionTab;
