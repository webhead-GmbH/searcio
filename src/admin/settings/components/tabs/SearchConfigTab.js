import { useContext, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	FormTokenField,
	Notice,
	RangeControl,
	TextareaControl,
	TextControl,
} from '@wordpress/components';
import { Card, Text } from '@wordpress/ui';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import { Grid } from '../../../../components/Layout';
import { showToast } from '../../../../toast';
import IndexingSkeleton from './IndexingSkeleton';

const pluginData = window.webhead_search_cloudData || {};
const SEARCH_CONFIG_PATH =
	pluginData?.api?.searchConfigPath || '/webhead-search-cloud/v1/search-config';
const INDEXING_CONFIG_PATH =
	pluginData?.api?.indexingConfigPath || '/webhead-search-cloud/v1/indexing/config';
const TEST_CONNECTION_PATH =
	pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';

// Suggestion-only, not a validation allow-list — the API is the source of
// truth for what a field name is actually worth. These are the document
// fields WooCommerce toggles produce when Products indexing is enabled.
const WOO_FIELD_SUGGESTIONS = [
	'price',
	'regular_price',
	'sale_price',
	'sku',
	'stock_status',
	'categories',
	'tags',
	'featured',
	'rating',
	'review_count',
];

const normalizeConfig = ( raw ) => ( {
	searchable_fields: Array.isArray( raw?.searchable_fields )
		? raw.searchable_fields.map( ( row ) => ( {
			field: typeof row?.field === 'string' ? row.field : '',
			weight: Number.isFinite( Number( row?.weight ) ) ? Number( row.weight ) : 1,
		} ) )
		: [],
	type_boosts: Array.isArray( raw?.type_boosts )
		? raw.type_boosts.map( ( row ) => ( {
			type: typeof row?.type === 'string' ? row.type : '',
			boost: Number.isFinite( Number( row?.boost ) ) ? Number( row.boost ) : 1,
		} ) )
		: [],
	facet_fields: Array.isArray( raw?.facet_fields ) ? raw.facet_fields : [],
	suggest_fields: Array.isArray( raw?.suggest_fields ) ? raw.suggest_fields : [],
	synonyms: Array.isArray( raw?.synonyms ) ? raw.synonyms : [],
	languages: Array.isArray( raw?.languages ) ? raw.languages : [],
} );

/** Keep exactly one boost row per currently-enabled content type, preserving any already-configured value. */
const syncTypeBoosts = ( typeBoosts, enabledTypes ) => {
	const existing = new Map( typeBoosts.map( ( row ) => [ row.type, row.boost ] ) );

	return enabledTypes.map( ( type ) => ( {
		type,
		boost: existing.has( type ) ? existing.get( type ) : 1,
	} ) );
};

const fieldPool = ( catalog ) => {
	if ( ! catalog ) {
		return [ 'title', 'content', 'type', 'url' ];
	}

	const pool = new Set( [ 'title', 'content', 'type', 'url' ] );
	let hasEnabledProduct = false;

	( catalog.post_types || [] ).forEach( ( postType ) => {
		if ( ! postType.config?.enabled ) {
			return;
		}

		if ( postType.is_product ) {
			hasEnabledProduct = true;
		}

		( postType.config.fields || [] ).forEach( ( field ) => {
			if ( field?.as ) {
				pool.add( field.as );
			}
		} );
	} );

	if ( hasEnabledProduct && catalog.woo?.active ) {
		WOO_FIELD_SUGGESTIONS.forEach( ( field ) => pool.add( field ) );
	}

	return Array.from( pool );
};

const enabledTypeLabels = ( catalog ) => {
	const labels = {};

	( catalog?.post_types || [] ).forEach( ( postType ) => {
		if ( postType.config?.enabled ) {
			labels[ postType.slug ] = postType.label;
		}
	} );

	return labels;
};

/** Errors use `searchable_fields.0.field` style keys; map back to a row + column. */
const rowError = ( errors, section, index, column ) => {
	const key = `${ section }.${ index }.${ column }`;
	const messages = errors?.[ key ];

	return Array.isArray( messages ) ? messages.join( ' ' ) : undefined;
};

const toPopularSearchesText = ( value ) => ( Array.isArray( value ) ? value.join( '\n' ) : '' );

