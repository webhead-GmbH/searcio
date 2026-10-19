import {useEffect, useState} from '@wordpress/element';
import {Button, ToggleControl} from '@wordpress/components';
import {CheckboxControl, CollapsibleCard, InputControl, Notice, SelectControl, Stack, Text} from '@wordpress/ui';
import {__, _n, sprintf} from '@wordpress/i18n';
import {trash} from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

import {Grid} from '../../../../components/Layout';
import {showToast} from '../../../../toast';
import TabIntro from '../TabIntro';
import IndexingSkeleton from './IndexingSkeleton';

const pluginData = window.webhead_search_cloudData || {};
const CONFIG_PATH =
	pluginData?.api?.indexingConfigPath || '/webhead-search-cloud/v1/indexing/config';

const NONE = '';

// `SelectControl` shows its placeholder for an empty string. The option that
// stands for "nothing" is the item whose value is null, so the stored empty
// string is handed over as null and taken back as the empty string.
const selected = (value) => ('' === value || undefined === value ? null : value);

const KIND_OPTIONS = [
	{value: 'meta', label: __('Custom field', 'searcio')},
	{value: 'taxonomy', label: __('Taxonomy', 'searcio')},
	{value: 'property', label: __('Built-in field', 'searcio')},
];

const PROPERTY_OPTIONS = [
	{value: 'author', label: __('Author', 'searcio')},
	{value: 'date', label: __('Published date', 'searcio')},
	{value: 'modified', label: __('Modified date', 'searcio')},
	{value: 'excerpt', label: __('Excerpt', 'searcio')},
	{value: 'slug', label: __('Slug', 'searcio')},
];

/** Options for the recognised-field selects: properties + the type's taxonomies. */
const sourceOptions = (sources, taxonomies, allowNone) => {
	const options = sources.map((source) => ({
		value: source.value,
		label: source.label,
	}));

	taxonomies.forEach((taxonomy) => {
		options.push({
			value: `taxonomy:${taxonomy.slug}`,
			label: sprintf(
				/* translators: %s: taxonomy label. */
				__('Taxonomy: %s', 'searcio'),
				taxonomy.label
			),
		});
	});

	if (allowNone) {
		return [{value: null, label: __('- Do not send -', 'searcio')}, ...options];
	}

	return options;
};

const parseSource = (source) => {
	const raw = typeof source === 'string' ? source : '';
	const index = raw.indexOf(':');

	if (index === -1) {
		return {kind: 'meta', value: ''};
	}

	return {kind: raw.slice(0, index) || 'meta', value: raw.slice(index + 1)};
};

// A part of a post type's card: its heading, a sentence, and what it holds.
// Parts are told apart by the space between them, which the card's own column
// supplies.
const Section = ({title, description, children}) => (
	<Stack direction="column" gap="md" className="whsc-section">
		<Stack direction="column" gap="xs">
			<Text render={<h4/>} variant="heading-sm" className="whsc-section-title">
				{title}
			</Text>
			{description && (
				<Text render={<p/>} variant="body-sm" className="whsc-section-description">
					{description}
				</Text>
			)}
		</Stack>
		{children}
	</Stack>
);

