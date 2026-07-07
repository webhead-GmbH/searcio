import {useContext, useEffect, useState} from '@wordpress/element';
import {__experimentalConfirmDialog as ConfirmDialog, Button,} from '@wordpress/components';
import {Card, Tabs, Text} from '@wordpress/ui';
import {__} from '@wordpress/i18n';
import {addQueryArgs} from '@wordpress/url';
import {settings as SettingsIcon} from '@wordpress/icons';
import {motion} from 'motion/react';

import {showToast} from '../../../toast';
import {Flex} from '../../../components/Layout';
import {animateText, fadeInUpProps, renderAnimatedTabTitle} from '../../../utils/animation';
import SettingsContext from '../../../settings/store/context';
import SettingsSkeleton from './SettingsSkeleton';
import SettingsGroupTab from './tabs/SettingsGroupTab';
import CacheClearCard from './tabs/CacheClearCard';
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
];
const POPULAR_SEARCHES_KEYS = pluginData.popularSearchesKeys || [
	'popular_searches',
];

const getInitialTabName = () => {
	const params = new URL(window.location.href).searchParams;

	return params.get('tab') || SYNC_TAB;
};

const SettingsPanel = () => {
	const {
		isLoading,
		isSaving,
		hasUnsavedChanges,
		settingGroups,
		settings,
		saveSettings,
		updateSetting,
	} = useContext(SettingsContext);
	const [activeTab, setActiveTab] = useState(getInitialTabName);
	const [isSaveFailureDialogOpen, setIsSaveFailureDialogOpen] = useState(false);

	// All settings tabs require manage-settings; a view/run-sync-only user
	// (e.g. a shop manager granted only "run sync") only sees the Sync tab.
	const canManageSettings = pluginData?.caps?.manageSettings !== false;

	// Connection and Popular searches render in their own tabs; exclude them
	// from the schema-driven groups so they aren't shown twice.
	const excludedKeys = [...CONNECTION_KEYS, ...POPULAR_SEARCHES_KEYS];
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
			title: renderAnimatedTabTitle(__('Sync', 'webhead-search-cloud'), '', 0.08),
		},
		...(canManageSettings ? [
			{
				name: INDEXING_TAB,
				title: renderAnimatedTabTitle(__('Indexing', 'webhead-search-cloud'), '', 0.04),
			},
			{
				name: SEARCH_CONFIG_TAB,
				title: renderAnimatedTabTitle(__('Search Config', 'webhead-search-cloud'), '', 0.16),
			},
			{
				name: CONNECTION_TAB,
				title: renderAnimatedTabTitle(__('Connection', 'webhead-search-cloud')),
			},
		] : []),
		...otherGroups.map((group, index) => ({
			name: group.name,
			title: renderAnimatedTabTitle(group.title, '', (index + 3) * 0.04),
		})),
	];

	useEffect(() => {
		if (tabs.some((tab) => tab.name === activeTab)) {
			return;
		}

		setActiveTab(SYNC_TAB);
	}, [activeTab, tabs]);

	useEffect(() => {
		const newUrl = addQueryArgs(window.location.href, {tab: activeTab});

		window.history.replaceState({}, '', newUrl);
	}, [activeTab]);

	const handleSave = async () => {
		const success = await saveSettings();

		if (!success) {
			setIsSaveFailureDialogOpen(true);

			return;
		}

		showToast(__('Settings saved successfully.', 'webhead-search-cloud'), 'success');
	};

	const isSaveDisabled = isSaving || isLoading || !hasUnsavedChanges;
	const saveButtonLabel = isSaving
		? __('Saving...', 'webhead-search-cloud')
		: __('Save Settings', 'webhead-search-cloud');
	const saveButtonDescription = !isLoading && !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'webhead-search-cloud')
		: undefined;

	return (
		<div className="panel-container settings">
			<Card.Root className="whsc-settings-panel-card">
				<Card.Header className="header whsc-settings-panel-header">
					<Flex
						className="whsc-settings-panel-header-layout"
						direction={{base: 'column', md: 'row'}}
						align={{base: 'stretch', md: 'center'}}
						justify="space-between"
						gap={{base: 12, md: 16}}
						expanded
					>
						<Flex.Block>
							<div className="header-with-icon">
								<motion.span {...fadeInUpProps(0, -20)} className="header-icon">{SettingsIcon}</motion.span>
								<Card.Title render={<h2/>}>
									<Text render={<span/>} variant="heading-xl">
										{animateText(__('webhead Search Cloud', 'webhead-search-cloud'))}
									</Text>
								</Card.Title>
								<Text render={<p/>} variant="body-md" className="header-description">
									{animateText(
										pluginData?.plugin?.description || __('Configure the plugin settings from one shared admin surface.', 'webhead-search-cloud'),
										0.4
									)}
								</Text>
							</div>
						</Flex.Block>
					</Flex>
				</Card.Header>
				<Card.Content className="whsc-settings-tabs-content">
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
							<motion.div {...fadeInUpProps(0.04)}>
								<SyncTab/>
							</motion.div>
						</Tabs.Panel>

						{canManageSettings && (
							<Tabs.Panel value={INDEXING_TAB} className="tab-content">
								<motion.div {...fadeInUpProps(0.04)}>
									<IndexingTab/>
								</motion.div>
							</Tabs.Panel>
						)}

						{canManageSettings && (
							<Tabs.Panel value={SEARCH_CONFIG_TAB} className="tab-content">
								<motion.div {...fadeInUpProps(0.04)}>
									{isLoading ? <SettingsSkeleton/> : <SearchConfigTab/>}
								</motion.div>
							</Tabs.Panel>
						)}

						{canManageSettings && (
							<Tabs.Panel value={CONNECTION_TAB} className="tab-content">
								<motion.div {...fadeInUpProps(0.04)}>
									{isLoading ? <SettingsSkeleton/> : <ConnectionTab/>}
								</motion.div>
							</Tabs.Panel>
						)}

						{otherGroups.map((group) => {
							const fields = group.fields || [];

							return (
								<Tabs.Panel key={group.name} value={group.name} className="tab-content">
									<motion.div {...fadeInUpProps(0.04)}>
										{isLoading ? (
											<SettingsSkeleton/>
										) : (
											<SettingsGroupTab
												fields={fields}
												settings={settings}
												updateSetting={updateSetting}
											>
												{'general' === group.name && <CacheClearCard/>}
											</SettingsGroupTab>
										)}
									</motion.div>
								</Tabs.Panel>
							);
						})}
					</Tabs.Root>
				</Card.Content>
				{!SELF_MANAGED_TABS.includes(activeTab) && (
					<Card.Content className="whsc-settings-actions">
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
					</Card.Content>
				)}
			</Card.Root>
			<ConfirmDialog
				isOpen={isSaveFailureDialogOpen}
				onConfirm={() => setIsSaveFailureDialogOpen(false)}
				onCancel={() => setIsSaveFailureDialogOpen(false)}
				confirmButtonText={__('OK', 'webhead-search-cloud')}
			>
				{__('The settings could not be saved. Review the fields and try again.', 'webhead-search-cloud')}
			</ConfirmDialog>
		</div>
	);
};

export default SettingsPanel;
