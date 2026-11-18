import { useContext, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
	FormTokenField,
	RangeControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { Card, CheckboxControl, Fieldset, InputControl, Link, Notice, SelectControl, Stack, Text, TextareaControl } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';
import { trash } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

import SettingsContext from '../../../../settings/store/context';
import {
	changedSince,
	enabledTypeLabels,
	repeatsRedirect,
	errorsUnder,
	FIELD_LIST_MAX,
	idsToText,
	listError,
	normalizeConfig,
	numberFieldChoices,
	PROFIT_RULES_MAX,
	PROFIT_STRENGTH_MAX,
	PROFIT_TERMS_MAX,
	profitRankingProblems,
	profitRulesSent,
	sendsPurchasePrice,
	termsToText,
	textToIds,
	textToTerms,
	toPayload,
	typedNumber,
	variantFieldChoices,
} from '../../searchConfig';
import { useStatisticsUrl } from '../../plan';
import { indexedFields, unindexedFields } from '../../indexedFields';
import { selectProps } from '../../../../utils/select';
import { Grid } from '../../../../components/Layout';
import SectionList from '../../../../components/SectionList';
import { showToast } from '../../../../toast';
import TabIntro from '../TabIntro';
import PlainSection from '../PlainSection';
import IndexingSkeleton from './IndexingSkeleton';
import { useAnnounce } from '../../../../utils/announce';
import { forget, readOnce } from '../../remote';

const pluginData = window.searcioData || {};
const SEARCH_CONFIG_PATH =
	pluginData?.api?.searchConfigPath || '/searcio/v1/search-config';
const INDEXING_CONFIG_PATH =
	pluginData?.api?.indexingConfigPath || '/searcio/v1/indexing/config';
const TEST_CONNECTION_PATH =
	pluginData?.api?.testConnectionPath || '/searcio/v1/connection/test';

/**
 * One editable boost row per content type this site indexes, preserving any
 * value already configured.
 *
 * Boosts for types this WordPress does not index are kept and passed through
 * untouched. `PUT /search-config` replaces the whole section, so rebuilding the
 * list from local post types alone would delete a boost set in the panel for a
 * type that lives somewhere else - another store on the same index, or a type
 * that was disabled here temporarily. Not one of 1: that boost changes
 * nothing, and a type a content type was renamed from ("post" once the type
 * is called "artikel") only added a row that moved no result.
 */
const syncTypeBoosts = ( typeBoosts, enabledTypes ) => {
	const existing = new Map( typeBoosts.map( ( row ) => [ row.type, row.boost ] ) );
	const local = enabledTypes.map( ( type ) => ( {
		type,
		boost: existing.has( type ) ? existing.get( type ) : 1,
	} ) );

	const foreign = typeBoosts.filter( ( row ) => ! enabledTypes.includes( row.type ) && 1 !== Number( row.boost ) );

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
		'searcio'
	),
	quoted
);

const unindexedSearchableMessage = ( quoted, count ) => sprintf(
	/* translators: %s: one or more quoted field names, e.g. "category". */
	_n(
		'No document on this site has a %s field, so searching it finds nothing. Choose a field from the list, or start indexing it in the Indexing tab.',
		'No document on this site has the fields %s, so searching them finds nothing. Choose fields from the list, or start indexing them in the Indexing tab.',
		count,
		'searcio'
	),
	quoted
);

const unindexedSuggestMessage = ( quoted, count ) => sprintf(
	/* translators: %s: one or more quoted field names, e.g. "category". */
	_n(
		'No document on this site has a %s field, so it will never add a suggestion. Choose a field from the list, or start indexing it in the Indexing tab.',
		'No document on this site has the fields %s, so they will never add a suggestion. Choose fields from the list, or start indexing them in the Indexing tab.',
		count,
		'searcio'
	),
	quoted
);

/**
 * A facet field as the token field shows it. The categories come as two
 * fields, and the key of the one the filter draws as a tree does not say so.
 *
 * @param {string} field
 * @return {string}
 */
const facetFieldText = ( field ) => ( 'category_paths' === field
	? sprintf(
		/* translators: %s: the key of a field, "category_paths". */
		__( '%s (categories as a tree)', 'searcio' ),
		field
	)
	: field );

/**
 * The plugin's own words for what a person can get wrong in these fields.
 * Searcio answers in its own language - German, in an English screen - and
 * names the field by its key: "Das Format des Feldes redirects.3.url ist
 * ungültig."
 *
 * @return {Object<string,string>} `section.column` => message.
 */
const OWN_ERRORS = () => ( {
	'redirects.url': __( 'Enter a full address that starts with https://, or a path on this site that starts with /.', 'searcio' ),
	'searchable_fields.weight': __( 'Enter a weight from 1 to 100.', 'searcio' ),
	'type_boosts.boost': __( 'Enter a boost from 0.1 to 100.', 'searcio' ),
	'profit_ranking.strength': __( 'Enter a strength from 1 to 50.', 'searcio' ),
	'profit_ranking.target': __( 'Enter a target margin from 0.1 to 100.', 'searcio' ),
	'profit_ranking.min_profit': __( 'Enter an amount of 0 or more, or leave it empty.', 'searcio' ),
	'profit_ranking.excluded_terms': __( 'Enter up to 200 terms, one per line.', 'searcio' ),
	'profit_ranking.rules.field': __( 'Enter the field the products have, such as categories.', 'searcio' ),
	'profit_ranking.rules.value': __( 'Enter the value the products have in that field.', 'searcio' ),
	'profit_ranking.rules.target': __( 'Enter a target margin from 0.1 to 100, or tick Never lift.', 'searcio' ),
} );

/** Errors use `searchable_fields.0.field` style keys; map back to a row + column. */
const rowError = ( errors, section, index, column ) => {
	const key = `${ section }.${ index }.${ column }`;
	const messages = errors?.[ key ];

	if ( ! Array.isArray( messages ) ) {
		return undefined;
	}

	return OWN_ERRORS()[ `${ section }.${ column }` ] || messages.join( ' ' );
};

/** The plugin's words for what Searcio reported under one key, or Searcio's own where it has none. */
const fieldError = ( errors, key ) => {
	const messages = errors?.[ key ];

	return Array.isArray( messages ) ? OWN_ERRORS()[ key ] || messages.join( ' ' ) : undefined;
};

/**
 * Why a save failed, for the notice beside the button: the fields that need
 * attention say so under themselves, in the plugin's words, so the notice
 * does not repeat Searcio's.
 */
const saveFailure = ( error ) => ( error?.errors && 'object' === typeof error.errors && Object.keys( error.errors ).length > 0
	? __( 'Some fields need a change: see the messages under them.', 'searcio' )
	: reasonOf( error ) );

/** Feature errors come back as `features.ai_search.enabled`. */
const featureError = ( errors, key ) => {
	const messages = errors?.[ `features.${ key }.enabled` ];

	return Array.isArray( messages ) ? messages.join( ' ' ) : undefined;
};

const AI_STATUS_LABELS = () => ( {
	pending: __( 'Preparing…', 'searcio' ),
	indexing: __( 'Indexing…', 'searcio' ),
	ready: __( 'Ready', 'searcio' ),
	failed: __( 'Failed', 'searcio' ),
} );

const toPopularSearchesText = ( value ) => ( Array.isArray( value ) ? value.join( '\n' ) : '' );

