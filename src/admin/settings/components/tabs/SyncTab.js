import {useCallback, useEffect, useRef, useState} from '@wordpress/element';
import {__experimentalConfirmDialog as ConfirmDialog, Button, Notice,} from '@wordpress/components';
import {Card, Text} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import {showToast} from '../../../../toast';
import SyncSkeleton from './SyncSkeleton';
import SyncHistory from './SyncHistory';
import {Flex} from "../../../../components/Layout";

const pluginData = window.webhead_search_cloudData || {};
const SYNC_BASE = pluginData?.api?.syncBase || '/webhead-search-cloud/v1/sync';
const CAN_RUN_SYNC = pluginData?.caps?.runSync !== false;

const STATUS_LABELS = {
	queued: __('Queued', 'webhead-search-cloud'),
	running: __('Running', 'webhead-search-cloud'),
	paused: __('Paused', 'webhead-search-cloud'),
	completed: __('Completed', 'webhead-search-cloud'),
	failed: __('Failed', 'webhead-search-cloud'),
	cancelled: __('Cancelled', 'webhead-search-cloud'),
};

const tabUrl = (tab) => {
	const url = new URL(window.location.href);
	url.searchParams.set('tab', tab);

	return url.toString();
};

const Counter = ({label, value}) => (
	<div className="whsc-counter">
		<span className="whsc-counter-value">{Number(value || 0).toLocaleString()}</span>
		<span className="whsc-counter-label">{label}</span>
	</div>
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
	// the dialog below — `confirmAction` holds which one is pending.
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
		return (
			<Card.Root className="whsc-tab-card">
				<Card.Content className="whsc-tab-card-content">
					<SyncSkeleton/>
				</Card.Content>
			</Card.Root>
		);
	}

	const active = status.active;
	const configured = Boolean(status.configured);
	const hasTypes = Array.isArray(status.indexable) && status.indexable.length > 0;
	const percent =
		active && active.total_estimated > 0
			? Math.min(100, Math.round((active.processed / active.total_estimated) * 100))
			: null;

	return (
		<Card.Root className="whsc-tab-card">
			<Card.Header className="whsc-tab-card-header">
				<Card.Title render={<h3/>}>
					{__('Sync', 'webhead-search-cloud')}
				</Card.Title>
				<Text render={<p/>} variant="body-sm">
					{__(
						'Send your content to Search Cloud. Only new and changed items are sent on each run, so repeat syncs are fast.',
						'webhead-search-cloud'
					)}
				</Text>
			</Card.Header>
			<Card.Content className="whsc-tab-card-content webhead-search-cloud-sync">
				{!configured && (
					<Notice status="warning" isDismissible={false}>
						<p>
							{__('Add and save your Search Cloud credentials first.', 'webhead-search-cloud')}{' '}
							<a href={tabUrl('connection')}>{__('Go to Connection', 'webhead-search-cloud')}</a>
						</p>
					</Notice>
				)}

				{configured && !hasTypes && (
					<Notice status="info" isDismissible={false}>
						<p>
							{__('No content types are enabled for indexing yet.', 'webhead-search-cloud')}{' '}
							<a href={tabUrl('indexing')}>{__('Go to Indexing', 'webhead-search-cloud')}</a>
						</p>
					</Notice>
				)}

				{active ? (
					<Card.Root className="whsc-card whsc-card--dotted">
						<Card.Header className="whsc-sync-card-head">
						<span className={`whsc-status-badge is-${active.status}`}>
							{STATUS_LABELS[active.status] || active.status}
						</span>
							{active.force && (
								<span className="whsc-sync-tag">{__('Full re-sync', 'webhead-search-cloud')}</span>
							)}
						</Card.Header>
						<Card.Content>
							<div className="whsc-progress" role="progressbar" aria-valuenow={percent ?? undefined} aria-valuemin={0}
							     aria-valuemax={100}>
								<div
									className={`whsc-progress-bar${percent === null && active.status === 'running' ? ' is-indeterminate' : ''}`}
									style={percent === null ? undefined : {width: `${percent}%`}}
								/>
							</div>

							<p className="whsc-progress-label">
								{percent === null
									? sprintf(
										/* translators: %d: processed item count. */
										__('%d items processed…', 'webhead-search-cloud'),
										active.processed
									)
									: sprintf(
										/* translators: 1: processed, 2: estimated total, 3: percentage. */
										__('%1$s of ~%2$s processed (%3$d%%)', 'webhead-search-cloud'),
										Number(active.processed).toLocaleString(),
										Number(active.total_estimated).toLocaleString(),
										percent
									)}
							</p>

							<div className="whsc-counters">
								<Counter label={__('Pushed', 'webhead-search-cloud')} value={active.pushed}/>
								<Counter label={__('Skipped', 'webhead-search-cloud')} value={active.skipped}/>
								<Counter label={__('Deleted', 'webhead-search-cloud')} value={active.deleted}/>
								<Counter label={__('Failed', 'webhead-search-cloud')} value={active.failed_count}/>
							</div>

							{active.last_error && (
								<Notice status="error" isDismissible={false} className="whsc-progress-error">
									<p>{active.last_error}</p>
								</Notice>
							)}

							<Flex gap="10px" align="center">
								{active.status === 'running' && (
									<Button variant="secondary" isBusy={busy} disabled={busy || !CAN_RUN_SYNC} onClick={() => post('/pause', {}, null)}>
										{__('Pause', 'webhead-search-cloud')}
									</Button>
								)}
								{active.status === 'paused' && (
									<Button variant="primary" isBusy={busy} disabled={busy || !CAN_RUN_SYNC} onClick={() => post('/resume', {}, null)}>
										{__('Resume', 'webhead-search-cloud')}
									</Button>
								)}
								<Button variant="tertiary" isDestructive isBusy={busy} disabled={busy || !CAN_RUN_SYNC}
								        onClick={() => setConfirmAction({type: 'cancel'})}>
									{__('Cancel', 'webhead-search-cloud')}
								</Button>
							</Flex>
						</Card.Content>
					</Card.Root>
				) : (
					<Flex gap="10px" align="center" className="whsc-sync-start">
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
					</Flex>
				)}

				<SyncHistory
					apiBase={SYNC_BASE}
					refreshSignal={historyKey}
					onChanged={() => setHistoryKey((value) => value + 1)}
				/>
			</Card.Content>
			<ConfirmDialog
				isOpen={!!confirmAction}
				onConfirm={runConfirmedAction}
				onCancel={() => setConfirmAction(null)}
				confirmButtonText={confirmAction ? CONFIRM_COPY[confirmAction.type].confirmLabel : undefined}
				cancelButtonText={__('Not now', 'webhead-search-cloud')}
			>
				{confirmAction && (
					<>
						<p><strong>{CONFIRM_COPY[confirmAction.type].title}</strong></p>
						<p>{CONFIRM_COPY[confirmAction.type].body}</p>
					</>
				)}
			</ConfirmDialog>
		</Card.Root>
	);
};

export default SyncTab;