const fromPopularSearchesText = ( text ) => text
	.split( '\n' )
	.map( ( line ) => line.trim() )
	.filter( ( line ) => '' !== line );

/**
 * Moved here from its own tab per admin feedback - it's a curated fallback
 * for the same search behavior this whole tab configures, so it belongs
 * alongside it rather than as a separate destination. Persists through the
 * generic settings store (a local WP option), not the `/search-config` PUT
 * the rest of this tab uses - but shares this tab's single save button
 * (per admin feedback, a page should not show two separate save actions);
 * `SearchConfigTab` calls the settings store's own `saveSettings()`
 * alongside its `/search-config` PUT.
 */
const PopularSearchesCard = () => {
	const { settings, updateSetting, isLoading } = useContext( SettingsContext );

	const [ popularSearchesText, setPopularSearchesText ] = useState( '' );
	const popularSearchesInit = useRef( false );

	useEffect( () => {
		if ( isLoading || popularSearchesInit.current ) {
			return;
		}

		setPopularSearchesText( toPopularSearchesText( settings.popular_searches ) );
		popularSearchesInit.current = true;
	}, [ isLoading, settings.popular_searches ] );

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h3 /> }>{ __( 'Popular searches', 'webhead-search-cloud' ) }</Card.Title>
					<Text render={ <p /> } variant="body-sm">
						{ __(
							"A fallback list of queries shown as suggestions in the search modal before a visitor types anything. Search Cloud's own live popular searches are used whenever available; this list only takes over when that request comes back empty or fails.",
							'webhead-search-cloud'
						) }
					</Text>
				</div>
			</Card.Header>
			<Card.Content className="whsc-settings-card-content">
				<TextareaControl
					label={ __( 'Popular searches', 'webhead-search-cloud' ) }
					hideLabelFromVision
					help={ __( 'One query per line. Used as a fallback whenever live popular searches from Search Cloud are unavailable or empty.', 'webhead-search-cloud' ) }
					value={ popularSearchesText }
					onChange={ ( value ) => {
						setPopularSearchesText( value );
						updateSetting( 'popular_searches', fromPopularSearchesText( value ) );
					} }
				/>
			</Card.Content>
		</Card.Root>
	);
};