const fromPopularSearchesText = ( text ) => text
	.split( '\n' )
	.map( ( line ) => line.trim() )
	.filter( ( line ) => '' !== line );

/**
 * How the search window's category filter lists the categories. Persists
 * through the settings store, as the Popular Searches card below does, and
 * shares this tab's save button.
 */
const CategoryFilterCard = () => {
	const { settings, updateSetting } = useContext( SettingsContext );
	const mode = settings.category_filter || 'all';
	const order = settings.category_filter_order || 'shop';
	const items = [
		{ value: 'all', label: __( 'All categories, in one list', 'searcio' ) },
		{ value: 'main', label: __( 'Main categories only', 'searcio' ) },
		{ value: 'nested', label: __( 'Main categories with their subcategories under them', 'searcio' ) },
	];
	const orders = [
		{ value: 'shop', label: __( 'As sorted in WooCommerce', 'searcio' ) },
		{ value: 'name', label: __( 'By name', 'searcio' ) },
		{ value: 'count', label: __( 'By number of products', 'searcio' ) },
	];

	return (
		<PlainSection
			title={ __( 'Category filter', 'searcio' ) }
			description={ __( 'How the search window lists your categories in its filter. Picking a main category finds what is in its subcategories too.', 'searcio' ) }
		>
			<Stack direction="column" gap="md">
				<SelectControl
					label={ __( 'Categories to show', 'searcio' ) }
					{ ...selectProps( items, mode, ( value ) => updateSetting( 'category_filter', value || 'all' ) ) }
				/>
				{ 'nested' === mode && (
					<InputControl
						type="number"
						min={ 2 }
						max={ 10 }
						label={ __( 'Levels to show', 'searcio' ) }
						description={ __( 'Counts the main categories as the first level, so 2 shows them and their direct subcategories.', 'searcio' ) }
						value={ String( settings.category_filter_depth ?? 2 ) }
						onValueChange={ ( value ) => updateSetting( 'category_filter_depth', Number( value ) || 2 ) }
					/>
				) }
				<SelectControl
					label={ __( 'Order of the categories', 'searcio' ) }
					description={ __( 'Drag them into order under Products > Categories in WooCommerce.', 'searcio' ) }
					{ ...selectProps( orders, order, ( value ) => updateSetting( 'category_filter_order', value || 'shop' ) ) }
				/>
			</Stack>
		</PlainSection>
	);
};

/**
 * The synonyms, one group per line. The text is kept as it is typed and only
 * the list for Searcio is cleaned: rebuilt from that list on every key, the
 * field dropped a new line as soon as Enter made it, and the space after a
 * comma with it, so a second group could not be typed.
 *
 * @param {Object}        props
 * @param {Array<string>} props.synonyms The groups, as Searcio keeps them.
 * @param {Function}      props.onChange Called with the cleaned groups.
 */
const SynonymsField = ( { synonyms, onChange } ) => {
	const [ text, setText ] = useState( () => termsToText( synonyms ) );

	// The list as Searcio stored it, after a load or a save; what is being
	// typed is left alone.
	useEffect( () => {
		if ( JSON.stringify( textToTerms( text ) ) !== JSON.stringify( synonyms || [] ) ) {
			setText( termsToText( synonyms ) );
		}
	}, [ synonyms ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<TextareaControl
			label={ __( 'Synonyms', 'searcio' ) }
			hideLabelFromVision
			description={ __( 'One comma-separated group of interchangeable words per line, e.g. "sneaker, trainer".', 'searcio' ) }
			value={ text }
			onValueChange={ ( value ) => {
				setText( value );
				onChange( textToTerms( value ) );
			} }
		/>
	);
};

/**
 * Moved here from its own tab per admin feedback - it's a curated fallback
 * for the same search behavior this whole tab configures, so it belongs
 * alongside it rather than as a separate destination. Persists through the
 * generic settings store (a local WP option), not the `/search-config` PUT
 * the rest of this tab uses - but shares this tab's single save button
 * (per admin feedback, a page should not show two separate save actions);
 * `SearchConfigTab` calls the settings store's own `saveSettings()`
 * alongside its `/search-config` PUT.
 *
 * The terms never offered as popular searches are Searcio's, and go with the
 * `/search-config` PUT; they are offered only once Searcio reports the list.
 *
 * @param {Object}        props
 * @param {string[]|null} props.excluded The excluded terms, or null.
 * @param {Object}        props.errors   The API's field errors.
 * @param {Function}      props.onExcludedChange Called with the terms.
 */
const PopularSearchesCard = ( { excluded, errors, onExcludedChange } ) => {
	const { settings, updateSetting, isLoading } = useContext( SettingsContext );

	const [ popularSearchesText, setPopularSearchesText ] = useState( '' );
	const popularSearchesInit = useRef( false );
	const [ excludedText, setExcludedText ] = useState( () => termsToText( excluded ) );

	// The list as Searcio stored it, once a save has trimmed it or dropped a
	// duplicate; what is being typed is left alone.
	useEffect( () => {
		if ( JSON.stringify( textToTerms( excludedText ) ) !== JSON.stringify( excluded || [] ) ) {
			setExcludedText( termsToText( excluded ) );
		}
	}, [ excluded ] ); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isLoading || popularSearchesInit.current ) {
			return;
		}

		setPopularSearchesText( toPopularSearchesText( settings.popular_searches ) );
		popularSearchesInit.current = true;
	}, [ isLoading, settings.popular_searches ] );

	return (
		<PlainSection
			title={ __( 'Popular searches', 'searcio' ) }
			description={ null === excluded
				? __(
					"A fallback list of queries shown as suggestions in the search modal before a visitor types anything. Searcio's own live popular searches are used whenever available; this list only takes over when that request comes back empty or fails.",
					'searcio'
				)
				: __(
					"The searches the search modal suggests before a visitor types anything. Searcio's own live popular searches come first; your fallback list takes over only when that request comes back empty or fails.",
					'searcio'
				) }
		>
			<Stack direction="column" gap="lg">
				<TextareaControl
					label={ null === excluded ? __( 'Popular searches', 'searcio' ) : __( 'Fallback list', 'searcio' ) }
					hideLabelFromVision={ null === excluded }
					description={ __( 'One query per line. Used as a fallback whenever live popular searches from Searcio are unavailable or empty.', 'searcio' ) }
					value={ popularSearchesText }
					onValueChange={ ( value ) => {
						setPopularSearchesText( value );
						updateSetting( 'popular_searches', fromPopularSearchesText( value ) );
					} }
				/>

				{ null !== excluded && (
					<TextareaControl
						label={ __( 'Never show as a popular search', 'searcio' ) }
						description={ errorsUnder( errors, 'excluded_popular_terms' ) || __(
							'One term per line, up to 200. Searcio leaves these out of its live popular searches, whatever their capitals. The same list is in the Searcio panel.',
							'searcio'
						) }
						value={ excludedText }
						onValueChange={ ( value ) => {
							setExcludedText( value );
							onExcludedChange( textToTerms( value ) );
						} }
					/>
				) }
			</Stack>
		</PlainSection>
	);
};

