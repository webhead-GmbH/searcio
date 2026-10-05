import { useContext, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button, FormTokenField, RangeControl } from '@wordpress/components';
import { Card, CheckboxControl, InputControl, Notice, Stack, Text, TextareaControl } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';
import { trash } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

import SettingsContext from '../../../../settings/store/context';
import {
	idsToText,
	listError,
	normalizeConfig,
	textToIds,
	toPayload,
} from '../../searchConfig';
import { indexedFields, unindexedFields } from '../../indexedFields';
import { Grid } from '../../../../components/Layout';
import { showToast } from '../../../../toast';
import TabIntro from '../TabIntro';
import IndexingSkeleton from './IndexingSkeleton';

const pluginData = window.webhead_search_cloudData || {};
const SEARCH_CONFIG_PATH =
	pluginData?.api?.searchConfigPath || '/webhead-search-cloud/v1/search-config';
const INDEXING_CONFIG_PATH =
	pluginData?.api?.indexingConfigPath || '/webhead-search-cloud/v1/indexing/config';
const TEST_CONNECTION_PATH =
	pluginData?.api?.testConnectionPath || '/webhead-search-cloud/v1/connection/test';

/**
 * One editable boost row per content type this site indexes, preserving any
 * value already configured.
 *
 * Boosts for types this WordPress does not index are kept and passed through
 * untouched. `PUT /search-config` replaces the whole section, so rebuilding the
 * list from local post types alone would delete a boost set in the panel for a
 * type that lives somewhere else - another store on the same index, or a type
 * that was disabled here temporarily.
 */
const syncTypeBoosts = ( typeBoosts, enabledTypes ) => {
	const existing = new Map( typeBoosts.map( ( row ) => [ row.type, row.boost ] ) );
	const local = enabledTypes.map( ( type ) => ( {
		type,
		boost: existing.has( type ) ? existing.get( type ) : 1,
	} ) );

	const foreign = typeBoosts.filter( ( row ) => ! enabledTypes.includes( row.type ) );

	return [ ...local, ...foreign ];
};

/**
 * Warns that configured fields exist on no document from this site. Not a
 * validation error: the API accepts the names, and another source writing to
 * the same index could carry them - but from here they silently match nothing.
 *
 * @param {Object}        props
 * @param {Array<string>} props.fields  From `unindexedFields()`.
 * @param {Function}      props.message Called with (quotedList, count).
 */
const UnindexedFieldsNotice = ( { fields, message } ) => {
	if ( 0 === fields.length ) {
		return null;
	}

	const quoted = fields.map( ( field ) => `"${ field }"` ).join( ', ' );

	return (
		<Notice.Root intent="warning" className="whsc-unindexed-fields">
			<Notice.Description>{ message( quoted, fields.length ) }</Notice.Description>
		</Notice.Root>
	);
};

const unindexedFacetMessage = ( quoted, count ) => sprintf(
	/* translators: %s: one or more quoted field names, e.g. "category". */
	_n(
		'No document on this site has a %s field, so its facet will always be empty. Choose a field from the list, or start indexing it in the Indexing tab.',
		'No document on this site has the fields %s, so their facets will always be empty. Choose fields from the list, or start indexing them in the Indexing tab.',
		count,
		'webhead-search-cloud'
	),
	quoted
);

const unindexedSuggestMessage = ( quoted, count ) => sprintf(
	/* translators: %s: one or more quoted field names, e.g. "category". */
	_n(
		'No document on this site has a %s field, so it will never add a suggestion. Choose a field from the list, or start indexing it in the Indexing tab.',
		'No document on this site has the fields %s, so they will never add a suggestion. Choose fields from the list, or start indexing them in the Indexing tab.',
		count,
		'webhead-search-cloud'
	),
	quoted
);

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

/** Feature errors come back as `features.ai_search.enabled`. */
const featureError = ( errors, key ) => {
	const messages = errors?.[ `features.${ key }.enabled` ];

	return Array.isArray( messages ) ? messages.join( ' ' ) : undefined;
};