const CustomFieldRow = ({field, taxonomies, onChange, onRemove}) => {
	const {kind, value} = parseSource(field.source);

	const setKind = (nextKind) => onChange({...field, source: `${nextKind}:`});
	const setValue = (nextValue) => onChange({...field, source: `${kind}:${nextValue ?? ''}`});

	const renderValue = () => {
		if (kind === 'property') {
			return (
				<SelectControl
					label={__('Value', 'searcio')}
					value={selected(value)}
					items={[
						{value: null, label: __('- Select -', 'searcio')},
						...PROPERTY_OPTIONS,
					]}
					onValueChange={setValue}
				/>
			);
		}

		if (kind === 'taxonomy' && taxonomies.length > 0) {
			return (
				<SelectControl
					label={__('Taxonomy', 'searcio')}
					value={selected(value)}
					items={[
						{value: null, label: __('- Select -', 'searcio')},
						...taxonomies.map((taxonomy) => ({
							value: taxonomy.slug,
							label: taxonomy.label,
						})),
					]}
					onValueChange={setValue}
				/>
			);
		}

		return (
			<InputControl
				label={kind === 'taxonomy'
					? __('Taxonomy slug', 'searcio')
					: __('Meta key', 'searcio')}
				placeholder={kind === 'taxonomy' ? 'product_brand' : '_my_field'}
				value={value}
				onValueChange={setValue}
			/>
		);
	};

	return (
		<div className="whsc-custom-field-row">
			<InputControl
				label={__('Send as', 'searcio')}
				placeholder="brand"
				value={field.as}
				onValueChange={(next) => onChange({...field, as: next})}
			/>
			<SelectControl
				label={__('From', 'searcio')}
				value={kind}
				items={KIND_OPTIONS}
				onValueChange={setKind}
			/>
			{renderValue()}
			<Button
				__next40pxDefaultSize
				icon={trash}
				isDestructive
				variant="tertiary"
				label={__('Remove field', 'searcio')}
				onClick={onRemove}
			/>
		</div>
	);
};

const WooSection = ({woo, block, onChange}) => {
	if (!woo.active) {
		return (
			<Notice.Root intent="info">
				<Notice.Description>
					{__('Activate WooCommerce to index product data.', 'searcio')}
				</Notice.Description>
			</Notice.Root>
		);
	}

	if (!woo.meets_minimum) {
		return (
			<Notice.Root intent="warning">
				<Notice.Description>
					{sprintf(
						/* translators: 1: current version, 2: minimum version. */
						__(
							'WooCommerce %1$s is below the supported minimum %2$s. Product fields are disabled until WooCommerce is updated.',
							'searcio'
						),
						woo.version || __('(unknown)', 'searcio'),
						woo.minimum
					)}
				</Notice.Description>
			</Notice.Root>
		);
	}

	const wooConfig = block.woo || {};
	const setWoo = (key, val) => onChange({...block, woo: {...wooConfig, [key]: val}});

	const toggleLabels = {
		price: __('Price', 'searcio'),
		regular_sale: __('Regular & sale price', 'searcio'),
		sku: __('SKU', 'searcio'),
		skus: __('Variation SKUs', 'searcio'),
		stock_status: __('Stock status', 'searcio'),
		categories: __('Categories', 'searcio'),
		tags: __('Tags', 'searcio'),
		featured: __('Featured', 'searcio'),
		rating: __('Average rating', 'searcio'),
		review_count: __('Review count', 'searcio'),
	};

	const toggleAttribute = (slug, checked) => {
		const current = Array.isArray(wooConfig.attributes) ? wooConfig.attributes : [];
		setWoo(
			'attributes',
			checked ? [...current, slug] : current.filter((v) => v !== slug)
		);
	};

	return (
		<>
			<Section
				title={__('Product details', 'searcio')}
				description={__(
					'Pick which WooCommerce data to send. Variable products are indexed once (as the parent) with a price range.',
					'searcio'
				)}
			>
				<ToggleControl
					__nextHasNoMarginBottom
					label={__('Only index published, visible products', 'searcio')}
					help={__('Recommended. Hidden or draft products stay out of search.', 'searcio')}
					checked={wooConfig.only_visible !== false}
					onChange={(val) => setWoo('only_visible', val)}
				/>
				<Grid auto={240} rowGap="var(--wpds-dimension-gap-md)" columnGap="var(--wpds-dimension-gap-2xl)" align="start">
					{woo.toggles.map((toggle) => (
						<ToggleControl
							key={toggle}
							__nextHasNoMarginBottom
							label={toggleLabels[toggle] || toggle}
							checked={Boolean(wooConfig[toggle])}
							onChange={(val) => setWoo(toggle, val)}
						/>
					))}
				</Grid>
			</Section>

			{woo.attributes.length > 0 && (
				<Section
					title={__('Product attributes', 'searcio')}
					description={__(
						'Each selected attribute is sent as its own field (attr_{name}) so it can be made searchable.',
						'searcio'
					)}
				>
					<Grid auto={170} rowGap="var(--wpds-dimension-gap-sm)" columnGap="var(--wpds-dimension-gap-xl)" align="start">
						{woo.attributes.map((attribute) => (
							<CheckboxControl
								key={attribute.slug}
								label={attribute.label}
								checked={(wooConfig.attributes || []).includes(attribute.slug)}
								onCheckedChange={(checked) => toggleAttribute(attribute.slug, Boolean(checked))}
							/>
						))}
					</Grid>
				</Section>
			)}
		</>
	);
};