/**
 * The three site-level switches Searcio reports under `features`. Each one
 * is only offered when the plan and platform allow it - the API rejects
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
	const unavailable = __( 'Your plan does not include this.', 'searcio' );

	return (
		<PlainSection
			title={ __( 'AI & ranking', 'searcio' ) }
			description={ __(
				'Site-level switches that change how results are found and ordered. These are the same switches as in the Searcio panel.',
				'searcio'
			) }
		>
			<Stack direction="column" gap="lg" className="whsc-feature-switches">
				{ /* The index status is the checkbox's details, not part of its
				     description: it is live state, set under the description in
				     the same column as the label and in the same type. */ }
				<CheckboxControl
					label={ __( 'AI search', 'searcio' ) }
					description={
						featureError( errors, 'ai_search' )
						|| ( ai.available
							? __(
								'Searches return hybrid keyword + semantic results. Turning this on starts a background re-index of your catalogue; turning it off is instant and keeps keyword search working.',
								'searcio'
							)
							: unavailable )
					}
					details={
						ai.enabled && '' !== ai.status
							? sprintf(
								/* translators: %s: index status, e.g. "Ready". */
								__( 'Index status: %s', 'searcio' ),
								statusLabels[ ai.status ] || ai.status
							)
							: undefined
					}
					checked={ Boolean( ai.enabled ) }
					disabled={ ! ai.available && ! ai.enabled }
					onCheckedChange={ ( enabled ) => onChange( 'ai_search', Boolean( enabled ) ) }
				/>

				<CheckboxControl
					label={ __( 'AI visual tagging', 'searcio' ) }
					description={
						featureError( errors, 'visual_tagging' )
						|| ( features.visual_tagging.available
							? __(
								'A vision model describes each product image and adds the tags to the document, so sparsely-described products still turn up. Applied as you sync - re-sync to tag products already indexed.',
								'searcio'
							)
							: unavailable )
					}
					checked={ Boolean( features.visual_tagging.enabled ) }
					disabled={ ! features.visual_tagging.available && ! features.visual_tagging.enabled }
					onCheckedChange={ ( enabled ) => onChange( 'visual_tagging', Boolean( enabled ) ) }
				/>

				<CheckboxControl
					label={ __( 'Search by photo', 'searcio' ) }
					description={
						featureError( errors, 'visual_search' )
						|| ( features.visual_search.available
							? __(
								'Shoppers can upload a photo instead of typing: a vision model describes what it sees and searches for that. A camera button appears in the search box once this is on.',
								'searcio'
							)
							: unavailable )
					}
					checked={ Boolean( features.visual_search.enabled ) }
					disabled={ ! features.visual_search.available && ! features.visual_search.enabled }
					onCheckedChange={ ( enabled ) => onChange( 'visual_search', Boolean( enabled ) ) }
				/>

				<CheckboxControl
					label={ __( 'Rank results by what visitors click', 'searcio' ) }
					description={
						featureError( errors, 'personalization' )
						|| __(
							'Results people click most for a search rise for everyone searching it. Relevance still leads - popular results are only nudged up.',
							'searcio'
						)
					}
					checked={ Boolean( features.personalization.enabled ) }
					disabled={ ! features.personalization.available && ! features.personalization.enabled }
					onCheckedChange={ ( enabled ) => onChange( 'personalization', Boolean( enabled ) ) }
				/>
			</Stack>
		</PlainSection>
	);
};

/**
 * "Profitable products first": Searcio lifts products with a good margin
 * among the results that match a search about equally well. The same
 * settings as in the Searcio dashboard, which also shows their effect and
 * imports rules. It works the margin out from the purchase price each
 * product is indexed with, which the Indexing tab sends once its "Purchase
 * price, for profit ranking" is on: without it the ranking lifts nothing, and
 * the card says so.
 *
 * @param {Object}   props
 * @param {Object}   props.ranking            `profit_ranking`, normalized.
 * @param {Object}   props.errors
 * @param {boolean}  props.sendsPurchasePrice Whether the products are indexed with a purchase price.
 * @param {?Array}   props.indexed            The fields the documents carry, or null when unknown.
 * @param {boolean}  props.pricesWithTax      Whether the shop shows its prices with tax.
 * @param {Function} props.onChange           Called with the whole replacement.
 */
