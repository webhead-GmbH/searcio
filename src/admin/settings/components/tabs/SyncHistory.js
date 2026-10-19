import {useEffect, useMemo, useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {Badge, Icon, Stack, Text} from '@wordpress/ui';
import {__, _n, sprintf} from '@wordpress/i18n';
import {calendar, tag, trash} from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';
import {dateI18n, getSettings} from '@wordpress/date';

import {DataViews} from '../../../../components/DataViews';
import Modal from '../../../../components/Modal';
import {showToast} from '../../../../toast';
import {statusIntent, statusLabels} from '../../syncStatus';
import {formatNumber} from '../../../../utils/number';

const pluginData = window.webhead_search_cloudData || {};
const CAN_RUN_SYNC = pluginData?.caps?.runSync !== false;

// Scoped to this plugin + screen + table so Appearance, layout, visible
// fields, density, per-page, sort, filters, and search survive reloads.
const VIEW_STORAGE_KEY = 'webhead-search-cloud:settings:sync-history:view';

const loadStoredView = () => {
	try {
		const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
		const parsed = stored ? JSON.parse(stored) : null;

		return parsed && 'object' === typeof parsed ? parsed : null;
	} catch (error) {
		return null;
	}
};

const storeView = (view) => {
	try {
		window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
	} catch (error) {
		// Storage unavailable (private browsing / quota) - persistence is a
		// nice-to-have, not a requirement.
	}
};

const ACTIVE = ['queued', 'running', 'paused'];

const TRIGGER_ELEMENTS = [
	{value: 'manual', label: __('Manual', 'searcio')},
	{value: 'scheduled', label: __('Scheduled', 'searcio')},
	{value: 'incremental', label: __('Incremental', 'searcio')},
];

// DataViews sort fields → sync_runs columns the REST endpoint accepts.
const ORDER_COLUMN = {
	id: 'id',
	status: 'status',
	trigger: 'trigger_type',
	processed: 'processed',
	pushed: 'pushed',
	created_at: 'created_at',
};

// Every column but the first, which is the title and takes what these leave.
// A width is not a preference: it is read from here on every load and never
// from the stored view, or a later change would not reach a browser that had
// opened the table before.
const COLUMN_STYLES = {
	status: {width: '16%', minWidth: 120},
	trigger: {width: '14%', minWidth: 110},
	processed: {width: '12%', minWidth: 100},
	pushed: {width: '12%', minWidth: 90},
	deleted: {width: '12%', minWidth: 90},
	created_at: {width: '22%', minWidth: 170},
};

const withColumnStyles = (view) => ({
	...view,
	layout: {...(view.layout || {}), styles: COLUMN_STYLES},
});

// A date as the rest of wp-admin writes one: in the site's format and time
// zone, with the month in the language of the screen. A bare
// `toLocaleString()` writes it in the browser's language and calendar.
const formatDate = (iso) => {
	if (!iso) {
		return '-';
	}

	const date = new Date(iso);

	return Number.isNaN(date.getTime()) ? '-' : dateI18n(getSettings().formats.datetime, date);
};

const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 20,
	sort: {field: 'id', direction: 'desc'},
	search: '',
	filters: [],
	titleField: 'id',
	showMedia: false,
	fields: ['status', 'trigger', 'processed', 'pushed', 'deleted', 'created_at'],
	layout: {},
};

const renderFieldHeaderWithIcon = (label, icon) => (
	<span className="whsc-dataviews-field-header-with-icon">
		<Icon icon={icon} size={16}/>
		<span>{label}</span>
	</span>
);

/**
 * Sync history table built on DataViews with server-driven filtering, sorting
 * and pagination. The active run is protected from deletion both here
 * (eligibility) and server-side.
 */