const PostTypeCard = ({postType, sources, woo, block, onChange}) => {
	const [showAdvanced, setShowAdvanced] = useState(
		Boolean((block.fields && block.fields.length) || block.type !== postType.slug)
	);
	const set = (key, val) => onChange({...block, [key]: val});
	const fields = block.fields || [];

	const updateField = (index, next) =>
		set('fields', fields.map((f, i) => (i === index ? next : f)));
	const removeField = (index) => set('fields', fields.filter((_, i) => i !== index));
	const addField = () => {
		set('fields', [...fields, {as: '', source: 'meta:'}]);
		setShowAdvanced(true);
	};

	return (
		<CollapsibleCard.Root
			defaultOpen={Boolean(block.enabled)}
			className="whsc-card whsc-card--dotted whsc-post-type-card"
		>
			<CollapsibleCard.Header render={<h3/>}>{postType.label}</CollapsibleCard.Header>
			<CollapsibleCard.Content className="whsc-post-type-card__content">
				<Stack direction="column" gap="xl">
					<ToggleControl
						__nextHasNoMarginBottom
						className="whsc-enable-toggle"
						label={sprintf(
							/* translators: %s: post type label. */
							__('Add %s to search', 'searcio'),
							postType.label
						)}
						help={sprintf(
							/* translators: %s: post type label. */
							__('When on, your %s are sent to Search Cloud and appear in search results.', 'searcio'),
							postType.label.toLowerCase()
						)}
						checked={Boolean(block.enabled)}
						onChange={(val) => set('enabled', val)}
					/>

					{block.enabled && (
						<>
							<Section
								title={__('What appears in results', 'searcio')}
								description={__(
									'Choose where each part of a search result comes from. The defaults work for most sites.',
									'searcio'
								)}
							>
								<Grid auto={260} rowGap="var(--wpds-dimension-gap-lg)" columnGap="var(--wpds-dimension-gap-xl)" align="start">
									<SelectControl
										label={__('Title', 'searcio')}
										description={__('The main heading of each result. Required.', 'searcio')}
										value={block.title_source}
										items={sourceOptions(sources, postType.taxonomies, false)}
										onValueChange={(val) => set('title_source', val)}
									/>
									<SelectControl
										label={__('Body text', 'searcio')}
										description={__('The text Search Cloud looks through for matches.', 'searcio')}
										value={selected(block.content_source)}
										items={sourceOptions(sources, postType.taxonomies, true)}
										onValueChange={(val) => set('content_source', val ?? NONE)}
									/>
									<SelectControl
										label={__('Result link', 'searcio')}
										description={__('Where clicking a result takes the visitor.', 'searcio')}
										value={selected(block.url_source)}
										items={sourceOptions(sources, postType.taxonomies, true)}
										onValueChange={(val) => set('url_source', val ?? NONE)}
									/>
									<SelectControl
										label={__('Thumbnail image', 'searcio')}
										description={__('Image shown next to each result.', 'searcio')}
										value={selected(block.image_source)}
										items={sourceOptions(sources, postType.taxonomies, true)}
										onValueChange={(val) => set('image_source', val ?? NONE)}
									/>
								</Grid>
							</Section>

							<Section title={__('Options', 'searcio')}>
								<Grid auto={240} rowGap="var(--wpds-dimension-gap-md)" columnGap="var(--wpds-dimension-gap-2xl)" align="start">
									<ToggleControl
										__nextHasNoMarginBottom
										label={__('Include a short summary (excerpt)', 'searcio')}
										checked={Boolean(block.include_excerpt)}
										onChange={(val) => set('include_excerpt', val)}
									/>
									<ToggleControl
										__nextHasNoMarginBottom
										label={__('Also index private & password-protected items', 'searcio')}
										help={__('Off by default.', 'searcio')}
										checked={Boolean(block.include_private)}
										onChange={(val) => set('include_private', val)}
									/>
								</Grid>
							</Section>

							{postType.is_product && (
								<WooSection woo={woo} block={block} onChange={onChange}/>
							)}

							<Stack direction="row" gap="sm">
								<Button
									variant="link"
									onClick={() => setShowAdvanced((v) => !v)}
									aria-expanded={showAdvanced}
								>
									{showAdvanced
										? __('Hide advanced options', 'searcio')
										: __('Show advanced options', 'searcio')}
								</Button>
							</Stack>

							{showAdvanced && (
								<>
									<Section
										title={__('Type label', 'searcio')}
										description={__(
											'How this content is grouped and filtered in search. Most sites can leave this as the default.',
											'searcio'
										)}
									>
										<InputControl
											label={__('Type', 'searcio')}
											value={block.type || ''}
											onValueChange={(val) => set('type', val)}
										/>
									</Section>

									<Section
										title={__('Extra fields', 'searcio')}
										description={__(
											'Send additional data (a custom field, a taxonomy, or a built-in field) under a name you choose.',
											'searcio'
										)}
									>
										{fields.length > 0 && (
											<Stack direction="column" gap="md" className="whsc-custom-fields">
												{fields.map((field, index) => (
													<CustomFieldRow
														key={index}
														field={field}
														taxonomies={postType.taxonomies}
														onChange={(next) => updateField(index, next)}
														onRemove={() => removeField(index)}
													/>
												))}
											</Stack>
										)}
										<Stack direction="row" gap="sm">
											<Button __next40pxDefaultSize variant="secondary" onClick={addField}>
												{__('Add a field', 'searcio')}
											</Button>
										</Stack>
									</Section>
								</>
							)}
						</>
					)}
				</Stack>
			</CollapsibleCard.Content>
		</CollapsibleCard.Root>
	);
};

