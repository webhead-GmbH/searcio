import {useContext, useEffect, useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {Notice, Skeleton, Stack, Tabs} from '@wordpress/ui';
import {__, sprintf} from '@wordpress/i18n';
import {addQueryArgs} from '@wordpress/url';
import {motion} from 'motion/react';

import AdminPage from '../../../components/AdminPage';
import {showToast} from '../../../toast';
import {renderAnimatedTabTitle, useFadeInUpProps} from '../../../utils/animation';
import SettingsContext from '../../../settings/store/context';
import {useUpgradeAction} from '../upgradeAction';
import searcioIcon from '../searcioIcon';
import SettingsSkeleton from './SettingsSkeleton';
import SettingsGroupTab from './tabs/SettingsGroupTab';
import CacheClearCard from './tabs/CacheClearCard';
import SupportSearcioCard from './tabs/SupportSearcioCard';
import ConnectionTab from './tabs/ConnectionTab';
import IndexingTab from './tabs/IndexingTab';
import SyncTab from './tabs/SyncTab';
import SearchConfigTab from './tabs/SearchConfigTab';

const pluginData = window.webhead_search_cloudData || {};

const SYNC_TAB = 'sync';
const INDEXING_TAB = 'indexing';
const SEARCH_CONFIG_TAB = 'search-config';
const CONNECTION_TAB = 'connection';
const SELF_MANAGED_TABS = [SYNC_TAB, INDEXING_TAB, SEARCH_CONFIG_TAB, CONNECTION_TAB];
const CONNECTION_KEYS = pluginData.connectionKeys || [
	'search_key',
	'write_key',
	'write_secret',
	'connect_pending_claim',
	'connect_pending_email',
];
const POPULAR_SEARCHES_KEYS = pluginData.popularSearchesKeys || [
	'popular_searches',
];
// Drawn by its own card on the General tab, which knows the plan.
const SUPPORT_SEARCIO_KEYS = ['support_searcio'];

// Defaults to the Connection tab whenever the site isn't connected yet, so a
// fresh install lands on "Connect" instead of an empty Sync tab.
const getInitialTabName = () => {
	const params = new URL(window.location.href).searchParams;
	const requestedTab = params.get('tab');

	if (requestedTab) {
		return requestedTab;
	}

	return pluginData?.connection?.isConnected === false ? CONNECTION_TAB : SYNC_TAB;
};

const SettingsPanel = () => {
	const {
		isLoading,
		isSaving,
		hasUnsavedChanges,
		loadError,
		saveError,
		clearSaveError,
		settingGroups,
		settings,
		retryLoad,
		saveSettings,
		updateSetting,
	} = useContext(SettingsContext);
	const [activeTab, setActiveTab] = useState(getInitialTabName);
	// A hook, so it can ask for the reduced-motion preference: called once here
	// rather than inline, since one of the panels renders inside a map.
	const panelMotion = useFadeInUpProps(0.04);
	const upgradeAction = useUpgradeAction();

	// All settings tabs require manage-settings; a view/run-sync-only user
	// (e.g. a shop manager granted only "run sync") only sees the Sync tab.
	const canManageSettings = pluginData?.caps?.manageSettings !== false;

	// Connection and Popular searches render in their own tabs, and Support
	// Searcio in its own card; exclude them from the schema-driven groups so
	// they aren't shown twice.
	const excludedKeys = [...CONNECTION_KEYS, ...POPULAR_SEARCHES_KEYS, ...SUPPORT_SEARCIO_KEYS];
	const otherGroups = canManageSettings
		? settingGroups
			.map((group) => ({
				...group,
				fields: group.fields.filter((field) => !excludedKeys.includes(field.key)),
			}))
			.filter((group) => group.fields.length > 0)
		: [];

	const tabs = [
		{
			name: SYNC_TAB,
			title: renderAnimatedTabTitle(__('Sync', 'searcio'), '', 0.08),
		},
		...(canManageSettings ? [
			{
				name: INDEXING_TAB,
				title: renderAnimatedTabTitle(__('Indexing', 'searcio'), '', 0.04),
			},
			{
				name: SEARCH_CONFIG_TAB,
				title: renderAnimatedTabTitle(__('Search Config', 'searcio'), '', 0.16),
			},
			{
				name: CONNECTION_TAB,
				title: renderAnimatedTabTitle(__('Connection', 'searcio')),
			},
		] : []),
		...otherGroups.map((group, index) => ({
			name: group.name,
			title: renderAnimatedTabTitle(group.title, '', (index + 3) * 0.04),
		})),
	];

	// A tab built from the settings schema (General, and any group after it)
	// does not exist until that schema has loaded, so nothing is decided about
	// the requested tab before then: falling back early sent every link to one
	// of them - and every reload while on one - to Sync.
	const isKnownTab = tabs.some((tab) => tab.name === activeTab);

	useEffect(() => {
		if (isLoading || loadError || isKnownTab) {
			return;
		}

		setActiveTab(SYNC_TAB);
	}, [activeTab, isKnownTab, isLoading, loadError]);

	useEffect(() => {
		// Only a tab that exists is written into the URL: until the schema has
		// loaded, `activeTab` is whatever the URL said or a guess.
		if (isLoading || !isKnownTab) {
			return;
		}

		const newUrl = addQueryArgs(window.location.href, {tab: activeTab});

		window.history.replaceState({}, '', newUrl);
	}, [activeTab, isKnownTab, isLoading]);

	// The reason a save failed belongs to the tab it failed on. Two other tabs
	// save through the same store and report in their own place.
	useEffect(() => {
		clearSaveError();
	}, [activeTab, clearSaveError]);

	const handleSave = async () => {
		const success = await saveSettings();

		// A failure is reported by the error Notice beside the button, from
		// `saveError`; a toast here would stack a second message over it.
		if (!success) {
			return;
		}

		showToast(__('Settings saved successfully.', 'searcio'), 'success');
	};

	const isSaveDisabled = isSaving || isLoading || !hasUnsavedChanges;
	const saveButtonLabel = isSaving
		? __('Saving...', 'searcio')
		: __('Save Settings', 'searcio');
	const saveButtonDescription = !isLoading && !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'searcio')
		: undefined;
	const hasSaveButton = !isLoading && !loadError && isKnownTab && !SELF_MANAGED_TABS.includes(activeTab);

	return (
		// The same shell as every other screen of the plugin. It draws the header,
		// the surface and the page padding, so this component owns only what is
		// particular to settings: the tabs and the save action.
		<AdminPage
			className="settings"
			title={__('Searcio', 'searcio')}
			description={pluginData?.plugin?.description || __('Configure the plugin settings from one shared admin surface.', 'searcio')}
			icon={searcioIcon}
			actions={upgradeAction ? [upgradeAction] : undefined}
			// The tab strip sits directly under the header. A load that failed has
			// no strip, and its error notice wants the padding back.
			tabbed={!loadError}
		>
			{isLoading ? (
				// The strip cannot be complete before the schema names its
				// sections, so it is a skeleton until then rather than a set of
				// tabs that grows after the page has settled.
				<div className="settings-tabs settings-tabs--loading">
					<div className="settings-tabs__list webhead-search-cloud-admin-page__tab-strip" aria-hidden="true">
						<Skeleton className="settings-tabs__tab-placeholder"/>
						<Skeleton className="settings-tabs__tab-placeholder"/>
						<Skeleton className="settings-tabs__tab-placeholder"/>
						<Skeleton className="settings-tabs__tab-placeholder"/>
					</div>
					<div className="tab-content">
						<SettingsSkeleton/>
					</div>
				</div>
			) : loadError ? (
				// A load that failed leaves no groups. Say what happened, why,
				// and leave one thing to try.
				<Notice.Root intent="error">
					<Notice.Description>
						{sprintf(
							/* translators: %s: reason the settings request failed. */
							__('The settings could not be loaded: %s', 'searcio'),
							loadError
						)}
					</Notice.Description>
					<Notice.Actions>
						<Notice.ActionButton onClick={retryLoad}>
							{__('Try again', 'searcio')}
						</Notice.ActionButton>
					</Notice.Actions>
				</Notice.Root>
			) : (
				// No key here. Tabs.Root is controlled through `value`; keying it
				// on the active tab remounts the whole tree on every switch,
				// which replays every entrance animation and reads as a flicker.
				<Tabs.Root
					className="settings-tabs"
					value={activeTab}
					onValueChange={setActiveTab}
				>
					<Tabs.List className="settings-tabs__list">
						{tabs.map((tab) => (
							<Tabs.Tab
								key={tab.name}
								value={tab.name}
								className={`settings-tabs__tab tab-${tab.name}`}
							>
								{tab.title}
							</Tabs.Tab>
						))}
					</Tabs.List>

					<Tabs.Panel value={SYNC_TAB} className="tab-content">
						<motion.div {...panelMotion}>
							<SyncTab/>
						</motion.div>
					</Tabs.Panel>

					{canManageSettings && (
						<Tabs.Panel value={INDEXING_TAB} className="tab-content">
							<motion.div {...panelMotion}>
								<IndexingTab/>
							</motion.div>
						</Tabs.Panel>
					)}

					{canManageSettings && (
						<Tabs.Panel value={SEARCH_CONFIG_TAB} className="tab-content">
							<motion.div {...panelMotion}>
								<SearchConfigTab/>
							</motion.div>
						</Tabs.Panel>
					)}

					{canManageSettings && (
						<Tabs.Panel value={CONNECTION_TAB} className="tab-content">
							<motion.div {...panelMotion}>
								<ConnectionTab/>
							</motion.div>
						</Tabs.Panel>
					)}

					{otherGroups.map((group) => (
						<Tabs.Panel key={group.name} value={group.name} className="tab-content">
							<motion.div {...panelMotion}>
								<SettingsGroupTab
									fields={group.fields || []}
									settings={settings}
									updateSetting={updateSetting}
								>
									{'general' === group.name && (
										<>
											<SupportSearcioCard settings={settings} updateSetting={updateSetting}/>
											<CacheClearCard/>
										</>
									)}
								</SettingsGroupTab>
							</motion.div>
						</Tabs.Panel>
					))}
				</Tabs.Root>
			)}
			{/*
			  * A failed save is one inline error Notice beside the button that
			  * failed, not a dialog: a ConfirmDialog is for confirming an
			  * action, and its Cancel and OK both only closed this one. The
			  * reason is the REST API's own.
			  */}
			{hasSaveButton && (
				<Stack direction="column" gap="md">
					{saveError && (
						<Notice.Root intent="error">
							<Notice.Description>
								{sprintf(
									/* translators: %s: reason the settings could not be saved, as reported by the REST API. */
									__('The settings could not be saved: %s', 'searcio'),
									saveError
								)}
							</Notice.Description>
							<Notice.CloseIcon onClick={clearSaveError}/>
						</Notice.Root>
					)}
					{/* A row of its own, so the column does not stretch the button. */}
					<Stack direction="row" gap="sm">
						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							variant="primary"
							isBusy={isSaving}
							disabled={isSaveDisabled}
							description={saveButtonDescription}
							label={saveButtonLabel}
							onClick={handleSave}
							showTooltip={!!saveButtonDescription}
						>
							{saveButtonLabel}
						</Button>
					</Stack>
				</Stack>
			)}
		</AdminPage>
	);
};

export default SettingsPanel;