const ProfitRankingCard = ( { ranking, errors, sendsPurchasePrice, indexed, pricesWithTax, onChange } ) => {
	const statisticsUrl = useStatisticsUrl();
	const [ termsText, setTermsText ] = useState( () => termsToText( ranking.excluded_terms ) );
	const set = ( key, value ) => onChange( { ...ranking, [ key ]: value } );
	// A number while the field holds one, so that a value typed as it was
	// read is no change; what is being typed otherwise, for Searcio to judge.
	const typed = ( value ) => typedNumber( value ) ?? value;
	const rules = ranking.rules || [];
	const update = ( index, next ) => set( 'rules', rules.map( ( rule, i ) => ( i === index ? next : rule ) ) );
	const error = ( key ) => fieldError( errors, `profit_ranking.${ key }` );
	// Searcio counts a target's errors in the list it was sent, which has no
	// untouched row in it.
	const sent = profitRulesSent( rules );
	const rowMessage = ( index, column ) => ( -1 === sent.indexOf( index ) ? undefined : rowError( errors, 'profit_ranking.rules', sent.indexOf( index ), column ) );
	const unindexed = unindexedFields( rules.map( ( rule ) => rule.field ), indexed );
	// A Searcio that has the switch for listings also counts the least profit
	// per sale in the price without tax, which the plugin sends beside the
	// purchase price where the shop shows prices with tax.
	const hasListings = 'boolean' === typeof ranking.listings;

	// The terms as Searcio stored them, once a save has trimmed them; what is
	// being typed is left alone.
	useEffect( () => {
		if ( JSON.stringify( textToTerms( termsText ) ) !== JSON.stringify( ranking.excluded_terms || [] ) ) {
			setTermsText( termsToText( ranking.excluded_terms ) );
		}
	}, [ ranking.excluded_terms ] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<PlainSection
			className="whsc-profit-ranking"
			title={ __( 'Profitable products first', 'searcio' ) }
			description={ __( 'Lifts products with a good margin among the results that match a search about equally well. A much better match keeps its place, pinned products keep the top, and products out of stock stay last. The same settings as in the Searcio dashboard.', 'searcio' ) }
		>
			<Stack direction="column" gap="lg">
				<CheckboxControl
					label={ __( 'Lift profitable products', 'searcio' ) }
					description={ error( 'enabled' ) || __( 'Margins are worked out without tax: enter purchase prices without tax, and where the shop shows prices with tax it is added to them, so the margin comes out the same either way. Purchase prices are never shown.', 'searcio' ) }
					checked={ Boolean( ranking.enabled ) }
					onCheckedChange={ ( enabled ) => set( 'enabled', Boolean( enabled ) ) }
				/>

				{ ranking.enabled && ! sendsPurchasePrice && (
					<Notice.Root intent="warning">
						<Notice.Description>
							{ __( 'Nothing is lifted yet: the products are indexed without a purchase price. Turn on "Purchase price, for profit ranking" under Product details on the Indexing tab, save it, and let the sync it starts finish.', 'searcio' ) }
						</Notice.Description>
						<Notice.Actions>
							<Notice.ActionLink href={ addQueryArgs( window.location.href, { tab: 'indexing' } ) } openInNewTab>
								{ __( 'Open the Indexing tab', 'searcio' ) }
							</Notice.ActionLink>
						</Notice.Actions>
					</Notice.Root>
				) }

				<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
					<InputControl
						type="number"
						min={ 1 }
						max={ PROFIT_STRENGTH_MAX }
						step={ 1 }
						label={ __( 'Strength (%)', 'searcio' ) }
						description={ error( 'strength' ) || __( 'How far a product with a good margin may rise, from 1 to 50: at 15 it overtakes only results that match at most 15 percent better.', 'searcio' ) }
						value={ String( ranking.strength ?? '' ) }
						onValueChange={ ( value ) => set( 'strength', typed( value ) ) }
					/>
					<InputControl
						type="number"
						min={ 0.1 }
						max={ 100 }
						step={ 0.1 }
						label={ __( 'Target margin (%)', 'searcio' ) }
						description={ error( 'target' ) || __( 'The margin, without tax, from which a product counts as profitable. At the target it gets half the lift, at twice the target the full lift: with a target of 25, a margin of 25 gets half of it and 50 or more all of it.', 'searcio' ) }
						value={ String( ranking.target ?? '' ) }
						onValueChange={ ( value ) => set( 'target', typed( value ) ) }
					/>
					<InputControl
						type="number"
						min={ 0 }
						step={ 0.01 }
						label={ __( 'Least profit per sale', 'searcio' ) }
						description={ error( 'min_profit' ) || ( hasListings
							? __( 'Optional, without tax. A product that earns less per sale is not lifted, however high its margin.', 'searcio' )
							: pricesWithTax
								? __( 'Optional. A product that earns less per sale is not lifted, however high its margin. Counted in the prices the shop displays, which include tax, so the tax on the profit counts too.', 'searcio' )
								: __( 'Optional, in the prices the shop displays. A product that earns less per sale is not lifted, however high its margin.', 'searcio' ) ) }
						value={ String( ranking.min_profit ?? '' ) }
						onValueChange={ ( value ) => set( 'min_profit', typed( value ) ) }
					/>
				</Grid>

				{ hasListings && (
					<CheckboxControl
						label={ __( 'Also order listings without a search term', 'searcio' ) }
						description={ __( 'Without a term every product matches equally well, so the lift alone puts a category page or the highlights in order, which is stronger than in a search. Off, such a listing keeps its usual order.', 'searcio' ) }
						checked={ Boolean( ranking.listings ) }
						onCheckedChange={ ( listings ) => set( 'listings', Boolean( listings ) ) }
					/>
				) }

				<Fieldset.Root className="whsc-profit-rules">
					<Fieldset.Legend>{ __( 'Targets of their own', 'searcio' ) }</Fieldset.Legend>
					<Stack direction="column" gap="md">
						<Text render={ <p /> } variant="body-sm">
							{ __( 'A margin target for the products of a category, a brand or another field, or none at all for products never to lift, such as a clearance category. Where several match a product, the one fewer products share applies, and saved targets are listed in that order.', 'searcio' ) }
						</Text>
						{ rules.map( ( rule, index ) => (
							<div className="whsc-profit-rule" key={ index }>
								<InputControl
									label={ __( 'Field', 'searcio' ) }
									list="whsc-field-suggestions"
									description={ rowMessage( index, 'field' ) || ( unindexed.includes( String( rule.field ).trim() )
										? __( 'No product on this site has this field, so the target never applies. Choose a field from the list, or start indexing it in the Indexing tab.', 'searcio' )
										: undefined ) }
									value={ rule.field }
									onValueChange={ ( field ) => update( index, { ...rule, field } ) }
								/>
								<InputControl
									label={ __( 'Value', 'searcio' ) }
									description={ rowMessage( index, 'value' ) || __( 'Write it as it is in your products, for example Navy.', 'searcio' ) }
									value={ rule.value }
									onValueChange={ ( value ) => update( index, { ...rule, value } ) }
								/>
								<InputControl
									type="number"
									min={ 0.1 }
									max={ 100 }
									step={ 0.1 }
									label={ __( 'Target (%)', 'searcio' ) }
									description={ rowMessage( index, 'target' ) }
									value={ rule.exclude ? '' : String( rule.target ?? '' ) }
									disabled={ rule.exclude }
									onValueChange={ ( target ) => update( index, { ...rule, target: typed( target ) } ) }
								/>
								<div className="whsc-profit-rule__exclude">
									<CheckboxControl
										label={ __( 'Never lift', 'searcio' ) }
										checked={ Boolean( rule.exclude ) }
										onCheckedChange={ ( exclude ) => update( index, { ...rule, exclude: Boolean( exclude ) } ) }
									/>
								</div>
								<div className="whsc-row-remove">
									<Button
										__next40pxDefaultSize
										icon={ trash }
										isDestructive
										variant="tertiary"
										label={ __( 'Remove target', 'searcio' ) }
										onClick={ () => set( 'rules', rules.filter( ( _, i ) => i !== index ) ) }
									/>
								</div>
							</div>
						) ) }
						<Stack direction="row" gap="sm">
							<Button
								__next40pxDefaultSize
								variant="secondary"
								disabled={ rules.length >= PROFIT_RULES_MAX }
								onClick={ () => set( 'rules', [ ...rules, { field: '', value: '', target: null, exclude: false } ] ) }
							>
								{ __( 'Add a target', 'searcio' ) }
							</Button>
						</Stack>
					</Stack>
				</Fieldset.Root>

				<TextareaControl
					label={ __( 'Search terms ranked by relevance alone', 'searcio' ) }
					description={ error( 'excluded_terms' ) || __( 'One per line, up to 200, matched whole and whatever their capitals: brand names or service terms, for example.', 'searcio' ) }
					value={ termsText }
					onValueChange={ ( value ) => {
						setTermsText( value );
						set( 'excluded_terms', textToTerms( value ).slice( 0, PROFIT_TERMS_MAX ) );
					} }
				/>

				{ statisticsUrl && (
					<Text render={ <p /> } variant="body-sm">
						<Link href={ statisticsUrl } openInNewTab>
							{ __( 'See what profit ranking changes, and import targets, in the Searcio dashboard', 'searcio' ) }
						</Link>
					</Text>
				) }
			</Stack>
		</PlainSection>
	);
};

/**
 * Per-search curation: pin products to the top, keep products out, and show a
 * banner. Searcio applies every rule that matches a search, in the order of
 * the list: what any of them hides is hidden, an earlier
 * rule's pins come first, and the banner is the first one a matching rule
 * has. A rule with an empty trigger matches every search.
 *
 * On a multilingual site each rule also names the language it fires in:
 * without one, a German rule "jacke" fired on the English search "jacket" too.
 *
 * @param {Object}   props
 * @param {Array}    props.rules
 * @param {Object}   props.errors
 * @param {Array}    props.languages The site's languages, `{ code, name }`; none on a single-language site.
 * @param {Function} props.onChange  Called with the full replacement list.
 */
