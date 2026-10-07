import {useCallback, useEffect, useRef, useState} from '@wordpress/element';
import {__experimentalConfirmDialog as ConfirmDialog, Button, ProgressBar} from '@wordpress/components';
import {Badge, Card, Notice, Stack, Text} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import {showToast} from '../../../../toast';
import {Grid} from '../../../../components/Layout';
import {statusIntent, statusLabels} from '../../syncStatus';
import {formatNumber} from '../../../../utils/number';
import TabIntro from '../TabIntro';
import SyncSkeleton from './SyncSkeleton';
import SyncHistory from './SyncHistory';

const pluginData = window.webhead_search_cloudData || {};
const SYNC_BASE = pluginData?.api?.syncBase || '/webhead-search-cloud/v1/sync';
const CAN_RUN_SYNC = pluginData?.caps?.runSync !== false;

const tabUrl = (tab) => {
	const url = new URL(window.location.href);
	url.searchParams.set('tab', tab);

	return url.toString();
};

const Counter = ({label, value}) => (
	<Stack direction="column" gap="xs" className="whsc-counter">
		<Text variant="heading-lg">{formatNumber(value || 0)}</Text>
		<Text variant="body-sm" className="whsc-counter__label">{label}</Text>
	</Stack>
);

// Copy for the confirmation dialog shown before Start / Re-sync everything /
// Cancel actually run.
const CONFIRM_COPY = {
	start: {
		title: __('Start sync?', 'webhead-search-cloud'),
		body: __('This sends new and changed content to Search Cloud. Continue?', 'webhead-search-cloud'),
		confirmLabel: __('Start sync', 'webhead-search-cloud'),
	},
	force: {
		title: __('Re-sync everything?', 'webhead-search-cloud'),
		body: __('This re-sends your entire catalog to Search Cloud, ignoring what’s already indexed. It can take a while and uses more of your document quota. Continue?', 'webhead-search-cloud'),
		confirmLabel: __('Re-sync everything', 'webhead-search-cloud'),
	},
	cancel: {
		title: __('Cancel this sync?', 'webhead-search-cloud'),
		body: __('This stops the current run. Progress made so far is kept, and you can start a new sync anytime. Continue?', 'webhead-search-cloud'),
		confirmLabel: __('Cancel sync', 'webhead-search-cloud'),
	},
};