const AI_STATUS_LABELS = () => ( {
	pending: __( 'Preparing…', 'webhead-search-cloud' ),
	indexing: __( 'Indexing…', 'webhead-search-cloud' ),
	ready: __( 'Ready', 'webhead-search-cloud' ),
	failed: __( 'Failed', 'webhead-search-cloud' ),
} );

const toPopularSearchesText = ( value ) => ( Array.isArray( value ) ? value.join( '\n' ) : '' );

const fromPopularSearchesText = ( text ) => text
	.split( '\n' )
	.map( ( line ) => line.trim() )
	.filter( ( line ) => '' !== line );

/**
 * The header every card of this tab has: its name and what it is for.
 */
const CardHeading = ( { title, description } ) => (
	<Card.Header className="whsc-settings-card-header">
		<div className="whsc-settings-card-copy">
			<Card.Title render={ <h3 /> }>{ title }</Card.Title>
			<Text render={ <p /> } variant="body-sm">
				{ description }
			</Text>
		</div>
	</Card.Header>
);

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
			<CardHeading
				title={ __( 'Popular searches', 'webhead-search-cloud' ) }
				description={ __(
					"A fallback list of queries shown as suggestions in the search modal before a visitor types anything. Search Cloud's own live popular searches are used whenever available; this list only takes over when that request comes back empty or fails.",
					'webhead-search-cloud'
				) }
			/>
			<Card.Content className="whsc-settings-card-content">
				<TextareaControl
					label={ __( 'Popular searches', 'webhead-search-cloud' ) }
					hideLabelFromVision
					description={ __( 'One query per line. Used as a fallback whenever live popular searches from Search Cloud are unavailable or empty.', 'webhead-search-cloud' ) }
					value={ popularSearchesText }
					onValueChange={ ( value ) => {
						setPopularSearchesText( value );
						updateSetting( 'popular_searches', fromPopularSearchesText( value ) );
					} }
				/>
			</Card.Content>
		</Card.Root>
	);
};

/**
 * The three site-level switches Search Cloud reports under `features`. Each one
 * is only offered when the plan and platform allow it — the API rejects
 * enabling an unavailable feature with a field error, so the checkbox says why
 * up front rather than letting the save fail.
 *
 * @param {Object}   props
 * @param {Object}   props.features
 * @param {Object}   props.errors
 * @param {Function} props.onChange Called with (key, enabled).
 */