const SyncHistory = ({apiBase, refreshSignal, onChanged}) => {
	const [view, setView] = useState(() => withColumnStyles({
		...DEFAULT_VIEW,
		...(loadStoredView() || {}),
		// Always start on page 1 - resuming on a stale/out-of-range page from
		// a previous session would just show an empty table.
		page: 1,
	}));
	const [items, setItems] = useState([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [reload, setReload] = useState(0);
	const [isClearOpen, setIsClearOpen] = useState(false);

	const updateView = (nextView) => {
		const styled = withColumnStyles(nextView);

		setView(styled);
		storeView(styled);
	};

	useEffect(() => {
		let cancelled = false;

		const filterValue = (field) =>
			view.filters.find((filter) => filter.field === field)?.value || '';

		const load = async () => {
			setIsLoading(true);

			const query = new URLSearchParams({
				page: String(view.page),
				per_page: String(view.perPage),
				order_by: ORDER_COLUMN[view.sort?.field] || 'id',
				order: view.sort?.direction === 'asc' ? 'asc' : 'desc',
			});

			if (filterValue('status')) {
				query.set('status', filterValue('status'));
			}

			if (filterValue('trigger')) {
				query.set('trigger', filterValue('trigger'));
			}

			try {
				const response = await apiFetch({path: `${apiBase}/history?${query.toString()}`});

				if (cancelled) {
					return;
				}

				setItems(Array.isArray(response.items) ? response.items : []);
				setTotal(Number(response.total) || 0);
			} catch (error) {
				if (!cancelled) {
					setItems([]);
					setTotal(0);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [apiBase, view, reload, refreshSignal]);

	const fields = useMemo(
		() => {
			const labels = statusLabels();
			const statusElements = ['completed', 'failed', 'cancelled', 'running', 'paused', 'queued']
				.map((value) => ({value, label: labels[value]}));

			return [
				{
					id: 'id',
					label: __('Run', 'searcio'),
					enableSorting: true,
					enableHiding: false,
					filterBy: false,
					render: ({item}) => `#${item.id}`,
				},
				{
					id: 'status',
					label: __('Status', 'searcio'),
					header: renderFieldHeaderWithIcon(__('Status', 'searcio'), tag),
					enableSorting: true,
					elements: statusElements,
					filterBy: {operators: ['is']},
					render: ({item}) => (
						<Badge intent={statusIntent(item.status)}>
							{labels[item.status] || String(item.status)}
						</Badge>
					),
				},
				{
					id: 'trigger',
					label: __('Trigger', 'searcio'),
					enableSorting: true,
					elements: TRIGGER_ELEMENTS,
					filterBy: {operators: ['is']},
					getValue: ({item}) => item.trigger,
					render: ({item}) =>
						TRIGGER_ELEMENTS.find((element) => element.value === item.trigger)?.label || item.trigger,
				},
				{
					id: 'processed',
					label: __('Processed', 'searcio'),
					enableSorting: true,
					filterBy: false,
					render: ({item}) => formatNumber(item.processed),
				},
				{
					id: 'pushed',
					label: __('Pushed', 'searcio'),
					enableSorting: true,
					filterBy: false,
					render: ({item}) => formatNumber(item.pushed),
				},
				{
					id: 'deleted',
					label: __('Deleted', 'searcio'),
					filterBy: false,
					render: ({item}) => formatNumber(item.deleted),
				},
				{
					id: 'created_at',
					label: __('Started', 'searcio'),
					header: renderFieldHeaderWithIcon(__('Started', 'searcio'), calendar),
					enableSorting: true,
					filterBy: false,
					render: ({item}) => formatDate(item.created_at),
				},
			];
		},
		[]
	);

	const actions = useMemo(
		() => [
			{
				id: 'delete',
				label: __('Delete', 'searcio'),
				icon: trash,
				isDestructive: true,
				supportsBulk: true,
				isEligible: (item) => CAN_RUN_SYNC && !ACTIVE.includes(item.status),
				modalHeader: (selected) => _n('Delete this run?', 'Delete these runs?', selected.length, 'searcio'),
				modalSize: 'small',
				// A deleted run cannot be brought back, so the table asks first
				// and the button says what it does.
				RenderModal: ({items: selected, closeModal}) => (
					<Stack direction="column" gap="lg">
						<Text>
							{sprintf(
								/* translators: %d: number of sync runs. */
								_n(
									'%d run is removed from the history for good. What it sent to Searcio stays where it is.',
									'%d runs are removed from the history for good. What they sent to Searcio stays where it is.',
									selected.length,
									'searcio'
								),
								selected.length
							)}
						</Text>
						<Stack direction="row" gap="sm" justify="flex-end">
							<Button __next40pxDefaultSize variant="tertiary" onClick={closeModal}>
								{__('Cancel', 'searcio')}
							</Button>
							<Button
								__next40pxDefaultSize
								variant="primary"
								isDestructive
								onClick={async () => {
									closeModal();

									await Promise.all(
										selected.map((item) =>
											apiFetch({path: `${apiBase}/history/${item.id}`, method: 'DELETE'}).catch(() => null)
										)
									);

									setReload((value) => value + 1);
									onChanged?.();
								}}
							>
								{__('Delete permanently', 'searcio')}
							</Button>
						</Stack>
					</Stack>
				),
			},
		],
		[apiBase, onChanged]
	);

	const clearFinished = async () => {
		try {
			await apiFetch({path: `${apiBase}/history`, method: 'DELETE'});
			showToast(__('Finished runs cleared.', 'searcio'), 'success');
			setReload((value) => value + 1);
			onChanged?.();
		} catch (error) {
			showToast(
				error?.message || __('Could not clear the history.', 'searcio'),
				'error'
			);
		}
	};

	return (
		<Stack direction="column" gap="md" className="whsc-sync-history">
			<Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap">
				<Text render={<h3/>} variant="heading-md" className="whsc-sync-history__title">
					{__('Sync history', 'searcio')}
				</Text>
				<Button
					__next40pxDefaultSize
					variant="tertiary"
					isDestructive
					onClick={() => setIsClearOpen(true)}
					disabled={total === 0 || !CAN_RUN_SYNC}
				>
					{__('Clear finished', 'searcio')}
				</Button>
			</Stack>

			{/* The dataset has no media; the class keeps an empty media box out of
			    every layout that would draw one. */}
			<div className="webhead-search-cloud-dataviews--no-media">
				<DataViews
					data={items}
					fields={fields}
					view={view}
					onChangeView={updateView}
					actions={actions}
					isLoading={isLoading}
					paginationInfo={{
						totalItems: total,
						totalPages: Math.max(1, Math.ceil(total / view.perPage)),
					}}
					defaultLayouts={{
						table: {showMedia: false, layout: {styles: COLUMN_STYLES}},
						activity: {showMedia: false},
					}}
					getItemId={(item) => String(item.id)}
				/>
			</div>

			{/* Clearing cannot be undone, so it is asked about in a dialog that
			    only its own buttons close. */}
			<Modal
				isOpen={isClearOpen}
				onClose={() => setIsClearOpen(false)}
				title={__('Clear the finished runs?', 'searcio')}
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
						label: __('Clear permanently', 'searcio'),
						variant: 'primary',
						isDestructive: true,
						onClick: clearFinished,
					},
				]}
			>
				<Text>
					{__(
						'Every completed, failed and cancelled run is removed from the history for good. A run in progress is kept, and nothing in Searcio changes.',
						'searcio'
					)}
				</Text>
			</Modal>
		</Stack>
	);
};

export default SyncHistory;