const SearchConfigTab = () => {
	// The Popular Searches card persists through the plugin's own settings
	// store (a local WP option), not the `/search-config` PUT the rest of
	// this tab uses - `onSave` below calls both, but the tab shows exactly
	// one save button either way (per admin feedback: never two).
	const {
		saveSettings: savePopularSearches,
		hasUnsavedChanges: hasUnsavedPopularSearches,
	} = useContext( SettingsContext );

	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ catalog, setCatalog ] = useState( null );
	const [ config, setConfig ] = useState( null );
	const [ persistedConfig, setPersistedConfig ] = useState( null );
	const [ topLevelError, setTopLevelError ] = useState( '' );
	const [ fieldErrors, setFieldErrors ] = useState( {} );
	// `null` limit means unlimited. A failed connection test (e.g. credentials
	// not saved yet) just leaves this uncapped rather than blocking the tab.
	const [ languageLimit, setLanguageLimit ] = useState( null );

	useEffect( () => {
		const load = async () => {
			try {
				const [ configResponse, catalogResponse ] = await Promise.all( [
					apiFetch( { path: SEARCH_CONFIG_PATH } ),
					apiFetch( { path: INDEXING_CONFIG_PATH } ),
				] );

				const normalized = normalizeConfig( configResponse );
				normalized.type_boosts = syncTypeBoosts(
					normalized.type_boosts,
					Object.keys( enabledTypeLabels( catalogResponse ) )
				);

				setCatalog( catalogResponse );
				setConfig( normalized );
				setPersistedConfig( normalized );
			} catch ( error ) {
				setTopLevelError(
					error?.message || __( 'Could not load the search configuration.', 'webhead-search-cloud' )
				);
			} finally {
				setIsLoading( false );
			}

			try {
				const connection = await apiFetch( { path: TEST_CONNECTION_PATH, method: 'POST' } );

				if ( connection?.ok ) {
					setLanguageLimit( connection.languages?.limit ?? null );
				}
			} catch ( error ) {
				// Non-fatal — the language picker just stays uncapped client-side
				// until a successful connection test reports the plan's limit.
			}
		};

		void load();
	}, [] );

	const pool = useMemo( () => fieldPool( catalog ), [ catalog ] );
	const typeLabels = useMemo( () => enabledTypeLabels( catalog ), [ catalog ] );
	const hasSearchConfigChanges = JSON.stringify( config ) !== JSON.stringify( persistedConfig );
	const hasUnsavedChanges = hasSearchConfigChanges || hasUnsavedPopularSearches;

	const set = ( key, value ) => setConfig( ( current ) => ( { ...current, [ key ]: value } ) );

	const updateSearchableField = ( index, next ) =>
		set(
			'searchable_fields',
			config.searchable_fields.map( ( row, i ) => ( i === index ? next : row ) )
		);
	const removeSearchableField = ( index ) =>
		set( 'searchable_fields', config.searchable_fields.filter( ( _, i ) => i !== index ) );
	const addSearchableField = () =>
		set( 'searchable_fields', [ ...config.searchable_fields, { field: '', weight: 1 } ] );

	const updateTypeBoost = ( index, boost ) =>
		set(
			'type_boosts',
			config.type_boosts.map( ( row, i ) => ( i === index ? { ...row, boost } : row ) )
		);

	// `?.` guards against the connection-test promise resolving languageLimit
	// before (or without) the config fetch ever completing.
	const atLanguageLimit = null !== languageLimit && ( config?.languages?.length ?? 0 ) >= languageLimit;
	const toggleLanguage = ( code, checked ) => {
		if ( checked && atLanguageLimit ) {
			return;
		}

		set(
			'languages',
			checked ? [ ...config.languages, code ] : config.languages.filter( ( existing ) => existing !== code )
		);
	};

	// One save button for the whole tab (per admin feedback: never two) even
	// though the two halves persist through different backends - the live
	// `/search-config` PUT, and the plugin's own settings store for Popular
	// Searches. Runs whichever half actually changed and folds the result
	// into a single toast.
	const onSave = async () => {
		setIsSaving( true );
		setTopLevelError( '' );
		setFieldErrors( {} );

		let searchConfigOk = true;
		let popularSearchesOk = true;

		if ( hasSearchConfigChanges ) {
			try {
				const response = await apiFetch( {
					path: SEARCH_CONFIG_PATH,
					method: 'PUT',
					data: config,
				} );

				const normalized = normalizeConfig( response );
				normalized.type_boosts = syncTypeBoosts( normalized.type_boosts, Object.keys( typeLabels ) );

				setConfig( normalized );
				setPersistedConfig( normalized );
			} catch ( error ) {
				searchConfigOk = false;
				setTopLevelError(
					error?.message || __( 'Could not save the search configuration.', 'webhead-search-cloud' )
				);
				setFieldErrors( error?.errors && 'object' === typeof error.errors ? error.errors : {} );
			}
		}

		if ( hasUnsavedPopularSearches ) {
			popularSearchesOk = await savePopularSearches();
		}

		setIsSaving( false );

		showToast(
			searchConfigOk && popularSearchesOk
				? __( 'Search configuration saved.', 'webhead-search-cloud' )
				: __( 'Could not save the search configuration.', 'webhead-search-cloud' ),
			searchConfigOk && popularSearchesOk ? 'success' : 'error'
		);
	};

	if ( isLoading || ! config ) {
		return (
			<Card.Root className="whsc-tab-card">
				<Card.Content className="whsc-tab-card-content">
					<IndexingSkeleton />
				</Card.Content>
			</Card.Root>
		);
	}

	const saveDisabled = isSaving || ! hasUnsavedChanges;
	const saveLabel = isSaving
		? __( 'Saving…', 'webhead-search-cloud' )
		: __( 'Save search configuration', 'webhead-search-cloud' );
	const saveDescription = ! isSaving && ! hasUnsavedChanges
		? __( 'No unsaved changes.', 'webhead-search-cloud' )
		: undefined;

	return (
		<Card.Root className="whsc-tab-card">
			<Card.Header className="whsc-tab-card-header">
				<Card.Title render={ <h3 /> }>
					{ __( 'Search configuration', 'webhead-search-cloud' ) }
				</Card.Title>
				<Text render={ <p /> } variant="body-sm">
					{ __(
						"Controls how Search Cloud itself ranks and filters your content - which fields it searches and how heavily, per-type ranking boosts, which fields power facets and suggestions, and synonyms. Most of this lives on Search Cloud's side, not in this plugin's own settings, so changes take effect on the very next search.",
						'webhead-search-cloud'
					) }
				</Text>
			</Card.Header>
			<Card.Content className="whsc-tab-card-content webhead-search-cloud-search-config">
				{ topLevelError && (
					<Notice status="error" isDismissible={ false }>
						<p>{ topLevelError }</p>
					</Notice>
				) }

				<Grid className="whsc-settings-grid" columns={ { base: 1, md: 2 } } gap={ { base: 16, md: 20 } } align="start">
					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Searchable fields & weights', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ __(
										'Which fields full-text search matches, and how much each one counts (1–100). A higher weight on "title" makes title matches outrank body-text matches, for example.',
										'webhead-search-cloud'
									) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							{ config.searchable_fields.length > 0 && (
								<div className="whsc-search-config-repeater">
									{ config.searchable_fields.map( ( row, index ) => (
										<div className="whsc-search-config-row" key={ index }>
											<TextControl
												__next40pxDefaultSize
												__nextHasNoMarginBottom
												label={ __( 'Field', 'webhead-search-cloud' ) }
												list="whsc-field-suggestions"
												value={ row.field }
												help={ rowError( fieldErrors, 'searchable_fields', index, 'field' ) }
												onChange={ ( field ) => updateSearchableField( index, { ...row, field } ) }
											/>
											<RangeControl
												__next40pxDefaultSize
												__nextHasNoMarginBottom
												label={ __( 'Weight', 'webhead-search-cloud' ) }
												min={ 1 }
												max={ 100 }
												value={ row.weight }
												onChange={ ( weight ) => updateSearchableField( index, { ...row, weight } ) }
											/>
											<Button
												icon="trash"
												isDestructive
												variant="tertiary"
												label={ __( 'Remove field', 'webhead-search-cloud' ) }
												onClick={ () => removeSearchableField( index ) }
											/>
										</div>
									) ) }
								</div>
							) }
							<Button variant="secondary" onClick={ addSearchableField }>
								{ __( 'Add a field', 'webhead-search-cloud' ) }
							</Button>
							<datalist id="whsc-field-suggestions">
								{ pool.map( ( field ) => <option key={ field } value={ field } /> ) }
							</datalist>
						</Card.Content>
					</Card.Root>

					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Type boosts', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ __(
										'Ranking boost per content type (0.1–100). Above 1 ranks that type higher overall; below 1 ranks it lower. One row per content type currently enabled in Indexing.',
										'webhead-search-cloud'
									) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							{ config.type_boosts.length > 0 ? (
								<div className="whsc-search-config-repeater">
									{ config.type_boosts.map( ( row, index ) => (
										<div className="whsc-search-config-row whsc-search-config-row--boost" key={ row.type }>
											<div className="whsc-search-config-type-label">
												<span className="whsc-search-config-type-label__caption">
													{ __( 'Type', 'webhead-search-cloud' ) }
												</span>
												<span className="whsc-search-config-type-label__value">
													{ typeLabels[ row.type ] || row.type }
												</span>
											</div>
											<RangeControl
												__next40pxDefaultSize
												__nextHasNoMarginBottom
												label={ __( 'Boost', 'webhead-search-cloud' ) }
												min={ 0.1 }
												max={ 100 }
												step={ 0.1 }
												value={ row.boost }
												help={ rowError( fieldErrors, 'type_boosts', index, 'boost' ) }
												onChange={ ( boost ) => updateTypeBoost( index, boost ) }
											/>
										</div>
									) ) }
								</div>
							) : (
								<Notice status="info" isDismissible={ false }>
									<p>
										{ __(
											'Enable at least one content type in the Indexing tab to set a type boost.',
											'webhead-search-cloud'
										) }
									</p>
								</Notice>
							) }
						</Card.Content>
					</Card.Root>

					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Facet fields', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ __(
										'Fields returned as facets on search results and allowed as filters. Click the field to browse every available field, or type to search.',
										'webhead-search-cloud'
									) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							<FormTokenField
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								__experimentalExpandOnFocus
								label={ __( 'Facet fields', 'webhead-search-cloud' ) }
								hideLabelFromVision
								value={ config.facet_fields }
								suggestions={ pool }
								onChange={ ( value ) => set( 'facet_fields', value ) }
							/>
						</Card.Content>
					</Card.Root>

					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Suggest fields', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ __(
										'Fields queried for search-as-you-type suggestions. Defaults to "title" when left empty. Click to browse, or type to search.',
										'webhead-search-cloud'
									) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							<FormTokenField
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								__experimentalExpandOnFocus
								label={ __( 'Suggest fields', 'webhead-search-cloud' ) }
								hideLabelFromVision
								value={ config.suggest_fields }
								suggestions={ pool }
								onChange={ ( value ) => set( 'suggest_fields', value ) }
							/>
						</Card.Content>
					</Card.Root>

					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Synonyms', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ __(
										'Treats words as interchangeable during search, even when the exact word a visitor types never appears in a result. For example, a line with "sneaker, trainer" means searching "sneaker" also matches results that only mention "trainer", and vice versa - useful for regional spelling or naming differences.',
										'webhead-search-cloud'
									) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							<TextareaControl
								label={ __( 'Synonyms', 'webhead-search-cloud' ) }
								hideLabelFromVision
								help={ __( 'One comma-separated group of interchangeable words per line, e.g. "sneaker, trainer".', 'webhead-search-cloud' ) }
								value={ config.synonyms.join( '\n' ) }
								onChange={ ( value ) =>
									set(
										'synonyms',
										value.split( '\n' ).map( ( line ) => line.trim() ).filter( ( line ) => '' !== line )
									)
								}
							/>
						</Card.Content>
					</Card.Root>

					<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
						<Card.Header className="whsc-settings-card-header">
							<div className="whsc-settings-card-copy">
								<Card.Title render={ <h3 /> }>{ __( 'Languages', 'webhead-search-cloud' ) }</Card.Title>
								<Text render={ <p /> } variant="body-sm">
									{ catalog?.languages?.active
										? ( null !== languageLimit
											? sprintf(
												/* translators: %d: number of languages the plan allows. */
												__( 'Which of this site\'s languages to index and search. Your plan allows up to %d.', 'webhead-search-cloud' ),
												languageLimit
											)
											: __( 'Which of this site\'s languages to index and search. Leave every language unchecked for unrestricted.', 'webhead-search-cloud' ) )
										: __( 'No WPML/Polylang installation was detected, so languages can only be entered manually here. Leave empty for unrestricted.', 'webhead-search-cloud' ) }
								</Text>
							</div>
						</Card.Header>
						<Card.Content className="whsc-settings-card-content">
							{ catalog?.languages?.active ? (
								<div className="whsc-language-grid">
									{ ( catalog?.languages?.available || [] ).map( ( language ) => (
										<CheckboxControl
											key={ language.code }
											__nextHasNoMarginBottom
											label={ `${ language.name } (${ language.code })` }
											checked={ config.languages.includes( language.code ) }
											disabled={ ! config.languages.includes( language.code ) && atLanguageLimit }
											onChange={ ( checked ) => toggleLanguage( language.code, checked ) }
										/>
									) ) }
								</div>
							) : (
								<TextControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __( 'Languages', 'webhead-search-cloud' ) }
									hideLabelFromVision
									help={ __( 'Comma-separated ISO language codes, e.g. "de, en".', 'webhead-search-cloud' ) }
									value={ config.languages.join( ', ' ) }
									onChange={ ( value ) =>
										set(
											'languages',
											value.split( ',' ).map( ( code ) => code.trim() ).filter( ( code ) => '' !== code )
										)
									}
								/>
							) }

							{ Array.isArray( fieldErrors?.languages ) && fieldErrors.languages.length > 0 && (
								<Notice status="error" isDismissible={ false }>
									<p>{ fieldErrors.languages.join( ' ' ) }</p>
								</Notice>
							) }
						</Card.Content>
					</Card.Root>

					<PopularSearchesCard />
				</Grid>

				<div className="whsc-save-bar">
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						variant="primary"
						isBusy={ isSaving }
						disabled={ saveDisabled }
						description={ saveDescription }
						label={ saveLabel }
						onClick={ onSave }
						showTooltip={ !! saveDescription }
					>
						{ saveLabel }
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	);
};

export default SearchConfigTab;
