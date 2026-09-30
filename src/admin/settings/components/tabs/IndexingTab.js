import {useEffect, useState} from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	Notice,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import { Card, CollapsibleCard, InputControl, Text } from '@wordpress/ui';
import {__, _n, sprintf} from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import {showToast} from '../../../../toast';
import IndexingSkeleton from './IndexingSkeleton';

const pluginData = window.webhead_search_cloudData || {};
const CONFIG_PATH =
	pluginData?.api?.indexingConfigPath || '/webhead-search-cloud/v1/indexing/config';

const NONE = '';

const KIND_OPTIONS = [
	{value: 'meta', label: __('Custom field', 'webhead-search-cloud')},
	{value: 'taxonomy', label: __('Taxonomy', 'webhead-search-cloud')},
	{value: 'property', label: __('Built-in field', 'webhead-search-cloud')},
];

const PROPERTY_OPTIONS = [
	{value: 'author', label: __('Author', 'webhead-search-cloud')},
	{value: 'date', label: __('Published date', 'webhead-search-cloud')},
	{value: 'modified', label: __('Modified date', 'webhead-search-cloud')},
	{value: 'excerpt', label: __('Excerpt', 'webhead-search-cloud')},
	{value: 'slug', label: __('Slug', 'webhead-search-cloud')},
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
				__('Taxonomy: %s', 'webhead-search-cloud'),
				taxonomy.label
			),
		});
	});

	if (allowNone) {
		return [{value: NONE, label: __('- Do not send -', 'webhead-search-cloud')}, ...options];
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

const Section = ({title, description, children}) => (
	<div className="whsc-section">
		<Text render={<h5/>} variant="heading-sm" className="whsc-section-title">
			{title}
		</Text>
		{description && (
			<Text render={<p/>} variant="body-sm" className="whsc-section-description">
				{description}
			</Text>
		)}
		<div className="whsc-section-body">{children}</div>
	</div>
);

const CustomFieldRow = ({field, taxonomies, onChange, onRemove}) => {
	const {kind, value} = parseSource(field.source);

	const setKind = (nextKind) => onChange({...field, source: `${nextKind}:`});
	const setValue = (nextValue) => onChange({...field, source: `${kind}:${nextValue}`});

	const renderValue = () => {
		if (kind === 'property') {
			return (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={__('Value', 'webhead-search-cloud')}
					value={value}
					options={[
						{value: '', label: __('- Select -', 'webhead-search-cloud')},
						...PROPERTY_OPTIONS,
					]}
					onChange={setValue}
				/>
			);
		}

		if (kind === 'taxonomy' && taxonomies.length > 0) {
			return (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={__('Taxonomy', 'webhead-search-cloud')}
					value={value}
					options={[
						{value: '', label: __('- Select -', 'webhead-search-cloud')},
						...taxonomies.map((taxonomy) => ({
							value: taxonomy.slug,
							label: taxonomy.label,
						})),
					]}
					onChange={setValue}
				/>
			);
		}

		return (
			<InputControl
				label={kind === 'taxonomy'
					? __('Taxonomy slug', 'webhead-search-cloud')
					: __('Meta key', 'webhead-search-cloud')}
				placeholder={kind === 'taxonomy' ? 'product_brand' : '_my_field'}
				value={value}
				onValueChange={setValue}
			/>
		);
	};

	return (
		<div className="whsc-custom-field-row">
			<InputControl
				label={__('Send as', 'webhead-search-cloud')}
				placeholder="brand"
				value={field.as}
				onValueChange={(next) => onChange({...field, as: next})}
			/>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={__('From', 'webhead-search-cloud')}
				value={kind}
				options={KIND_OPTIONS}
				onChange={setKind}
			/>
			{renderValue()}
			<Button
				icon="trash"
				isDestructive
				variant="tertiary"
				label={__('Remove field', 'webhead-search-cloud')}
				onClick={onRemove}
			/>
		</div>
	);
};

const WooSection = ({woo, block, onChange}) => {
	if (!woo.active) {
		return (
			<Notice status="info" isDismissible={false}>
				<p>{__('Activate WooCommerce to index product data.', 'webhead-search-cloud')}</p>
			</Notice>
		);
	}

	if (!woo.meets_minimum) {
		return (
			<Notice status="warning" isDismissible={false}>
				<p>
					{sprintf(
						/* translators: 1: current version, 2: minimum version. */
						__(
							'WooCommerce %1$s is below the supported minimum %2$s. Product fields are disabled until WooCommerce is updated.',
							'webhead-search-cloud'
						),
						woo.version || __('(unknown)', 'webhead-search-cloud'),
						woo.minimum
					)}
				</p>
			</Notice>
		);
	}

	const wooConfig = block.woo || {};
	const setWoo = (key, val) => onChange({...block, woo: {...wooConfig, [key]: val}});

	const toggleLabels = {
		price: __('Price', 'webhead-search-cloud'),
		regular_sale: __('Regular & sale price', 'webhead-search-cloud'),
		sku: __('SKU', 'webhead-search-cloud'),
		skus: __('Variation SKUs', 'webhead-search-cloud'),
		stock_status: __('Stock status', 'webhead-search-cloud'),
		categories: __('Categories', 'webhead-search-cloud'),
		tags: __('Tags', 'webhead-search-cloud'),
		featured: __('Featured', 'webhead-search-cloud'),
		rating: __('Average rating', 'webhead-search-cloud'),
		review_count: __('Review count', 'webhead-search-cloud'),
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
				title={__('Product details', 'webhead-search-cloud')}
				description={__(
					'Pick which WooCommerce data to send. Variable products are indexed once (as the parent) with a price range.',
					'webhead-search-cloud'
				)}
			>
				<ToggleControl
					__nextHasNoMarginBottom
					label={__('Only index published, visible products', 'webhead-search-cloud')}
					help={__('Recommended. Hidden or draft products stay out of search.', 'webhead-search-cloud')}
					checked={wooConfig.only_visible !== false}
					onChange={(val) => setWoo('only_visible', val)}
				/>
				<div className="whsc-toggle-grid">
					{woo.toggles.map((toggle) => (
						<ToggleControl
							key={toggle}
							__nextHasNoMarginBottom
							label={toggleLabels[toggle] || toggle}
							checked={Boolean(wooConfig[toggle])}
							onChange={(val) => setWoo(toggle, val)}
						/>
					))}
				</div>
			</Section>

			{woo.attributes.length > 0 && (
				<Section
					title={__('Product attributes', 'webhead-search-cloud')}
					description={__(
						'Each selected attribute is sent as its own field (attr_{name}) so it can be made searchable.',
						'webhead-search-cloud'
					)}
				>
					<div className="whsc-attr-grid">
						{woo.attributes.map((attribute) => (
							<CheckboxControl
								key={attribute.slug}
								__nextHasNoMarginBottom
								label={attribute.label}
								checked={(wooConfig.attributes || []).includes(attribute.slug)}
								onChange={(checked) => toggleAttribute(attribute.slug, checked)}
							/>
						))}
					</div>
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
			<CollapsibleCard.Header render={<h4/>}>{postType.label}</CollapsibleCard.Header>
			<CollapsibleCard.Content className="whsc-post-type-card__content">
				<ToggleControl
					__nextHasNoMarginBottom
					className="whsc-enable-toggle"
					label={sprintf(
						/* translators: %s: post type label. */
						__('Add %s to search', 'webhead-search-cloud'),
						postType.label
					)}
					help={sprintf(
						/* translators: %s: post type label. */
						__('When on, your %s are sent to Search Cloud and appear in search results.', 'webhead-search-cloud'),
						postType.label.toLowerCase()
					)}
					checked={Boolean(block.enabled)}
					onChange={(val) => set('enabled', val)}
				/>

				{block.enabled && (
					<div className="whsc-post-type-body">
						<Section
							title={__('What appears in results', 'webhead-search-cloud')}
							description={__(
								'Choose where each part of a search result comes from. The defaults work for most sites.',
								'webhead-search-cloud'
							)}
						>
							<div className="whsc-fields-grid">
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={__('Title', 'webhead-search-cloud')}
									help={__('The main heading of each result. Required.', 'webhead-search-cloud')}
									value={block.title_source}
									options={sourceOptions(sources, postType.taxonomies, false)}
									onChange={(val) => set('title_source', val)}
								/>
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={__('Body text', 'webhead-search-cloud')}
									help={__('The text Search Cloud looks through for matches.', 'webhead-search-cloud')}
									value={block.content_source}
									options={sourceOptions(sources, postType.taxonomies, true)}
									onChange={(val) => set('content_source', val)}
								/>
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={__('Result link', 'webhead-search-cloud')}
									help={__('Where clicking a result takes the visitor.', 'webhead-search-cloud')}
									value={block.url_source}
									options={sourceOptions(sources, postType.taxonomies, true)}
									onChange={(val) => set('url_source', val)}
								/>
								<SelectControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={__('Thumbnail image', 'webhead-search-cloud')}
									help={__('Image shown next to each result.', 'webhead-search-cloud')}
									value={block.image_source}
									options={sourceOptions(sources, postType.taxonomies, true)}
									onChange={(val) => set('image_source', val)}
								/>
							</div>
						</Section>

						<Section title={__('Options', 'webhead-search-cloud')}>
							<div className="whsc-toggle-grid">
								<ToggleControl
									__nextHasNoMarginBottom
									label={__('Include a short summary (excerpt)', 'webhead-search-cloud')}
									checked={Boolean(block.include_excerpt)}
									onChange={(val) => set('include_excerpt', val)}
								/>
								<ToggleControl
									__nextHasNoMarginBottom
									label={__('Also index private & password-protected items', 'webhead-search-cloud')}
									help={__('Off by default.', 'webhead-search-cloud')}
									checked={Boolean(block.include_private)}
									onChange={(val) => set('include_private', val)}
								/>
							</div>
						</Section>

						{postType.is_product && (
							<WooSection woo={woo} block={block} onChange={onChange}/>
						)}

						<div className="whsc-advanced">
							<Button
								variant="link"
								onClick={() => setShowAdvanced((v) => !v)}
								aria-expanded={showAdvanced}
							>
								{showAdvanced
									? __('Hide advanced options', 'webhead-search-cloud')
									: __('Show advanced options', 'webhead-search-cloud')}
							</Button>

							{showAdvanced && (
								<>
									<Section
										title={__('Type label', 'webhead-search-cloud')}
										description={__(
											'How this content is grouped and filtered in search. Most sites can leave this as the default.',
											'webhead-search-cloud'
										)}
									>
										<InputControl
											label={__('Type', 'webhead-search-cloud')}
											value={block.type || ''}
											onValueChange={(val) => set('type', val)}
										/>
									</Section>

									<Section
										title={__('Extra fields', 'webhead-search-cloud')}
										description={__(
											'Send additional data (a custom field, a taxonomy, or a built-in field) under a name you choose.',
											'webhead-search-cloud'
										)}
									>
										{fields.length > 0 && (
											<div className="whsc-custom-fields">
												{fields.map((field, index) => (
													<CustomFieldRow
														key={index}
														field={field}
														taxonomies={postType.taxonomies}
														onChange={(next) => updateField(index, next)}
														onRemove={() => removeField(index)}
													/>
												))}
											</div>
										)}
										<Button variant="secondary" onClick={addField}>
											{__('Add a field', 'webhead-search-cloud')}
										</Button>
									</Section>
								</>
							)}
						</div>
					</div>
				)}
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
	const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(persistedConfig);

	useEffect(() => {
		const load = async () => {
			try {
				const response = await apiFetch({path: CONFIG_PATH});
				const nextConfig = toConfigMap(response);

				setCatalog(response);
				setConfig(nextConfig);
				setPersistedConfig(nextConfig);
			} finally {
				setIsLoading(false);
			}
		};

		void load();
	}, []);

	const updateBlock = (slug, block) =>
		setConfig((current) => ({...current, [slug]: block}));

	const onSave = async () => {
		setIsSaving(true);

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
			showToast(__('Indexing configuration saved.', 'webhead-search-cloud'), 'success');
		} catch (error) {
			showToast(
				error?.message || __('Could not save the indexing configuration.', 'webhead-search-cloud'),
				'error'
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading || !catalog) {
		return (
			<Card.Root className="whsc-tab-card">
				<Card.Content className="whsc-tab-card-content">
					<IndexingSkeleton/>
				</Card.Content>
			</Card.Root>
		);
	}

	const enabledCount = Object.values(config).filter((block) => block?.enabled).length;
	const indexingSaveDisabled = isSaving || !hasUnsavedChanges;
	const indexingSaveLabel = isSaving
		? __('Saving…', 'webhead-search-cloud')
		: __('Save indexing configuration', 'webhead-search-cloud');
	const indexingSaveDescription = !isSaving && !hasUnsavedChanges
		? __('No unsaved changes.', 'webhead-search-cloud')
		: undefined;

	return (
		<Card.Root className="whsc-tab-card">
			<Card.Header className="whsc-tab-card-header">
				<Card.Title render={<h3/>}>
					{__('What to index', 'webhead-search-cloud')}
				</Card.Title>
				<Text render={<p/>} variant="body-sm">
					{__(
						'Turn on the content you want to be searchable and choose which information is sent for each. Changes take effect after the next sync.',
						'webhead-search-cloud'
					)}
				</Text>
			</Card.Header>
			<Card.Content className="whsc-tab-card-content webhead-search-cloud-indexing">
				<Notice status="info" isDismissible={false} className="whsc-searchable-notice">
					<p>
						{__(
							'Sending a field here makes the data available. To let visitors search by it, also enable that field (with a weight) in the Search Config tab.',
							'webhead-search-cloud'
						)}
					</p>
				</Notice>

				<div className="whsc-post-types">
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
				</div>

				<div className="whsc-save-bar">
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
					<span className="whsc-save-summary">
					{sprintf(
						/* translators: %d: number of enabled content types. */
						_n(
							'%d content type will be indexed.',
							'%d content types will be indexed.',
							enabledCount,
							'webhead-search-cloud'
						),
						enabledCount
					)}
				</span>
				</div>
			</Card.Content>
		</Card.Root>
	);
};

export default IndexingTab;