const MerchandisingCard = ( { rules, errors, languages, onChange } ) => {
	const update = ( index, next ) => onChange( rules.map( ( rule, i ) => ( i === index ? next : rule ) ) );
	const remove = ( index ) => onChange( rules.filter( ( _, i ) => i !== index ) );
	// Every field the normalizer produces, or the new row's category-trigger
	// inputs are uncontrolled and show whatever the row at this index held.
	const add = () => onChange( [
		...rules,
		{ query: '', filter_field: '', filter_value: '', pinned: [], hidden: [], banner: '', lang: null, match: null },
	] );
	const languageItems = [
		{ value: null, label: __( 'Every language', 'searcio' ) },
		...languages.map( ( language ) => ( { value: language.code, label: `${ language.name } (${ language.code })` } ) ),
	];
	const matchItems = [
		{ value: null, label: __( 'Contains the trigger', 'searcio' ) },
		{ value: 'exact', label: __( 'Is the trigger itself', 'searcio' ) },
	];

	return (
		<PlainSection
			title={ __( 'Merchandising rules', 'searcio' ) }
			description={ __(
				'Curate the results of chosen searches. Every rule that matches a search applies, in order from the top: what any of them hides is hidden, the products an earlier rule pins come first, and the banner is the first one a matching rule has. A rule with an empty trigger matches every search.',
				'searcio'
			) }
		>
			<Stack direction="column" gap="lg">
				{ rules.map( ( rule, index ) => (
					// A rule holds five fields, so it is a card of its own: one
					// level down from the card it is in.
					<Card.Root className="whsc-card whsc-card--dotted whsc-merchandising-rule" key={ index }>
						<Card.Header className="whsc-card__header">
							<Stack direction="row" gap="md" justify="space-between" align="center">
								<Card.Title render={ <h4 /> }>
									{ sprintf(
										/* translators: %d: the rule's position in the list. */
										__( 'Rule %d', 'searcio' ),
										index + 1
									) }
								</Card.Title>
								<Button
									size="compact"
									icon={ trash }
									isDestructive
									variant="tertiary"
									label={ __( 'Remove rule', 'searcio' ) }
									onClick={ () => remove( index ) }
								/>
							</Stack>
						</Card.Header>
						<Card.Content className="whsc-card__content">
							<Stack direction="column" gap="md">
								<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
									<InputControl
										label={ __( 'Trigger', 'searcio' ) }
										description={ rowError( errors, 'merchandising', index, 'query' )
											|| ( '' === rule.query
												? __( 'Empty: this rule applies to every search on the site.', 'searcio' )
												: undefined ) }
										value={ rule.query }
										onValueChange={ ( query ) => update( index, { ...rule, query } ) }
									/>
									<SelectControl
										label={ __( 'Fires when the search term', 'searcio' ) }
										description={ rowError( errors, 'merchandising', index, 'match' )
											|| __( '"Contains" fires on "rain jacket" for the trigger "jacket"; "is the trigger itself" only on "jacket".', 'searcio' ) }
										{ ...selectProps( matchItems, rule.match ?? null, ( match ) => update( index, { ...rule, match } ) ) }
									/>
								</Grid>
								{ languages.length > 1 && (
									<SelectControl
										label={ __( 'Language', 'searcio' ) }
										description={ rowError( errors, 'merchandising', index, 'lang' )
											|| __( 'The rule fires only for searches on pages in this language.', 'searcio' ) }
										{ ...selectProps( languageItems, rule.lang, ( lang ) => update( index, { ...rule, lang } ) ) }
									/>
								) }
								{ /* The optional category trigger. Both halves are needed
								     for either to mean anything, so they sit together. */ }
								<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
									<InputControl
										label={ __( 'Also require filter (field)', 'searcio' ) }
										list="whsc-field-suggestions"
										description={ rowError( errors, 'merchandising', index, 'filter_field' )
											|| __( 'Optional. A facet field, e.g. "categories".', 'searcio' ) }
										value={ rule.filter_field }
										onValueChange={ ( filter_field ) => update( index, { ...rule, filter_field } ) }
									/>
									<InputControl
										label={ __( 'Filter value', 'searcio' ) }
										description={ rowError( errors, 'merchandising', index, 'filter_value' )
											|| __(
												'With a field, the rule fires on that listing page - leave the trigger empty to curate the page itself.',
												'searcio'
											) }
										value={ rule.filter_value }
										onValueChange={ ( filter_value ) => update( index, { ...rule, filter_value } ) }
									/>
								</Grid>
								<Grid auto={ 220 } gap="var(--wpds-dimension-gap-md)" align="start">
									<InputControl
										label={ __( 'Pin to top (document ids)', 'searcio' ) }
										description={ listError( errors, 'merchandising', index, 'pinned' )
											|| __( 'Comma-separated, in the order they should appear.', 'searcio' ) }
										value={ idsToText( rule.pinned ) }
										onValueChange={ ( value ) => update( index, { ...rule, pinned: textToIds( value ) } ) }
									/>
									<InputControl
										label={ __( 'Hide (document ids)', 'searcio' ) }
										description={ listError( errors, 'merchandising', index, 'hidden' )
											|| __( 'Comma-separated. Kept out of the results entirely.', 'searcio' ) }
										value={ idsToText( rule.hidden ) }
										onValueChange={ ( value ) => update( index, { ...rule, hidden: textToIds( value ) } ) }
									/>
								</Grid>
								<InputControl
									label={ __( 'Promotional banner', 'searcio' ) }
									description={ rowError( errors, 'merchandising', index, 'banner' )
										|| __( 'Optional message returned with the results for this search.', 'searcio' ) }
									value={ rule.banner }
									onValueChange={ ( banner ) => update( index, { ...rule, banner } ) }
								/>
							</Stack>
						</Card.Content>
					</Card.Root>
				) ) }
				<Stack direction="row" gap="sm">
					<Button __next40pxDefaultSize variant="secondary" onClick={ add }>
						{ __( 'Add a rule', 'searcio' ) }
					</Button>
				</Stack>
			</Stack>
		</PlainSection>
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
 * @param {Array}    props.languages The site's languages, `{ code, name }`.
 * @param {Function} props.onChange  Called with the full replacement list.
 */
const RedirectsCard = ( { rules, errors, languages, onChange } ) => {
	const update = ( index, next ) => onChange( rules.map( ( rule, i ) => ( i === index ? next : rule ) ) );
	const remove = ( index ) => onChange( rules.filter( ( _, i ) => i !== index ) );
	const add = () => onChange( [ ...rules, { query: '', url: '', lang: null } ] );
	const multilingual = languages.length > 1;
	const languageItems = [
		{ value: null, label: __( 'Every language', 'searcio' ) },
		...languages.map( ( language ) => ( { value: language.code, label: `${ language.name } (${ language.code })` } ) ),
	];

	return (
		<PlainSection
			title={ __( 'Search redirects', 'searcio' ) }
			description={ __(
				'Send a search straight to a page instead of showing results. The term has to match exactly - capitalisation and surrounding spaces are ignored, but "black friday" will not fire on "black friday deals".',
				'searcio'
			) }
		>
			<Stack direction="column" gap="lg">
				{ /* A redirect is two fields and a delete, so it stays on one row
				     rather than borrowing the merchandising rule's card. */ }
				{ rules.map( ( rule, index ) => (
					<div className={ multilingual ? 'whsc-redirect-rule whsc-redirect-rule--lang' : 'whsc-redirect-rule' } key={ index }>
						<InputControl
							label={ __( 'Search term (exact)', 'searcio' ) }
							description={ rowError( errors, 'redirects', index, 'query' ) || ( repeatsRedirect( rules, index )
								? __( 'This term is redirected above already, and only one of the two can be followed.', 'searcio' )
								: undefined ) }
							value={ rule.query }
							onValueChange={ ( query ) => update( index, { ...rule, query } ) }
						/>
						<InputControl
							label={ __( 'Send them to', 'searcio' ) }
							description={ rowError( errors, 'redirects', index, 'url' )
								|| __( 'A full URL, or a path on this site starting with /.', 'searcio' ) }
							value={ rule.url }
							onValueChange={ ( url ) => update( index, { ...rule, url } ) }
						/>
						{ multilingual && (
							<SelectControl
								label={ __( 'Language', 'searcio' ) }
								description={ rowError( errors, 'redirects', index, 'lang' )
									|| __( 'Followed only for searches on pages in this language.', 'searcio' ) }
								{ ...selectProps( languageItems, rule.lang ?? null, ( lang ) => update( index, { ...rule, lang } ) ) }
							/>
						) }
						<div className="whsc-row-remove">
							<Button
								__next40pxDefaultSize
								icon={ trash }
								isDestructive
								variant="tertiary"
								label={ __( 'Remove redirect', 'searcio' ) }
								onClick={ () => remove( index ) }
							/>
						</div>
					</div>
				) ) }
				<Stack direction="row" gap="sm">
					<Button __next40pxDefaultSize variant="secondary" onClick={ add }>
						{ __( 'Add a redirect', 'searcio' ) }
					</Button>
				</Stack>
			</Stack>
		</PlainSection>
	);
};

const reasonOf = ( error ) =>
	error?.message || __( 'the request to the REST API failed.', 'searcio' );

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
	// Set when a save found its sections changed elsewhere since the tab read
	// them, and stopped: the notice then offers to read them again.
	const [ isConflict, setIsConflict ] = useState( false );
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
					readOnce( { path: SEARCH_CONFIG_PATH } ),
					readOnce( { path: INDEXING_CONFIG_PATH } ),
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
				const connection = await readOnce( { path: TEST_CONNECTION_PATH, method: 'POST' } );

				if ( isCurrentAttempt && connection?.ok ) {
					setLanguageLimit( connection.languages?.limit ?? null );
				}
			} catch ( error ) {
				// Non-fatal - the language picker just stays uncapped client-side
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
	const removeTypeBoost = ( index ) =>
		set( 'type_boosts', config.type_boosts.filter( ( _, i ) => i !== index ) );

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
		setIsConflict( false );
		setFieldErrors( {} );

		const failures = [];
		let savedSomething = false;
		// Set when the save changed the languages: the plugin starts a sync,
		// since they decide what is indexed and in which language.
		let languageSync = null;

		if ( hasSearchConfigChanges ) {
			const payload = toPayload( config, persistedConfig );

			// Searcio names a field by its key and answers in its own language,
			// so what is plainly out of range is said here, under the field.
			const problems = payload.profit_ranking ? profitRankingProblems( config.profit_ranking ) : {};

			if ( Object.keys( problems ).length > 0 ) {
				setIsSaving( false );
				setFieldErrors( problems );
				setSaveError( __( 'Some fields need a change: see the messages under them.', 'searcio' ) );

				return;
			}

			// What Searcio has now, against what the tab read: a section changed
			// in the Searcio dashboard meanwhile would be written back as it was.
			try {
				const live = normalizeConfig( await apiFetch( { path: SEARCH_CONFIG_PATH } ) );
				live.type_boosts = syncTypeBoosts( live.type_boosts, Object.keys( typeLabels ) );

				if ( changedSince( payload, live, persistedConfig ).length > 0 ) {
					setIsSaving( false );
					setIsConflict( true );
					setSaveError( __( 'These settings were changed in the Searcio dashboard, or in another window, since this tab read them, and saving would undo that. Nothing was saved. Read them again, then make your change once more.', 'searcio' ) );

					return;
				}
			} catch ( error ) {
				// Unreadable now: the save itself says what is wrong.
			}

			try {
				const response = await apiFetch( {
					path: SEARCH_CONFIG_PATH,
					method: 'PUT',
					data: payload,
				} );

				forget( SEARCH_CONFIG_PATH );

				languageSync = response?.sync && 'object' === typeof response.sync ? response.sync : null;

				const normalized = normalizeConfig( response );
				normalized.type_boosts = syncTypeBoosts( normalized.type_boosts, Object.keys( typeLabels ) );

				setConfig( normalized );
				setPersistedConfig( normalized );
				savedSomething = true;
			} catch ( error ) {
				failures.push( sprintf(
					/* translators: %s: reason the save failed, as reported by the REST API. */
					__( 'The search configuration could not be saved: %s', 'searcio' ),
					saveFailure( error )
				) );
				setFieldErrors( error?.errors && 'object' === typeof error.errors ? error.errors : {} );
			}
		}

		if ( hasUnsavedPopularSearches ) {
			if ( await savePopularSearches() ) {
				savedSomething = true;
			} else {
				failures.push( __( 'The popular searches and the category filter could not be saved.', 'searcio' ) );
			}
		}

		setIsSaving( false );

		if ( 0 === failures.length ) {
			if ( languageSync && ! languageSync.started ) {
				showToast( __( 'Search configuration saved. Start a sync on the Sync tab to index the languages.', 'searcio' ), 'warning' );
			} else if ( languageSync ) {
				showToast( __( 'Search configuration saved. A sync has started to index the languages.', 'searcio' ), 'success' );
			} else {
				showToast( __( 'Search configuration saved.', 'searcio' ), 'success' );
			}

			return;
		}

		// A partial save is one message: what still needs attention, and that
		// the rest was stored.
		setSaveError(
			savedSomething
				? [ ...failures, __( 'Everything else was saved.', 'searcio' ) ].join( ' ' )
				: failures.join( ' ' )
		);
	};

	// A failed load and a failed save are read out as they appear.
	useAnnounce( loadError ? sprintf(
		/* translators: %s: reason the request failed. */
		__( 'The search configuration could not be loaded: %s', 'searcio' ),
		loadError
	) : '', 'assertive' );
	useAnnounce( saveError || '', 'assertive' );

	if ( isLoading ) {
		return <IndexingSkeleton label={ __( 'Loading the search configuration', 'searcio' ) } />;
	}

	if ( loadError || ! config ) {
		return (
			<Notice.Root intent="error">
				<Notice.Description>
					{ sprintf(
						/* translators: %s: reason the request failed. */
						__( 'The search configuration could not be loaded: %s', 'searcio' ),
						loadError || __( 'the request to the REST API failed.', 'searcio' )
					) }
				</Notice.Description>
				<Notice.Actions>
					<Notice.ActionButton onClick={ () => setLoadAttempt( ( attempt ) => attempt + 1 ) }>
						{ __( 'Try again', 'searcio' ) }
					</Notice.ActionButton>
				</Notice.Actions>
			</Notice.Root>
		);
	}

	const saveDisabled = isSaving || ! hasUnsavedChanges;
	const saveLabel = isSaving
		? __( 'Saving…', 'searcio' )
		: __( 'Save search configuration', 'searcio' );
	const saveDescription = ! isSaving && ! hasUnsavedChanges
		? __( 'No unsaved changes.', 'searcio' )
		: undefined;

	// A section to each thing the search can be told, listed down the side as the
	// Placement tab lists its own: every one of them one click away, none of them
	// a page below the one before.
	const sections = [
		{
			id: 'ai',
			label: __( 'AI & ranking', 'searcio' ),
			content: (
				<>
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
				</>
			),
		},
		config.profit_ranking && catalog?.woo?.active && {
			id: 'profit',
			label: __( 'Profitable products first', 'searcio' ),
			summary: [
				config.profit_ranking.enabled ? __( 'On', 'searcio' ) : __( 'Off', 'searcio' ),
			],
			content: (
				<>
					<ProfitRankingCard
						ranking={ config.profit_ranking }
						errors={ fieldErrors }
						sendsPurchasePrice={ sendsPurchasePrice( catalog ) }
						indexed={ indexed }
						pricesWithTax={ Boolean( catalog?.woo?.prices_with_tax ) }
						onChange={ ( ranking ) => set( 'profit_ranking', ranking ) }
					/>
				</>
			),
		},
		{
			id: 'fields',
			label: __( 'Searchable fields & weights', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d field', '%d fields', config.searchable_fields.length, 'searcio' ),
					config.searchable_fields.length
				),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Searchable fields & weights', 'searcio' ) }
						description={ __(
							'Which fields full-text search matches, and how much each one counts (1-100). A higher weight on "title" makes title matches outrank body-text matches, for example.',
							'searcio'
						) }
					>
						<Stack direction="column" gap="md">
							{ config.searchable_fields.map( ( row, index ) => (
								<div className="whsc-search-config-row" key={ index }>
									<InputControl
										label={ __( 'Field', 'searcio' ) }
										list="whsc-field-suggestions"
										value={ row.field }
										description={ rowError( fieldErrors, 'searchable_fields', index, 'field' ) }
										onValueChange={ ( field ) => updateSearchableField( index, { ...row, field } ) }
									/>
									<RangeControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										label={ __( 'Weight', 'searcio' ) }
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
										label={ __( 'Remove field', 'searcio' ) }
										onClick={ () => removeSearchableField( index ) }
									/>
								</div>
							) ) }
							<UnindexedFieldsNotice
								fields={ unindexedFields( config.searchable_fields.map( ( row ) => row.field ), indexed ) }
								message={ unindexedSearchableMessage }
							/>
							<Stack direction="row" gap="sm">
								<Button __next40pxDefaultSize variant="secondary" onClick={ addSearchableField }>
									{ __( 'Add a field', 'searcio' ) }
								</Button>
							</Stack>
						</Stack>
					</PlainSection>
				</>
			),
		},
		{
			id: 'boosts',
			label: __( 'Type boosts', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d type', '%d types', config.type_boosts.length, 'searcio' ),
					config.type_boosts.length
				),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Type boosts', 'searcio' ) }
						description={ __(
							'Ranking boost per content type (0.1-100). Above 1 ranks that type higher overall; below 1 ranks it lower. One row per content type currently enabled in Indexing.',
							'searcio'
						) }
					>
						{ config.type_boosts.length > 0 ? (
							<Stack direction="column" gap="md">
								{ /* Each slider is named by its content type: the card says
								     these are boosts. A "Type" column beside a "Boost"
								     slider stood out of line with it, its caption level with
								     nothing and its name below the slider's middle. */ }
								{ config.type_boosts.map( ( row, index ) => {
									// A type no content of this site carries: it moves nothing here.
									const foreign = ! ( row.type in typeLabels );
									const slider = (
										<RangeControl
											key={ row.type }
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											label={ typeLabels[ row.type ] || row.type }
											min={ 0.1 }
											max={ 100 }
											step={ 0.1 }
											value={ row.boost }
											help={ rowError( fieldErrors, 'type_boosts', index, 'boost' ) }
											onChange={ ( boost ) => updateTypeBoost( index, boost ) }
										/>
									);

									return foreign ? (
										<div className="whsc-search-config-row whsc-type-boost--foreign" key={ row.type }>
											{ slider }
											<Button
												__next40pxDefaultSize
												icon={ trash }
												isDestructive
												variant="tertiary"
												label={ sprintf(
													/* translators: %s: the name of a content type. */
													__( 'Remove the boost of %s', 'searcio' ),
													row.type
												) }
												onClick={ () => removeTypeBoost( index ) }
											/>
										</div>
									) : (
										slider
									);
								} ) }
								{ config.type_boosts.some( ( row ) => ! ( row.type in typeLabels ) ) && (
									<Notice.Root intent="warning">
										<Notice.Description>
											{ __(
												'A boost with a remove button is for a type that no content of this site has any more, for example one you renamed on the Indexing tab. It moves no result here: remove it, unless another source sends that type to the same index.',
												'searcio'
											) }
										</Notice.Description>
									</Notice.Root>
								) }
							</Stack>
						) : (
							<Notice.Root intent="info">
								<Notice.Description>
									{ __(
										'Enable at least one content type in the Indexing tab to set a type boost.',
										'searcio'
									) }
								</Notice.Description>
							</Notice.Root>
						) }
					</PlainSection>
				</>
			),
		},
		{
			id: 'filters',
			label: __( 'Filters', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d field', '%d fields', config.facet_fields.length, 'searcio' ),
					config.facet_fields.length
				),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Facet fields', 'searcio' ) }
						description={ __(
							'Fields returned as facets on search results and allowed as filters. Click the field to browse every available field, or type to search.',
							'searcio'
						) }
					>
						<Stack direction="column" gap="md" className="whsc-token-field">
							<FormTokenField
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								__experimentalExpandOnFocus
								label={ __( 'Facet fields', 'searcio' ) }
								hideLabelFromVision
								value={ config.facet_fields }
								suggestions={ pool }
								displayTransform={ facetFieldText }
								onChange={ ( value ) => set( 'facet_fields', value ) }
							/>
							<UnindexedFieldsNotice
								fields={ unindexedFields( config.facet_fields, indexed ) }
								message={ unindexedFacetMessage }
							/>
							{ /* Offered once Searcio reports the setting, which it keeps. */ }
							{ config.facet_match && config.facet_fields.length > 0 && (
								<Fieldset.Root className="whsc-facet-match">
									<Fieldset.Legend>{ __( 'When a shopper picks several values of one filter', 'searcio' ) }</Fieldset.Legend>
									<Stack direction="column" gap="md">
										<Text render={ <p /> } variant="body-sm" className="whsc-facet-match__description">
											{ __( 'Any: a result that has one of them is shown. All: only a result that has every one of them, for a field a result holds several values of, such as features or tags.', 'searcio' ) }
										</Text>
										{ config.facet_fields.map( ( field ) => (
											<ToggleGroupControl
												key={ field }
												__next40pxDefaultSize
												__nextHasNoMarginBottom
												isBlock
												label={ field }
												value={ 'all' === config.facet_match[ field ] ? 'all' : 'any' }
												onChange={ ( mode ) => set( 'facet_match', { ...config.facet_match, [ field ]: mode } ) }
											>
												<ToggleGroupControlOption value="any" label={ __( 'Any (OR)', 'searcio' ) } />
												<ToggleGroupControlOption value="all" label={ __( 'All (AND)', 'searcio' ) } />
											</ToggleGroupControl>
										) ) }
									</Stack>
								</Fieldset.Root>
							) }
							{ /* Offered once Searcio reports them. Each change rebuilds
							     the site's index there, which the descriptions say. */ }
							{ Array.isArray( config.numeric_fields ) && (
								<Stack direction="column" gap="xs">
									<FormTokenField
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										__experimentalExpandOnFocus
										label={ __( 'Fields that hold numbers', 'searcio' ) }
										value={ config.numeric_fields }
										suggestions={ numberFieldChoices( pool ) }
										maxLength={ FIELD_LIST_MAX }
										onChange={ ( value ) => set( 'numeric_fields', value ) }
									/>
									<Text render={ <p /> } variant="body-sm" className="whsc-field-list__description">
										{ errorsUnder( fieldErrors, 'numeric_fields' ) || __( 'Your own fields whose values are numbers, such as a weight or a length, up to 20: their filter becomes a range from and to, and they compare as numbers. A value that is not a number is left out. Changing the list rebuilds the search index in the background: give it a few minutes before changing it again.', 'searcio' ) }
									</Text>
								</Stack>
							) }
							{ Array.isArray( config.variant_fields ) && (
								<Stack direction="column" gap="xs">
									<FormTokenField
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										__experimentalExpandOnFocus
										label={ __( 'Attributes one variation must match', 'searcio' ) }
										value={ config.variant_fields }
										suggestions={ variantFieldChoices( pool ) }
										maxLength={ FIELD_LIST_MAX }
										onChange={ ( value ) => set( 'variant_fields', value ) }
									/>
									<Text render={ <p /> } variant="body-sm" className="whsc-field-list__description">
										{ errorsUnder( fieldErrors, 'variant_fields' ) || __( 'Attributes the variations of a product differ in, such as colour and size. Filters on them find a product only when one variation in stock has every value picked: red and XL no longer find a jacket whose red XL is sold out. Setting the first one rebuilds the search index in the background: give it a few minutes before changing it again.', 'searcio' ) }
									</Text>
								</Stack>
							) }
						</Stack>
					</PlainSection>

					<CategoryFilterCard />
				</>
			),
		},
		{
			id: 'suggest',
			label: __( 'Suggestions', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d field', '%d fields', config.suggest_fields.length, 'searcio' ),
					config.suggest_fields.length
				),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Suggest fields', 'searcio' ) }
						description={ __(
							'Fields queried for search-as-you-type suggestions. Defaults to "title" when left empty. Click to browse, or type to search.',
							'searcio'
						) }
					>
						<Stack direction="column" gap="md" className="whsc-token-field">
							<FormTokenField
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								__experimentalExpandOnFocus
								label={ __( 'Suggest fields', 'searcio' ) }
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
					</PlainSection>

					<PopularSearchesCard
						excluded={ config.excluded_popular_terms }
						errors={ fieldErrors }
						onExcludedChange={ ( terms ) => set( 'excluded_popular_terms', terms ) }
					/>
				</>
			),
		},
		{
			id: 'synonyms',
			label: __( 'Synonyms', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d group', '%d groups', config.synonyms.length, 'searcio' ),
					config.synonyms.length
				),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Synonyms', 'searcio' ) }
						description={ __(
							'Treats words as interchangeable during search, even when the exact word a visitor types never appears in a result. For example, a line with "sneaker, trainer" means searching "sneaker" also matches results that only mention "trainer", and vice versa - useful for regional spelling or naming differences.',
							'searcio'
						) }
					>
						<SynonymsField synonyms={ config.synonyms } onChange={ ( groups ) => set( 'synonyms', groups ) } />
					</PlainSection>
				</>
			),
		},
		{
			id: 'languages',
			label: __( 'Languages', 'searcio' ),
			content: (
				<>
					<PlainSection
						title={ __( 'Languages', 'searcio' ) }
						description={ catalog?.languages?.active
							? ( null !== languageLimit
								? sprintf(
									/* translators: %d: number of languages the plan allows. */
									__( 'Which of this site\'s languages to index and search. Your plan allows up to %d.', 'searcio' ),
									languageLimit
								)
								: __( 'Which of this site\'s languages to index and search. Leave every language unchecked for unrestricted.', 'searcio' ) )
							: __( 'No WPML/Polylang installation was detected, so languages can only be entered manually here. Leave empty for unrestricted.', 'searcio' ) }
					>
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
									label={ __( 'Languages', 'searcio' ) }
									hideLabelFromVision
									description={ __( 'Comma-separated ISO language codes, e.g. "de, en".', 'searcio' ) }
									value={ config.languages.join( ', ' ) }
									onValueChange={ ( value ) =>
										set(
											'languages',
											value.split( ',' ).map( ( code ) => code.trim() ).filter( ( code ) => '' !== code )
										)
									}
								/>
							) }

							{ errorsUnder( fieldErrors, 'languages' ) && (
								<Notice.Root intent="error">
									<Notice.Description>
										{ /* A code that is not one; what the list as a whole broke, such as the plan's limit, is Searcio's to say. */ }
										{ Object.keys( fieldErrors ).some( ( key ) => key.startsWith( 'languages.' ) )
											? __( 'Use the two-letter codes of the site\'s languages, such as de or en, separated by commas.', 'searcio' )
											: errorsUnder( fieldErrors, 'languages' ) }
									</Notice.Description>
								</Notice.Root>
							) }
						</Stack>
					</PlainSection>
				</>
			),
		},
		{
			id: 'merchandising',
			label: __( 'Merchandising rules', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d rule', '%d rules', config.merchandising.length, 'searcio' ),
					config.merchandising.length
				),
			],
			content: (
				<>
					<MerchandisingCard
						rules={ config.merchandising }
						errors={ fieldErrors }
						languages={ catalog?.languages?.active ? catalog.languages.available || [] : [] }
						onChange={ ( rules ) => set( 'merchandising', rules ) }
					/>
				</>
			),
		},
		{
			id: 'redirects',
			label: __( 'Search redirects', 'searcio' ),
			summary: [
				sprintf(
					/* translators: %d: how many. */
					_n( '%d redirect', '%d redirects', config.redirects.length, 'searcio' ),
					config.redirects.length
				),
			],
			content: (
				<>
					<RedirectsCard
						rules={ config.redirects }
						errors={ fieldErrors }
						languages={ catalog?.languages?.active ? catalog.languages.available || [] : [] }
						onChange={ ( rules ) => set( 'redirects', rules ) }
					/>
				</>
			),
		},
	].filter( Boolean );

	return (
		<Stack direction="column" gap="lg" className="searcio-search-config">
			<TabIntro
				title={ __( 'Search configuration', 'searcio' ) }
				description={ __(
					"Controls how Searcio itself ranks and filters your content - which fields it searches and how heavily, per-type ranking boosts, which fields power facets and suggestions, and synonyms. Most of this lives on Searcio's side, not in this plugin's own settings, so changes take effect on the very next search.",
					'searcio'
				) }
			/>

			<SectionList
				label={ __( 'Search configuration', 'searcio' ) }
				sections={ sections }
			/>

			{ saveError && (
				<Notice.Root intent="error">
					<Notice.Description>{ saveError }</Notice.Description>
					{ isConflict && (
						<Notice.Actions>
							<Notice.ActionButton
								onClick={ () => {
									forget( SEARCH_CONFIG_PATH );
									setSaveError( null );
									setIsConflict( false );
									setLoadAttempt( ( attempt ) => attempt + 1 );
								} }
							>
								{ __( 'Read them again', 'searcio' ) }
							</Notice.ActionButton>
						</Notice.Actions>
					) }
					<Notice.CloseIconButton onClick={ () => setSaveError( null ) } />
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