const toConfigMap = (response) => {
	const next = {};
	(response.post_types || []).forEach((postType) => {
		next[postType.slug] = postType.config;
	});
	return next;
};

const IndexingTab = () => {
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [catalog, setCatalog] = useState(null);
	const [config, setConfig] = useState({});
	const [persistedConfig, setPersistedConfig] = useState({});
	const [loadError, setLoadError] = useState(null);
	const [saveError, setSaveError] = useState(null);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(persistedConfig);

	useEffect(() => {
		let isCurrentAttempt = true;

		const load = async () => {
			try {
				const response = await apiFetch({path: CONFIG_PATH});

				if (!isCurrentAttempt) {
					return;
				}

				const nextConfig = toConfigMap(response);

				setCatalog(response);
				setConfig(nextConfig);
				setPersistedConfig(nextConfig);
				setLoadError(null);
			} catch (error) {
				// Left uncaught, a load that failed kept the placeholder on screen
				// for good, with nothing to say why and nothing to try.
				if (isCurrentAttempt) {
					setLoadError(error?.message || __('the request to the REST API failed.', 'searcio'));
				}
			} finally {
				if (isCurrentAttempt) {
					setIsLoading(false);
				}
			}
		};

		setIsLoading(true);
		void load();

		return () => {
			isCurrentAttempt = false;
		};
	}, [loadAttempt]);

	const updateBlock = (slug, block) => {
		setSaveError(null);
		setConfig((current) => ({...current, [slug]: block}));
	};

	const onSave = async () => {
		setIsSaving(true);
		setSaveError(null);

		try {
			const response = await apiFetch({
				path: CONFIG_PATH,
				method: 'POST',
				data: {config},
			});
			const nextConfig = toConfigMap(response);

			setCatalog(response);
			setConfig(nextConfig);
			setPersistedConfig(nextConfig);
			showToast(__('Indexing configuration saved.', 'searcio'), 'success');
		} catch (error) {
			// Beside the button that failed, with the reason the REST API gave.
			setSaveError(error?.message || __('the request to the REST API failed.', 'searcio'));
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return <IndexingSkeleton/>;
	}

	if (loadError || !catalog) {
		return (
			<Notice.Root intent="error">
				<Notice.Description>
					{sprintf(
						/* translators: %s: reason the request failed. */
						__('The indexing configuration could not be loaded: %s', 'searcio'),
						loadError || __('the request to the REST API failed.', 'searcio')
					)}
				</Notice.Description>
				<Notice.Actions>
					<Notice.ActionButton onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
						{__('Try again', 'searcio')}
					</Notice.ActionButton>
				</Notice.Actions>
			</Notice.Root>
		);
	}

	const enabledCount = Object.values(config).filter((block) => block?.enabled).length;
	const indexingSaveDisabled = isSaving || !hasUnsavedChanges;
	const indexingSaveLabel = isSaving
		? __('Saving…', 'searcio')
		: __('Save indexing configuration', 'searcio');
	const indexingSaveDescription = !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'searcio')
		: undefined;

	return (
		<Stack direction="column" gap="lg" className="webhead-search-cloud-indexing">
			<TabIntro
				title={__('What to index', 'searcio')}
				description={__(
					'Turn on the content you want to be searchable and choose which information is sent for each. Changes take effect after the next sync.',
					'searcio'
				)}
			/>

			<Notice.Root intent="info" className="whsc-searchable-notice">
				<Notice.Description>
					{__(
						'Sending a field here makes the data available. To let visitors search by it, also enable that field (with a weight) in the Search Config tab.',
						'searcio'
					)}
				</Notice.Description>
			</Notice.Root>

			<Stack direction="column" gap="lg" className="whsc-post-types">
				{(catalog.post_types || []).map((postType) => (
					<PostTypeCard
						key={postType.slug}
						postType={postType}
						sources={catalog.sources || []}
						woo={catalog.woo || {}}
						block={config[postType.slug] || postType.config}
						onChange={(block) => updateBlock(postType.slug, block)}
					/>
				))}
			</Stack>

			{saveError && (
				<Notice.Root intent="error">
					<Notice.Description>
						{sprintf(
							/* translators: %s: reason the save failed, as reported by the REST API. */
							__('The indexing configuration could not be saved: %s', 'searcio'),
							saveError
						)}
					</Notice.Description>
					<Notice.CloseIcon onClick={() => setSaveError(null)}/>
				</Notice.Root>
			)}

			<Stack direction="row" gap="md" align="center" wrap="wrap" className="whsc-save-bar">
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					variant="primary"
					isBusy={isSaving}
					disabled={indexingSaveDisabled}
					description={indexingSaveDescription}
					label={indexingSaveLabel}
					onClick={onSave}
					showTooltip={!!indexingSaveDescription}
				>
					{indexingSaveLabel}
				</Button>
				<Text className="whsc-save-summary">
					{sprintf(
						/* translators: %d: number of enabled content types. */
						_n(
							'%d content type will be indexed.',
							'%d content types will be indexed.',
							enabledCount,
							'searcio'
						),
						enabledCount
					)}
				</Text>
			</Stack>
		</Stack>
	);
};

export default IndexingTab;
