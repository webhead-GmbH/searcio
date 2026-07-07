import {useEffect, useMemo, useState} from '@wordpress/element';
import {Button, Icon} from '@wordpress/components';
import {DataViews} from '@wordpress/dataviews';
import {__} from '@wordpress/i18n';
import {calendar, tag, trash} from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

import {showToast} from '../../../../toast';

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
		// Storage unavailable (private browsing / quota) — persistence is a
		// nice-to-have, not a requirement.
	}
};

const ACTIVE = ['queued', 'running', 'paused'];

const STATUS_ELEMENTS = [
	{value: 'completed', label: __('Completed', 'webhead-search-cloud')},
	{value: 'failed', label: __('Failed', 'webhead-search-cloud')},
	{value: 'cancelled', label: __('Cancelled', 'webhead-search-cloud')},
	{value: 'running', label: __('Running', 'webhead-search-cloud')},
	{value: 'paused', label: __('Paused', 'webhead-search-cloud')},
	{value: 'queued', label: __('Queued', 'webhead-search-cloud')},
];

const TRIGGER_ELEMENTS = [
	{value: 'manual', label: __('Manual', 'webhead-search-cloud')},
	{value: 'scheduled', label: __('Scheduled', 'webhead-search-cloud')},
	{value: 'incremental', label: __('Incremental', 'webhead-search-cloud')},
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

const formatDate = (iso) => {
	if (!iso) {
		return '-';
	}

	const date = new Date(iso);

	return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
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

/**
 * Sync history table built on @wordpress/dataviews with server-driven
 * filtering, sorting and pagination (per the front-end guideline). The active
 * run is protected from deletion both here (eligibility) and server-side.
 */
const SyncHistory = ({apiBase, refreshSignal, onChanged}) => {
	const [view, setView] = useState(() => ({
		...DEFAULT_VIEW,
		...(loadStoredView() || {}),
		// Always start on page 1 — resuming on a stale/out-of-range page from
		// a previous session would just show an empty table.
		page: 1,
	}));
	const [items, setItems] = useState([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [reload, setReload] = useState(0);

	const renderFieldHeaderWithIcon = (label, icon) => (
		<span className="whsc-dataviews-field-header-with-icon">
			<Icon className="whsc-dataviews-field-header-with-icon__icon" icon={icon}/>
			<span>{label}</span>
		</span>
	);

	const updateView = (nextView) => {
		setView(nextView);
		storeView(nextView);
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
		() => [
			{
				id: 'id',
				label: __('Run', 'webhead-search-cloud'),
				enableSorting: true,
				enableHiding: false,
				filterBy: false,
				render: ({item}) => `#${item.id}`,
			},
			{
				id: 'status',
				label: __('Status', 'webhead-search-cloud'),
				header: renderFieldHeaderWithIcon(__('Status', 'webhead-search-cloud'), tag),
				enableSorting: true,
				elements: STATUS_ELEMENTS,
				filterBy: {operators: ['is']},
				render: ({item}) => (
					<span className={`whsc-status-badge is-${item.status}`}>
						{STATUS_ELEMENTS.find((element) => element.value === item.status)?.label || item.status}
					</span>
				),
			},
			{
				id: 'trigger',
				label: __('Trigger', 'webhead-search-cloud'),
				enableSorting: true,
				elements: TRIGGER_ELEMENTS,
				filterBy: {operators: ['is']},
				getValue: ({item}) => item.trigger,
				render: ({item}) =>
					TRIGGER_ELEMENTS.find((element) => element.value === item.trigger)?.label || item.trigger,
			},
			{
				id: 'processed',
				label: __('Processed', 'webhead-search-cloud'),
				enableSorting: true,
				filterBy: false,
				render: ({item}) => Number(item.processed).toLocaleString(),
			},
			{
				id: 'pushed',
				label: __('Pushed', 'webhead-search-cloud'),
				enableSorting: true,
				filterBy: false,
				render: ({item}) => Number(item.pushed).toLocaleString(),
			},
			{
				id: 'deleted',
				label: __('Deleted', 'webhead-search-cloud'),
				filterBy: false,
				render: ({item}) => Number(item.deleted).toLocaleString(),
			},
			{
				id: 'created_at',
				label: __('Started', 'webhead-search-cloud'),
				header: renderFieldHeaderWithIcon(__('Started', 'webhead-search-cloud'), calendar),
				enableSorting: true,
				filterBy: false,
				render: ({item}) => formatDate(item.created_at),
			},
		],
		[]
	);

	const actions = useMemo(
		() => [
			{
				id: 'delete',
				label: __('Delete', 'webhead-search-cloud'),
				icon: trash,
				isDestructive: true,
				supportsBulk: true,
				isEligible: (item) => CAN_RUN_SYNC && !ACTIVE.includes(item.status),
				callback: async (selected) => {
					await Promise.all(
						selected.map((item) =>
							apiFetch({path: `${apiBase}/history/${item.id}`, method: 'DELETE'}).catch(() => null)
						)
					);

					setReload((value) => value + 1);
					onChanged?.();
				},
			},
		],
		[apiBase, onChanged]
	);

	const clearFinished = async () => {
		try {
			await apiFetch({path: `${apiBase}/history`, method: 'DELETE'});
			showToast(__('Finished runs cleared.', 'webhead-search-cloud'), 'success');
			setReload((value) => value + 1);
			onChanged?.();
		} catch (error) {
			showToast(__('Could not clear the history.', 'webhead-search-cloud'), 'error');
		}
	};

	return (
		<div className="whsc-sync-history">
			<div className="whsc-sync-history-head">
				<h4>{__('Sync history', 'webhead-search-cloud')}</h4>
				<Button variant="tertiary" isDestructive onClick={clearFinished} disabled={total === 0 || !CAN_RUN_SYNC}>
					{__('Clear finished', 'webhead-search-cloud')}
				</Button>
			</div>

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
					table: {},
					activity: {showMedia: false},
				}}
				getItemId={(item) => String(item.id)}
			/>
		</div>
	);
};

export default SyncHistory;