const FeaturesCard = ( { features, errors, onChange } ) => {
	const statusLabels = AI_STATUS_LABELS();
	const ai = features.ai_search;
	const unavailable = __( 'Your plan does not include this.', 'webhead-search-cloud' );

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<CardHeading
				title={ __( 'AI & ranking', 'webhead-search-cloud' ) }
				description={ __(
					'Site-level switches that change how results are found and ordered. These are the same switches as in the Search Cloud panel.',
					'webhead-search-cloud'
				) }
			/>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="column" gap="lg" className="whsc-feature-switches">
					{ /* The index status is reported under its checkbox rather than
					     as its description, so it reads as live state. */ }
					<Stack direction="column" gap="xs">
						<CheckboxControl
							label={ __( 'AI search', 'webhead-search-cloud' ) }
							description={
								featureError( errors, 'ai_search' )
								|| ( ai.available
									? __(
										'Searches return hybrid keyword + semantic results. Turning this on starts a background re-index of your catalogue; turning it off is instant and keeps keyword search working.',
										'webhead-search-cloud'
									)
									: unavailable )
							}
							checked={ Boolean( ai.enabled ) }
							disabled={ ! ai.available && ! ai.enabled }
							onCheckedChange={ ( enabled ) => onChange( 'ai_search', Boolean( enabled ) ) }
						/>

						{ ai.enabled && '' !== ai.status && (
							<Text variant="body-sm" className="whsc-search-config-status">
								{ sprintf(
									/* translators: %s: index status, e.g. "Ready". */
									__( 'Index status: %s', 'webhead-search-cloud' ),
									statusLabels[ ai.status ] || ai.status
								) }
							</Text>
						) }
					</Stack>

					<CheckboxControl
						label={ __( 'AI visual tagging', 'webhead-search-cloud' ) }
						description={
							featureError( errors, 'visual_tagging' )
							|| ( features.visual_tagging.available
								? __(
									'A vision model describes each product image and adds the tags to the document, so sparsely-described products still turn up. Applied as you sync - re-sync to tag products already indexed.',
									'webhead-search-cloud'
								)
								: unavailable )
						}
						checked={ Boolean( features.visual_tagging.enabled ) }
						disabled={ ! features.visual_tagging.available && ! features.visual_tagging.enabled }
						onCheckedChange={ ( enabled ) => onChange( 'visual_tagging', Boolean( enabled ) ) }
					/>

					<CheckboxControl
						label={ __( 'Search by photo', 'webhead-search-cloud' ) }
						description={
							featureError( errors, 'visual_search' )
							|| ( features.visual_search.available
								? __(
									'Shoppers can upload a photo instead of typing: a vision model describes what it sees and searches for that. A camera button appears in the search box once this is on.',
									'webhead-search-cloud'
								)
								: unavailable )
						}
						checked={ Boolean( features.visual_search.enabled ) }
						disabled={ ! features.visual_search.available && ! features.visual_search.enabled }
						onCheckedChange={ ( enabled ) => onChange( 'visual_search', Boolean( enabled ) ) }
					/>

					<CheckboxControl
						label={ __( 'Rank results by what visitors click', 'webhead-search-cloud' ) }
						description={
							featureError( errors, 'personalization' )
							|| __(
								'Results people click most for a search rise for everyone searching it. Relevance still leads - popular results are only nudged up.',
								'webhead-search-cloud'
							)
						}
						checked={ Boolean( features.personalization.enabled ) }
						disabled={ ! features.personalization.available && ! features.personalization.enabled }
						onCheckedChange={ ( enabled ) => onChange( 'personalization', Boolean( enabled ) ) }
					/>
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

/**
 * Per-search curation: pin products to the top, keep products out, and show a
 * banner. An empty trigger applies the rule to every search, which is how a
 * product is hidden site-wide.
 *
 * @param {Object}   props
 * @param {Array}    props.rules
 * @param {Function} props.onChange Called with the full replacement list.
 */
const MerchandisingCard = ( { rules, errors, onChange } ) => {
	const update = ( index, next ) => onChange( rules.map( ( rule, i ) => ( i === index ? next : rule ) ) );
	const remove = ( index ) => onChange( rules.filter( ( _, i ) => i !== index ) );
	// Every field the normalizer produces, or the new row's category-trigger
	// inputs are uncontrolled and show whatever the row at this index held.
	const add = () => onChange( [
		...rules,
		{ query: '', filter_field: '', filter_value: '', pinned: [], hidden: [], banner: '' },
	] );

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted whsc-settings-card--wide">
			<CardHeading
				title={ __( 'Merchandising rules', 'webhead-search-cloud' ) }
				description={ __(
					'Curate the results of chosen searches. Leave the trigger empty to apply a rule to every search - that is how you keep a product out of search everywhere.',
					'webhead-search-cloud'
				) }
			/>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="column" gap="lg">
					{ rules.map( ( rule, index ) => (
						// A rule holds five fields, so it is a card of its own: one
						// level down from the card it is in.
						<Card.Root className="whsc-card whsc-card--secondary whsc-merchandising-rule" key={ index }>
							<Card.Header className="whsc-card__header">
								<Stack direction="row" gap="md" justify="space-between" align="center">
									<Card.Title render={ <h4 /> }>
										{ sprintf(
											/* translators: %d: the rule's position in the list. */
											__( 'Rule %d', 'webhead-search-cloud' ),
											index + 1
										) }
									</Card.Title>
									<Button
										size="compact"
										icon={ trash }
										isDestructive
										variant="tertiary"
										label={ __( 'Remove rule', 'webhead-search-cloud' ) }
										onClick={ () => remove( index ) }
									/>
								</Stack>
							</Card.Header>
							<Card.Content className="whsc-card__content">
								<Stack direction="column" gap="md">
									<InputControl
										label={ __( 'Trigger (search term contains)', 'webhead-search-cloud' ) }
										description={ rowError( errors, 'merchandising', index, 'query' )
											|| ( '' === rule.query
												? __( 'Empty: this rule applies to every search on the site.', 'webhead-search-cloud' )
												: undefined ) }
										value={ rule.query }
										onValueChange={ ( query ) => update( index, { ...rule, query } ) }
									/>
									{ /* The optional category trigger. Both halves are needed
									     for either to mean anything, so they sit together. */ }
									<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
										<InputControl
											label={ __( 'Also require filter (field)', 'webhead-search-cloud' ) }
											list="whsc-field-suggestions"
											description={ rowError( errors, 'merchandising', index, 'filter_field' )
												|| __( 'Optional. A facet field, e.g. "categories".', 'webhead-search-cloud' ) }
											value={ rule.filter_field }
											onValueChange={ ( filter_field ) => update( index, { ...rule, filter_field } ) }
										/>
										<InputControl
											label={ __( 'Filter value', 'webhead-search-cloud' ) }
											description={ rowError( errors, 'merchandising', index, 'filter_value' )
												|| __(
													'With a field, the rule fires on that listing page - leave the trigger empty to curate the page itself.',
													'webhead-search-cloud'
												) }
											value={ rule.filter_value }
											onValueChange={ ( filter_value ) => update( index, { ...rule, filter_value } ) }
										/>
									</Grid>
									<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
										<InputControl
											label={ __( 'Pin to top (document ids)', 'webhead-search-cloud' ) }
											description={ listError( errors, 'merchandising', index, 'pinned' )
												|| __( 'Comma-separated, in the order they should appear.', 'webhead-search-cloud' ) }
											value={ idsToText( rule.pinned ) }
											onValueChange={ ( value ) => update( index, { ...rule, pinned: textToIds( value ) } ) }
										/>
										<InputControl
											label={ __( 'Hide (document ids)', 'webhead-search-cloud' ) }
											description={ listError( errors, 'merchandising', index, 'hidden' )
												|| __( 'Comma-separated. Kept out of the results entirely.', 'webhead-search-cloud' ) }
											value={ idsToText( rule.hidden ) }
											onValueChange={ ( value ) => update( index, { ...rule, hidden: textToIds( value ) } ) }
										/>
									</Grid>
									<InputControl
										label={ __( 'Promotional banner', 'webhead-search-cloud' ) }
										description={ rowError( errors, 'merchandising', index, 'banner' )
											|| __( 'Optional message returned with the results for this search.', 'webhead-search-cloud' ) }
										value={ rule.banner }
										onValueChange={ ( banner ) => update( index, { ...rule, banner } ) }
									/>
								</Stack>
							</Card.Content>
						</Card.Root>
					) ) }
					<Stack direction="row" gap="sm">
						<Button __next40pxDefaultSize variant="secondary" onClick={ add }>
							{ __( 'Add a rule', 'webhead-search-cloud' ) }
						</Button>
					</Stack>
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

/**
 * Send a search straight to a page instead of running it. For the lookups
 * where a results list is the wrong answer - a promo term, a support page, a
 * campaign landing page.
 *
 * @param {Object}   props
 * @param {Array}    props.rules
 * @param {Object}   props.errors
 * @param {Function} props.onChange Called with the full replacement list.
 */
const RedirectsCard = ( { rules, errors, onChange } ) => {
	const update = ( index, next ) => onChange( rules.map( ( rule, i ) => ( i === index ? next : rule ) ) );
	const remove = ( index ) => onChange( rules.filter( ( _, i ) => i !== index ) );
	const add = () => onChange( [ ...rules, { query: '', url: '' } ] );

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted whsc-settings-card--wide">
			<CardHeading
				title={ __( 'Search redirects', 'webhead-search-cloud' ) }
				description={ __(
					'Send a search straight to a page instead of showing results. The term has to match exactly - capitalisation and surrounding spaces are ignored, but "black friday" will not fire on "black friday deals".',
					'webhead-search-cloud'
				) }
			/>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="column" gap="lg">
					{ /* A redirect is two fields and a delete, so it stays on one row
					     rather than borrowing the merchandising rule's card. */ }
					{ rules.map( ( rule, index ) => (
						<div className="whsc-redirect-rule" key={ index }>
							<InputControl
								label={ __( 'Search term (exact)', 'webhead-search-cloud' ) }
								description={ rowError( errors, 'redirects', index, 'query' ) }
								value={ rule.query }
								onValueChange={ ( query ) => update( index, { ...rule, query } ) }
							/>
							<InputControl
								label={ __( 'Send them to', 'webhead-search-cloud' ) }
								description={ rowError( errors, 'redirects', index, 'url' )
									|| __( 'A full URL, or a path on this site starting with /.', 'webhead-search-cloud' ) }
								value={ rule.url }
								onValueChange={ ( url ) => update( index, { ...rule, url } ) }
							/>
							<div className="whsc-row-remove">
								<Button
									__next40pxDefaultSize
									icon={ trash }
									isDestructive
									variant="tertiary"
									label={ __( 'Remove redirect', 'webhead-search-cloud' ) }
									onClick={ () => remove( index ) }
								/>
							</div>
						</div>
					) ) }
					<Stack direction="row" gap="sm">
						<Button __next40pxDefaultSize variant="secondary" onClick={ add }>
							{ __( 'Add a redirect', 'webhead-search-cloud' ) }
						</Button>
					</Stack>
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

const reasonOf = ( error ) =>
	error?.message || __( 'the request to the REST API failed.', 'webhead-search-cloud' );

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
	const [ loadError, setLoadError ] = useState( null );
	const [ saveError, setSaveError ] = useState( null );
	const [ loadAttempt, setLoadAttempt ] = useState( 0 );
	const [ fieldErrors, setFieldErrors ] = useState( {} );
	// `null` limit means unlimited. A failed connection test (e.g. credentials
	// not saved yet) just leaves this uncapped rather than blocking the tab.
	const [ languageLimit, setLanguageLimit ] = useState( null );

	useEffect( () => {
		let isCurrentAttempt = true;

		const load = async () => {
			try {
				const [ configResponse, catalogResponse ] = await Promise.all( [
					apiFetch( { path: SEARCH_CONFIG_PATH } ),
					apiFetch( { path: INDEXING_CONFIG_PATH } ),
				] );

				if ( ! isCurrentAttempt ) {
					return;
				}

				const normalized = normalizeConfig( configResponse );
				normalized.type_boosts = syncTypeBoosts(
					normalized.type_boosts,
					Object.keys( enabledTypeLabels( catalogResponse ) )
				);

				setCatalog( catalogResponse );
				setConfig( normalized );
				setPersistedConfig( normalized );
				setLoadError( null );
			} catch ( error ) {
				// With no configuration there is nothing to draw: the reason is
				// shown in place of the tab, with a way to ask again. It used to
				// be set on a notice the placeholder never made room for.
				if ( isCurrentAttempt ) {
					setLoadError( reasonOf( error ) );
				}
			} finally {
				if ( isCurrentAttempt ) {
					setIsLoading( false );
				}
			}

			try {
				const connection = await apiFetch( { path: TEST_CONNECTION_PATH, method: 'POST' } );

				if ( isCurrentAttempt && connection?.ok ) {
					setLanguageLimit( connection.languages?.limit ?? null );
				}
			} catch ( error ) {
				// Non-fatal — the language picker just stays uncapped client-side
				// until a successful connection test reports the plan's limit.
			}
		};

		setIsLoading( true );
		void load();

		return () => {
			isCurrentAttempt = false;
		};
	}, [ loadAttempt ] );

	const indexed = useMemo( () => indexedFields( catalog ), [ catalog ] );
	const pool = indexed ?? [];
	const typeLabels = useMemo( () => enabledTypeLabels( catalog ), [ catalog ] );
	const hasSearchConfigChanges = JSON.stringify( config ) !== JSON.stringify( persistedConfig );
	const hasUnsavedChanges = hasSearchConfigChanges || hasUnsavedPopularSearches;

	const set = ( key, value ) => {
		setSaveError( null );
		setConfig( ( current ) => ( { ...current, [ key ]: value } ) );
	};

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
	// Searches. Runs whichever half actually changed and reports once: a toast
	// when all of it was stored, one notice beside the button when not.
	const onSave = async () => {
		setIsSaving( true );
		setSaveError( null );
		setFieldErrors( {} );

		const failures = [];
		let savedSomething = false;

		if ( hasSearchConfigChanges ) {
			try {
				const response = await apiFetch( {
					path: SEARCH_CONFIG_PATH,
					method: 'PUT',
					data: toPayload( config ),
				} );

				const normalized = normalizeConfig( response );
				normalized.type_boosts = syncTypeBoosts( normalized.type_boosts, Object.keys( typeLabels ) );

				setConfig( normalized );
				setPersistedConfig( normalized );
				savedSomething = true;
			} catch ( error ) {
				failures.push( sprintf(
					/* translators: %s: reason the save failed, as reported by the REST API. */
					__( 'The search configuration could not be saved: %s', 'webhead-search-cloud' ),
					reasonOf( error )
				) );
				setFieldErrors( error?.errors && 'object' === typeof error.errors ? error.errors : {} );
			}
		}

		if ( hasUnsavedPopularSearches ) {
			if ( await savePopularSearches() ) {
				savedSomething = true;
			} else {
				failures.push( __( 'The popular searches could not be saved.', 'webhead-search-cloud' ) );
			}
		}

		setIsSaving( false );

		if ( 0 === failures.length ) {
			showToast( __( 'Search configuration saved.', 'webhead-search-cloud' ), 'success' );

			return;
		}

		// A partial save is one message: what still needs attention, and that
		// the rest was stored.
		setSaveError(
			savedSomething
				? [ ...failures, __( 'Everything else was saved.', 'webhead-search-cloud' ) ].join( ' ' )
				: failures.join( ' ' )
		);
	};

	if ( isLoading ) {
		return <IndexingSkeleton label={ __( 'Loading the search configuration', 'webhead-search-cloud' ) } />;
	}

	if ( loadError || ! config ) {
		return (
			<Notice.Root intent="error">
				<Notice.Description>
					{ sprintf(
						/* translators: %s: reason the request failed. */
						__( 'The search configuration could not be loaded: %s', 'webhead-search-cloud' ),
						loadError || __( 'the request to the REST API failed.', 'webhead-search-cloud' )
					) }
				</Notice.Description>
				<Notice.Actions>
					<Notice.ActionButton onClick={ () => setLoadAttempt( ( attempt ) => attempt + 1 ) }>
						{ __( 'Try again', 'webhead-search-cloud' ) }
					</Notice.ActionButton>
				</Notice.Actions>
			</Notice.Root>
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
		<Stack direction="column" gap="lg" className="webhead-search-cloud-search-config">
			<TabIntro
				title={ __( 'Search configuration', 'webhead-search-cloud' ) }
				description={ __(
					"Controls how Search Cloud itself ranks and filters your content - which fields it searches and how heavily, per-type ranking boosts, which fields power facets and suggestions, and synonyms. Most of this lives on Search Cloud's side, not in this plugin's own settings, so changes take effect on the very next search.",
					'webhead-search-cloud'
				) }
			/>

			<Grid className="whsc-settings-grid" columns={ { base: 1, md: 2 } } gap="var(--wpds-dimension-gap-xl)" align="start">
				<FeaturesCard
					features={ config.features }
					errors={ fieldErrors }
					onChange={ ( key, enabled ) =>
						set( 'features', {
							...config.features,
							[ key ]: { ...config.features[ key ], enabled },
						} )
					}
				/>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Searchable fields & weights', 'webhead-search-cloud' ) }
						description={ __(
							'Which fields full-text search matches, and how much each one counts (1-100). A higher weight on "title" makes title matches outrank body-text matches, for example.',
							'webhead-search-cloud'
						) }
					/>
					<Card.Content className="whsc-settings-card-content">
						<Stack direction="column" gap="md">
							{ config.searchable_fields.map( ( row, index ) => (
								<div className="whsc-search-config-row" key={ index }>
									<InputControl
										label={ __( 'Field', 'webhead-search-cloud' ) }
										list="whsc-field-suggestions"
										value={ row.field }
										description={ rowError( fieldErrors, 'searchable_fields', index, 'field' ) }
										onValueChange={ ( field ) => updateSearchableField( index, { ...row, field } ) }
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
										__next40pxDefaultSize
										icon={ trash }
										isDestructive
										variant="tertiary"
										label={ __( 'Remove field', 'webhead-search-cloud' ) }
										onClick={ () => removeSearchableField( index ) }
									/>
								</div>
							) ) }
							<Stack direction="row" gap="sm">
								<Button __next40pxDefaultSize variant="secondary" onClick={ addSearchableField }>
									{ __( 'Add a field', 'webhead-search-cloud' ) }
								</Button>
							</Stack>
						</Stack>
					</Card.Content>
				</Card.Root>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Type boosts', 'webhead-search-cloud' ) }
						description={ __(
							'Ranking boost per content type (0.1-100). Above 1 ranks that type higher overall; below 1 ranks it lower. One row per content type currently enabled in Indexing.',
							'webhead-search-cloud'
						) }
					/>
					<Card.Content className="whsc-settings-card-content">
						{ config.type_boosts.length > 0 ? (
							<Stack direction="column" gap="md">
								{ config.type_boosts.map( ( row, index ) => (
									<div className="whsc-search-config-row whsc-search-config-row--boost" key={ row.type }>
										{ /* A caption and a value standing in for the read-only
										     "Type" column: a disabled field reads as a broken
										     input rather than as a name. */ }
										<Stack direction="column" gap="xs" className="whsc-search-config-type-label">
											<Text variant="body-sm" className="whsc-search-config-type-label__caption">
												{ __( 'Type', 'webhead-search-cloud' ) }
											</Text>
											<Text className="whsc-search-config-type-label__value">
												{ typeLabels[ row.type ] || row.type }
											</Text>
										</Stack>
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
							</Stack>
						) : (
							<Notice.Root intent="info">
								<Notice.Description>
									{ __(
										'Enable at least one content type in the Indexing tab to set a type boost.',
										'webhead-search-cloud'
									) }
								</Notice.Description>
							</Notice.Root>
						) }
					</Card.Content>
				</Card.Root>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Facet fields', 'webhead-search-cloud' ) }
						description={ __(
							'Fields returned as facets on search results and allowed as filters. Click the field to browse every available field, or type to search.',
							'webhead-search-cloud'
						) }
					/>
					<Card.Content className="whsc-settings-card-content">
						<Stack direction="column" gap="md" className="whsc-token-field">
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
							<UnindexedFieldsNotice
								fields={ unindexedFields( config.facet_fields, indexed ) }
								message={ unindexedFacetMessage }
							/>
						</Stack>
					</Card.Content>
				</Card.Root>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Suggest fields', 'webhead-search-cloud' ) }
						description={ __(
							'Fields queried for search-as-you-type suggestions. Defaults to "title" when left empty. Click to browse, or type to search.',
							'webhead-search-cloud'
						) }
					/>
					<Card.Content className="whsc-settings-card-content">
						<Stack direction="column" gap="md" className="whsc-token-field">
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
							<UnindexedFieldsNotice
								fields={ unindexedFields( config.suggest_fields, indexed ) }
								message={ unindexedSuggestMessage }
							/>
						</Stack>
					</Card.Content>
				</Card.Root>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Synonyms', 'webhead-search-cloud' ) }
						description={ __(
							'Treats words as interchangeable during search, even when the exact word a visitor types never appears in a result. For example, a line with "sneaker, trainer" means searching "sneaker" also matches results that only mention "trainer", and vice versa - useful for regional spelling or naming differences.',
							'webhead-search-cloud'
						) }
					/>
					<Card.Content className="whsc-settings-card-content">
						<TextareaControl
							label={ __( 'Synonyms', 'webhead-search-cloud' ) }
							hideLabelFromVision
							description={ __( 'One comma-separated group of interchangeable words per line, e.g. "sneaker, trainer".', 'webhead-search-cloud' ) }
							value={ config.synonyms.join( '\n' ) }
							onValueChange={ ( value ) =>
								set(
									'synonyms',
									value.split( '\n' ).map( ( line ) => line.trim() ).filter( ( line ) => '' !== line )
								)
							}
						/>
					</Card.Content>
				</Card.Root>

				<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
					<CardHeading
						title={ __( 'Languages', 'webhead-search-cloud' ) }
						description={ catalog?.languages?.active
							? ( null !== languageLimit
								? sprintf(
									/* translators: %d: number of languages the plan allows. */
									__( 'Which of this site\'s languages to index and search. Your plan allows up to %d.', 'webhead-search-cloud' ),
									languageLimit
								)
								: __( 'Which of this site\'s languages to index and search. Leave every language unchecked for unrestricted.', 'webhead-search-cloud' ) )
							: __( 'No WPML/Polylang installation was detected, so languages can only be entered manually here. Leave empty for unrestricted.', 'webhead-search-cloud' ) }
					/>
					<Card.Content className="whsc-settings-card-content">
						<Stack direction="column" gap="md">
							{ catalog?.languages?.active ? (
								<Grid auto={ 170 } rowGap="var(--wpds-dimension-gap-sm)" columnGap="var(--wpds-dimension-gap-xl)" align="start">
									{ ( catalog?.languages?.available || [] ).map( ( language ) => (
										<CheckboxControl
											key={ language.code }
											label={ `${ language.name } (${ language.code })` }
											checked={ config.languages.includes( language.code ) }
											disabled={ ! config.languages.includes( language.code ) && atLanguageLimit }
											onCheckedChange={ ( checked ) => toggleLanguage( language.code, Boolean( checked ) ) }
										/>
									) ) }
								</Grid>
							) : (
								<InputControl
									label={ __( 'Languages', 'webhead-search-cloud' ) }
									hideLabelFromVision
									description={ __( 'Comma-separated ISO language codes, e.g. "de, en".', 'webhead-search-cloud' ) }
									value={ config.languages.join( ', ' ) }
									onValueChange={ ( value ) =>
										set(
											'languages',
											value.split( ',' ).map( ( code ) => code.trim() ).filter( ( code ) => '' !== code )
										)
									}
								/>
							) }

							{ Array.isArray( fieldErrors?.languages ) && fieldErrors.languages.length > 0 && (
								<Notice.Root intent="error">
									<Notice.Description>{ fieldErrors.languages.join( ' ' ) }</Notice.Description>
								</Notice.Root>
							) }
						</Stack>
					</Card.Content>
				</Card.Root>

				<PopularSearchesCard />

				<MerchandisingCard
					rules={ config.merchandising }
					errors={ fieldErrors }
					onChange={ ( rules ) => set( 'merchandising', rules ) }
				/>

				<RedirectsCard
					rules={ config.redirects }
					errors={ fieldErrors }
					onChange={ ( rules ) => set( 'redirects', rules ) }
				/>
			</Grid>

			{ saveError && (
				<Notice.Root intent="error">
					<Notice.Description>{ saveError }</Notice.Description>
					<Notice.CloseIcon onClick={ () => setSaveError( null ) } />
				</Notice.Root>
			) }

			<Stack direction="row" gap="md" align="center" wrap="wrap" className="whsc-save-bar">
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
			</Stack>

			{ /* What the field inputs above offer as they are typed in. */ }
			<datalist id="whsc-field-suggestions">
				{ pool.map( ( field ) => <option key={ field } value={ field } /> ) }
			</datalist>
		</Stack>
	);
};

export default SearchConfigTab;