const SyncTab = () => {
	const [status, setStatus] = useState(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [historyKey, setHistoryKey] = useState(0);
	const [confirmAction, setConfirmAction] = useState(null);

	const activeRef = useRef(false);
	const prevActiveId = useRef(null);

	const fetchStatus = useCallback(async () => {
		try {
			const response = await apiFetch({path: `${SYNC_BASE}/status`});

			setStatus(response);

			const activeId = response.active?.id ?? null;
			activeRef.current = activeId !== null;

			// A run just finished: refresh the history table.
			if (prevActiveId.current !== null && activeId === null) {
				setHistoryKey((value) => value + 1);
			}

			prevActiveId.current = activeId;
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let timer;
		let stopped = false;

		const loop = async () => {
			await fetchStatus();

			if (stopped) {
				return;
			}

			timer = setTimeout(loop, activeRef.current ? 3000 : 8000);
		};

		void loop();

		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [fetchStatus]);

	const post = async (path, data, successMessage) => {
		setBusy(true);

		try {
			const response = await apiFetch({path: `${SYNC_BASE}${path}`, method: 'POST', data});

			if (successMessage) {
				showToast(successMessage, 'success');
			}

			await fetchStatus();

			return response;
		} catch (error) {
			showToast(
				error?.message || __('That action could not be completed.', 'webhead-search-cloud'),
				'error'
			);

			return null;
		} finally {
			setBusy(false);
		}
	};

	// Start / Re-sync everything / Cancel only run after the user confirms in
	// the dialog below - `confirmAction` holds which one is pending.
	const runConfirmedAction = async () => {
		const action = confirmAction;

		setConfirmAction(null);

		if (!action) {
			return;
		}

		if ('cancel' === action.type) {
			await post('/cancel', {}, null);

			return;
		}

		await post(
			'/start',
			{force: 'force' === action.type},
			'force' === action.type
				? __('Full re-sync started.', 'webhead-search-cloud')
				: __('Sync started.', 'webhead-search-cloud')
		);
	};

	if (loading || !status) {
		return <SyncSkeleton/>;
	}

	const labels = statusLabels();
	const active = status.active;
	const configured = Boolean(status.configured);
	const hasTypes = Array.isArray(status.indexable) && status.indexable.length > 0;
	const percent =
		active && active.total_estimated > 0
			? Math.min(100, Math.round((active.processed / active.total_estimated) * 100))
			: null;
	// No estimate yet: a running sync moves without a number, a waiting one
	// stands at nothing.
	const progressValue = null === percent && 'running' !== active?.status ? 0 : percent ?? undefined;

	return (
		<>
			<Stack direction="column" gap="lg" className="webhead-search-cloud-sync">
				<TabIntro
					title={__('Sync', 'webhead-search-cloud')}
					description={__(
						'Send your content to Search Cloud. Only new and changed items are sent on each run, so repeat syncs are fast.',
						'webhead-search-cloud'
					)}
				/>

				{!configured && (
					<Notice.Root intent="warning">
						<Notice.Description>
							{__('Add and save your Search Cloud credentials first.', 'webhead-search-cloud')}
						</Notice.Description>
						<Notice.Actions>
							<Notice.ActionLink href={tabUrl('connection')}>
								{__('Go to Connection', 'webhead-search-cloud')}
							</Notice.ActionLink>
						</Notice.Actions>
					</Notice.Root>
				)}

				{configured && !hasTypes && (
					<Notice.Root intent="info">
						<Notice.Description>
							{__('No content types are enabled for indexing yet.', 'webhead-search-cloud')}
						</Notice.Description>
						<Notice.Actions>
							<Notice.ActionLink href={tabUrl('indexing')}>
								{__('Go to Indexing', 'webhead-search-cloud')}
							</Notice.ActionLink>
						</Notice.Actions>
					</Notice.Root>
				)}

				{active ? (
					<Card.Root className="whsc-card whsc-card--dotted whsc-sync-run">
						<Card.Header className="whsc-card__header">
							<Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap">
								<Card.Title render={<h3/>}>{__('Current run', 'webhead-search-cloud')}</Card.Title>
								<Stack direction="row" gap="sm" align="center">
									<Badge intent={statusIntent(active.status)}>
										{labels[active.status] || String(active.status)}
									</Badge>
									{active.force && (
										<Badge>{__('Full re-sync', 'webhead-search-cloud')}</Badge>
									)}
								</Stack>
							</Stack>
						</Card.Header>
						<Card.Content className="whsc-card__content">
							<Stack direction="column" gap="lg">
								<Stack direction="column" gap="sm">
									<ProgressBar className="whsc-sync-progress" value={progressValue}/>
									<Text variant="body-sm" className="whsc-progress-label">
										{percent === null
											? sprintf(
												/* translators: %d: processed item count. */
												__('%d items processed…', 'webhead-search-cloud'),
												active.processed
											)
											: sprintf(
												/* translators: 1: processed, 2: estimated total, 3: percentage. */
												__('%1$s of ~%2$s processed (%3$d%%)', 'webhead-search-cloud'),
												formatNumber(active.processed),
												formatNumber(active.total_estimated),
												percent
											)}
									</Text>
								</Stack>

								<Grid auto={{base: 120, md: 160}} gap="var(--wpds-dimension-gap-md)" align="start">
									<Counter label={__('Pushed', 'webhead-search-cloud')} value={active.pushed}/>
									<Counter label={__('Skipped', 'webhead-search-cloud')} value={active.skipped}/>
									<Counter label={__('Deleted', 'webhead-search-cloud')} value={active.deleted}/>
									<Counter label={__('Failed', 'webhead-search-cloud')} value={active.failed_count}/>
								</Grid>

								{active.last_error && (
									// A run that is waiting to send a batch again is still
									// running, and says when it tries: that is a warning.
									// Anything else a run says about itself is an error.
									<Notice.Root intent={active.status === 'running' && active.cursor?.retries > 0 ? 'warning' : 'error'}>
										<Notice.Description>{active.last_error}</Notice.Description>
									</Notice.Root>
								)}

								{active.status === 'paused' && (
									<Notice.Root intent="info">
										<Notice.Description>
											{__('While a sync is paused, changes in your shop are not sent to Search Cloud. The next scheduled sync continues it, if nobody resumes it before.', 'webhead-search-cloud')}
										</Notice.Description>
									</Notice.Root>
								)}

								<Stack direction="row" gap="sm" align="center" wrap="wrap">
									{active.status === 'running' && (
										<Button __next40pxDefaultSize variant="secondary" isBusy={busy} disabled={busy || !CAN_RUN_SYNC} onClick={() => post('/pause', {}, null)}>
											{__('Pause', 'webhead-search-cloud')}
										</Button>
									)}
									{active.status === 'paused' && (
										<Button __next40pxDefaultSize variant="primary" isBusy={busy} disabled={busy || !CAN_RUN_SYNC} onClick={() => post('/resume', {}, null)}>
											{__('Resume', 'webhead-search-cloud')}
										</Button>
									)}
									<Button __next40pxDefaultSize variant="tertiary" isDestructive isBusy={busy} disabled={busy || !CAN_RUN_SYNC}
									        onClick={() => setConfirmAction({type: 'cancel'})}>
										{__('Cancel', 'webhead-search-cloud')}
									</Button>
								</Stack>
							</Stack>
						</Card.Content>
					</Card.Root>
				) : (
					<Stack direction="row" gap="sm" align="center" wrap="wrap" className="whsc-sync-start">
						<Button
							variant="primary"
							__next40pxDefaultSize
							isBusy={busy}
							disabled={busy || !configured || !hasTypes || !CAN_RUN_SYNC}
							onClick={() => setConfirmAction({type: 'start'})}
						>
							{__('Start sync', 'webhead-search-cloud')}
						</Button>
						<Button
							variant="secondary"
							__next40pxDefaultSize
							isBusy={busy}
							disabled={busy || !configured || !hasTypes || !CAN_RUN_SYNC}
							onClick={() => setConfirmAction({type: 'force'})}
						>
							{__('Re-sync everything', 'webhead-search-cloud')}
						</Button>
					</Stack>
				)}

				<SyncHistory
					apiBase={SYNC_BASE}
					refreshSignal={historyKey}
					onChanged={() => setHistoryKey((value) => value + 1)}
				/>
			</Stack>
			{/* The dialog draws no title of its own, so the body asks the question. */}
			<ConfirmDialog
				isOpen={!!confirmAction}
				onConfirm={runConfirmedAction}
				onCancel={() => setConfirmAction(null)}
				confirmButtonText={confirmAction ? CONFIRM_COPY[confirmAction.type].confirmLabel : undefined}
				cancelButtonText={__('Not now', 'webhead-search-cloud')}
			>
				{confirmAction && (
					<Stack direction="column" gap="sm">
						<Text variant="heading-md">{CONFIRM_COPY[confirmAction.type].title}</Text>
						<Text>{CONFIRM_COPY[confirmAction.type].body}</Text>
					</Stack>
				)}
			</ConfirmDialog>
		</>
	);
};

export default SyncTab;
