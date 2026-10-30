import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
	ColorIndicator,
	ColorPicker,
	Dropdown,
	RangeControl,
	ToggleControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { Card, Fieldset, InputControl, Link, Notice, SelectControl, Stack, Text, TextareaControl } from '@wordpress/ui';
import { __, _n, isRTL, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import {
	buildShortcode,
	invalidSelectors,
	normalizePlacement,
	previewUrl,
	selectorsToText,
	textToSelectors,
	withSuggestion,
} from '../../placement';
import { selectProps } from '../../../../utils/select';
import { Grid } from '../../../../components/Layout';
import SectionList from '../../../../components/SectionList';
import { showToast } from '../../../../toast';
import { useAnnounce } from '../../../../utils/announce';
import TabIntro from '../TabIntro';
import IndexingSkeleton from './IndexingSkeleton';

const pluginData = window.webhead_search_cloudData || {};
// How long a pause in typing has to be before a selector counts as written.
const TYPING_PAUSE = 1000;
const PLACEMENT_PATH = pluginData?.api?.placementPath || '/webhead-search-cloud/v1/placement';

/** The shortcodes' tags (`Search_Shortcode::TAG`, `Products_Shortcode::TAG`). */
const SEARCH_TAG = 'searcio';
const PRODUCTS_TAG = 'searcio_products';

/** The order the generator writes a shortcode's attributes in. */
const SEARCH_ORDER = [ 'mode', 'placeholder', 'type', 'width', 'align' ];
const PRODUCTS_ORDER = [ 'source', 'layout', 'limit', 'heading', 'banner' ];

/** How long the preview waits after a change before it draws again. */
const PREVIEW_DELAY = 500;

const reasonOf = ( error ) => error?.message || __( 'the request to the REST API failed.', 'searcio' );

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
 * A section with nothing beside it: the same title and sentence a card has,
 * straight on the panel. A card separates one region from another, and a box
 * round the only one says a second is coming that never does.
 */
const PlainSection = ( { title, description, children } ) => (
	<section className="whsc-placement-section">
		<Stack direction="column" gap="xs" className="whsc-placement-section__header">
			<Text render={ <h3 /> } variant="heading-md" className="whsc-placement-section__title">
				{ title }
			</Text>
			{ description ? (
				<Text render={ <p /> } variant="body-sm" className="whsc-placement-section__description">
					{ description }
				</Text>
			) : null }
		</Stack>
		{ children }
	</section>
);

/**
 * Copies a text, and says so. The Clipboard API needs a secure page; an admin
 * on plain HTTP takes the older way, through a selected field.
 */
const copyText = async ( text ) => {
	try {
		if ( window.navigator?.clipboard?.writeText ) {
			await window.navigator.clipboard.writeText( text );

			return true;
		}

		const field = document.createElement( 'textarea' );

		field.value = text;
		field.setAttribute( 'readonly', '' );
		field.className = 'whsc-placement-copy-buffer';
		document.body.appendChild( field );
		field.select();

		const copied = document.execCommand( 'copy' );

		field.remove();

		return copied;
	} catch {
		return false;
	}
};

/**
 * A snippet to put somewhere else, with its copy button. It is selectable
 * text, so an admin whose browser refuses the copy can still take it.
 */
const Snippet = ( { code, label } ) => (
	<div className="whsc-placement-snippet">
		<code className="whsc-placement-snippet__code" aria-label={ label }>{ code }</code>
		<Button
			__next40pxDefaultSize
			variant="secondary"
			className="whsc-placement-snippet__copy"
			onClick={ async () => {
				if ( await copyText( code ) ) {
					showToast( __( 'Copied.', 'searcio' ), 'success' );
				} else {
					showToast( __( 'The browser did not allow copying. Select the text and copy it yourself.', 'searcio' ), 'error' );
				}
			} }
		>
			{ __( 'Copy', 'searcio' ) }
		</Button>
	</div>
);

/**
 * One colour: a button with its swatch, its name and its value, which opens a
 * picker. Empty is the storefront's own colour.
 */
const ColorField = ( { label, value, onChange } ) => (
	<Dropdown
		className="whsc-placement-color"
		popoverProps={ { placement: 'bottom-start' } }
		renderToggle={ ( { isOpen, onToggle } ) => (
			<Button
				__next40pxDefaultSize
				variant="secondary"
				className="whsc-placement-color__toggle"
				aria-expanded={ isOpen }
				onClick={ onToggle }
			>
				<ColorIndicator colorValue={ value || 'transparent' } className="whsc-placement-color__swatch" />
				<span className="whsc-placement-color__name">{ label }</span>
				<span className="whsc-placement-color__value">{ value || __( 'Default', 'searcio' ) }</span>
			</Button>
		) }
		renderContent={ () => (
			<Stack direction="column" gap="sm" className="whsc-placement-color__panel">
				<ColorPicker color={ value || '#ffffff' } enableAlpha={ false } onChange={ onChange } />
				<Stack direction="row" gap="sm">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						accessibleWhenDisabled
						disabled={ ! value }
						onClick={ () => onChange( '' ) }
					>
						{ __( 'Use the default', 'searcio' ) }
					</Button>
				</Stack>
			</Stack>
		) }
	/>
);

/**
 * A page of the site with the search drawn from the settings on screen, in
 * the theme's own styles. It is drawn again a moment after the last change,
 * not on every key.
 */
const Preview = ( { preview, view, placement, title, className = '' } ) => {
	const target = previewUrl( preview, view, placement );
	const [ src, setSrc ] = useState( target );

	useEffect( () => {
		const timer = window.setTimeout( () => setSrc( target ), PREVIEW_DELAY );

		return () => window.clearTimeout( timer );
	}, [ target ] );

	if ( ! src ) {
		return null;
	}

	return (
		<iframe
			className={ `whsc-placement-preview whsc-placement-preview--${ view } ${ className }`.trim() }
			title={ title }
			src={ src }
			loading="lazy"
		/>
	);
};

/**
 * Where a block or an Elementor widget cannot place the search: the theme's
 * own search, a floating button, shortcodes and classic widgets.
 *
 * Saved through `/placement` (the plugin's own `placement` option), with one
 * save button for the whole tab.
 */
const PlacementTab = () => {
	const [ catalog, setCatalog ] = useState( null );
	const [ placement, setPlacement ] = useState( null );
	const [ persisted, setPersisted ] = useState( null );
	const [ selectorsText, setSelectorsText ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( null );
	const [ loadAttempt, setLoadAttempt ] = useState( 0 );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ saveError, setSaveError ] = useState( null );
	const [ settledSelectorsNote, setSettledSelectorsNote ] = useState( '' );
	const [ previewView, setPreviewView ] = useState( 'trigger' );
	const [ searchShortcode, setSearchShortcode ] = useState( {} );
	const [ productsShortcode, setProductsShortcode ] = useState( {} );
	const mounted = useRef( true );

	useEffect( () => () => {
		mounted.current = false;
	}, [] );

	const accept = ( response ) => {
		const normalized = normalizePlacement( response?.placement );

		setCatalog( response );
		setPlacement( normalized );
		setPersisted( normalized );
		setSelectorsText( selectorsToText( normalized.selectors ) );
	};

	useEffect( () => {
		setIsLoading( true );
		setLoadError( null );

		apiFetch( { path: PLACEMENT_PATH } )
			.then( ( response ) => mounted.current && accept( response ) )
			.catch( ( error ) => mounted.current && setLoadError( reasonOf( error ) ) )
			.finally( () => mounted.current && setIsLoading( false ) );
	}, [ loadAttempt ] );

	const hasUnsavedChanges = useMemo(
		() => null !== placement && JSON.stringify( placement ) !== JSON.stringify( persisted ),
		[ placement, persisted ]
	);

	const set = ( key, value ) => setPlacement( ( current ) => ( { ...current, [ key ]: value } ) );
	const setSearch = ( key, value ) => setPlacement( ( current ) => ( { ...current, search: { ...current.search, [ key ]: value } } ) );
	const setProducts = ( key, value ) => setPlacement( ( current ) => ( { ...current, products: { ...current.products, [ key ]: value } } ) );
	const setFloating = ( key, value ) => setPlacement( ( current ) => ( { ...current, floating: { ...current.floating, [ key ]: value } } ) );

	const onSelectorsChange = ( text ) => {
		setSelectorsText( text );
		set( 'selectors', textToSelectors( text ) );
	};

	const onSave = async () => {
		setIsSaving( true );
		setSaveError( null );

		try {
			const response = await apiFetch( { path: PLACEMENT_PATH, method: 'POST', data: { placement } } );

			if ( ! mounted.current ) {
				return;
			}

			accept( response );
			showToast( __( 'Placement saved.', 'searcio' ), 'success' );
		} catch ( error ) {
			if ( mounted.current ) {
				setSaveError( sprintf(
					/* translators: %s: reason the save failed, as reported by the REST API. */
					__( 'The placement could not be saved: %s', 'searcio' ),
					reasonOf( error )
				) );
			}
		} finally {
			if ( mounted.current ) {
				setIsSaving( false );
			}
		}
	};

	const loadFailure = ! isLoading && ( loadError || ! placement ) ? sprintf(
		/* translators: %s: reason the request failed. */
		__( 'The placement settings could not be loaded: %s', 'searcio' ),
		loadError || __( 'the request to the REST API failed.', 'searcio' )
	) : '';
	const badSelectors = placement ? invalidSelectors( placement.selectors ) : [];
	const selectorsNote = badSelectors.length > 0 ? sprintf(
		/* translators: %s: the selectors, one after another. */
		__( 'A browser cannot read these, so they open nothing: %s', 'searcio' ),
		badSelectors.join( ', ' )
	) : '';

	useEffect( () => {
		const pause = setTimeout( () => setSettledSelectorsNote( selectorsNote ), TYPING_PAUSE );

		return () => clearTimeout( pause );
	}, [ selectorsNote ] );

	// A failed load and a failed save are read out as they appear. A selector
	// is wrong for as long as it is half typed, and the note changes with every
	// key, so that one is read out when the typing stops.
	useAnnounce( loadFailure, 'assertive' );
	useAnnounce( saveError || '', 'assertive' );
	useAnnounce( settledSelectorsNote );

	if ( isLoading ) {
		return <IndexingSkeleton label={ __( 'Loading the placement settings', 'searcio' ) } />;
	}

	if ( loadFailure ) {
		return (
			<Notice.Root intent="error">
				<Notice.Description>
					{ loadFailure }
				</Notice.Description>
				<Notice.Actions>
					<Notice.ActionButton onClick={ () => setLoadAttempt( ( attempt ) => attempt + 1 ) }>
						{ __( 'Try again', 'searcio' ) }
					</Notice.ActionButton>
				</Notice.Actions>
			</Notice.Root>
		);
	}

	const { search, products, floating } = placement;
	const theme = catalog?.theme || {};
	const suggestion = theme.suggestion || null;
	const builders = Array.isArray( theme.builders ) ? theme.builders : [];
	const typeLabels = catalog?.types || {};
	const home = catalog?.home || '/';
	const multilingual = catalog?.multilingual || null;

	const translateHint = 'polylang' === multilingual
		? __( 'Translate it under Languages > Translations, in the Searcio group.', 'searcio' )
		: ( 'wpml' === multilingual
			? __( 'Translate it under WPML > String Translation, in the Searcio domain.', 'searcio' )
			: undefined );

	const typeItems = [
		{ value: null, label: __( 'All content', 'searcio' ) },
		...Object.entries( typeLabels ).map( ( [ value, label ] ) => ( { value, label } ) ),
	];
	const triggerItems = [
		{ value: 'submit', label: __( 'When Enter is pressed', 'searcio' ) },
		{ value: 'type', label: __( 'As the visitor types', 'searcio' ) },
	];
	const highlightItems = [
		{ value: 'newest', label: __( 'The newest products', 'searcio' ) },
		{ value: 'featured', label: __( 'Featured products', 'searcio' ) },
	];
	const animationItems = [
		{ value: 'fade', label: __( 'Fade', 'searcio' ) },
		{ value: 'slide-down', label: __( 'Slide down', 'searcio' ) },
		{ value: 'slide-up', label: __( 'Slide up', 'searcio' ) },
		{ value: 'zoom', label: __( 'Zoom', 'searcio' ) },
		{ value: 'none', label: __( 'None', 'searcio' ) },
	];
	const cardItems = [
		{ value: 'plugin', label: __( 'Drawn by the plugin', 'searcio' ) },
		{ value: 'server', label: __( 'Templates from Searcio', 'searcio' ) },
	];

	// The corners are where text starts and ends, so a right-to-left screen
	// names them the other way round.
	const startLabel = isRTL() ? __( 'Right', 'searcio' ) : __( 'Left', 'searcio' );
	const endLabel = isRTL() ? __( 'Left', 'searcio' ) : __( 'Right', 'searcio' );

	const searchValues = { ...search, ...searchShortcode };
	const productsValues = { ...products, ...productsShortcode };

	const saveDisabled = isSaving || ! hasUnsavedChanges;
	const saveLabel = isSaving ? __( 'Saving…', 'searcio' ) : __( 'Save placement', 'searcio' );
	const saveDescription = ! isSaving && ! hasUnsavedChanges ? __( 'No unsaved changes.', 'searcio' ) : undefined;

	// A site-wide way shows on the site once it is saved: the line under each.
	const checkLine = (
		<Text render={ <p /> } variant="body-sm" className="whsc-placement-check">
			{ __( 'To check a change, save it, open your site in a new tab and click its search.', 'searcio' ) }
			{ ' ' }
			<Link href={ home } openInNewTab>
				{ __( 'Open your site', 'searcio' ) }
			</Link>
		</Text>
	);

	// One entry per way of placing the search, each with its state, so the
	// list down the side reads as a summary of the whole tab.
	const sections = [
		{
			id: 'forms',
			label: __( 'Search forms', 'searcio' ),
			summary: [
				placement.takeover ? __( 'Drawn as Searcio', 'searcio' ) : __( 'Off', 'searcio' ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Search forms', 'searcio' ) }
						description={ __( 'For a theme that draws its own search. Searcio takes its place on every page, with nothing to edit in the theme.', 'searcio' ) }
					>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Use Searcio for the site\'s search forms', 'searcio' ) }
							help={ __( 'The theme\'s search form, WooCommerce\'s product search and the Search blocks become a Searcio search field. Without JavaScript they still search WordPress.', 'searcio' ) }
							checked={ placement.takeover }
							onChange={ ( checked ) => set( 'takeover', checked ) }
						/>
					</PlainSection>
					{ checkLine }
				</>
			),
		},
		{
			id: 'theme',
			label: __( 'The theme\'s search', 'searcio' ),
			summary: [
				placement.openers
					? sprintf(
						/* translators: %d: number of CSS selectors. */
						_n( '%d selector', '%d selectors', placement.selectors.length, 'searcio' ),
						placement.selectors.length
					)
					: __( 'Off', 'searcio' ),
				/* translators: %s: the theme's name. */
				theme.name ? sprintf( __( 'Theme: %s', 'searcio' ), theme.name ) : '',
			],
			content: (
				<>
					<PlainSection
						title={ __( 'The theme\'s search', 'searcio' ) }
						description={ __( 'For a theme whose header has a search icon or field of its own.', 'searcio' ) }
					>
						<Stack direction="column" gap="md">
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Open Searcio from the theme\'s own search', 'searcio' ) }
								help={ __( 'A click on an element these selectors find opens Searcio, and the theme\'s own search stays closed. A search field opens it with what was typed.', 'searcio' ) }
								checked={ placement.openers }
								onChange={ ( checked ) => set( 'openers', checked ) }
							/>

							{ placement.openers && (
								<Stack direction="column" gap="md" className="whsc-placement-openers">
									<TextareaControl
										label={ __( 'CSS selectors', 'searcio' ) }
										description={ __( 'One per line, e.g. #menu-item-search > a. To find one, right-click the theme\'s search icon, choose Inspect, and copy a class or id it has.', 'searcio' ) }
										value={ selectorsText }
										onValueChange={ onSelectorsChange }
										rows={ 3 }
									/>

									{ selectorsNote && (
										<Notice.Root intent="warning">
											<Notice.Description>
												{ selectorsNote }
											</Notice.Description>
										</Notice.Root>
									) }

									{ [ ...( suggestion ? [ suggestion ] : [] ), ...builders ].map( ( preset ) => {
										const missing = preset.selectors.filter( ( selector ) => ! placement.selectors.includes( selector ) );

										return (
											<Stack key={ preset.key } direction="row" gap="md" align="center" wrap="wrap" className="whsc-placement-suggestion">
												<Text render={ <p /> } variant="body-sm" className="whsc-placement-suggestion__text">
													{ sprintf(
														/* translators: 1: a theme's or a builder's name, 2: its CSS selectors. */
														__( 'For %1$s: %2$s', 'searcio' ),
														preset.name,
														preset.selectors.join( ', ' )
													) }
												</Text>
												<Button
													__next40pxDefaultSize
													variant="secondary"
													accessibleWhenDisabled
													disabled={ 0 === missing.length }
													onClick={ () => {
														const next = withSuggestion( placement.selectors, preset.selectors );

														setSelectorsText( selectorsToText( next ) );
														set( 'selectors', next );
													} }
												>
													{ 0 === missing.length ? __( 'In the list', 'searcio' ) : __( 'Use the suggestion', 'searcio' ) }
												</Button>
											</Stack>
										);
									} ) }

									{ ! suggestion && theme.name && (
										<Text render={ <p /> } variant="body-sm" className="whsc-placement-suggestion__text">
											{ sprintf(
												/* translators: %s: the theme's name. */
												__( 'Searcio has no suggestion for %s yet.', 'searcio' ),
												theme.name
											) }
										</Text>
									) }
								</Stack>
							) }
						</Stack>
					</PlainSection>
					{ checkLine }
				</>
			),
		},
		{
			id: 'shortcut',
			label: __( 'Keyboard shortcut', 'searcio' ),
			summary: [
				placement.shortcut ? __( 'Ctrl+K and /', 'searcio' ) : __( 'Off', 'searcio' ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Keyboard shortcut', 'searcio' ) }
						description={ __( 'Ctrl+K, Cmd+K on a Mac, and "/" outside a field open the search.', 'searcio' ) }
					>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Use the keyboard shortcut', 'searcio' ) }
							checked={ placement.shortcut }
							onChange={ ( checked ) => set( 'shortcut', checked ) }
						/>
					</PlainSection>
					{ checkLine }
				</>
			),
		},
		{
			id: 'floating',
			label: __( 'Floating search button', 'searcio' ),
			summary: [
				! floating.enabled
					? __( 'Off', 'searcio' )
					: ( 'all' === floating.devices ? __( 'On every screen', 'searcio' ) : __( 'On phones', 'searcio' ) ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Floating search button', 'searcio' ) }
						description={ __( 'A button fixed to a bottom corner of every page, for a theme that has no search on a phone.', 'searcio' ) }
					>
						<Stack direction="column" gap="lg">
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Show a floating search button', 'searcio' ) }
								checked={ floating.enabled }
								onChange={ ( checked ) => setFloating( 'enabled', checked ) }
							/>

							{ floating.enabled && (
								<Grid className="whsc-placement-split" columns={ { base: 1, md: 2 } } gap="var(--wpds-dimension-gap-xl)" align="start">
									<Stack direction="column" gap="lg">
										<ToggleGroupControl
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											isBlock
											label={ __( 'Corner', 'searcio' ) }
											value={ floating.position }
											onChange={ ( value ) => setFloating( 'position', value ) }
										>
											<ToggleGroupControlOption value="start" label={ startLabel } />
											<ToggleGroupControlOption value="end" label={ endLabel } />
										</ToggleGroupControl>
										<ToggleGroupControl
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											isBlock
											label={ __( 'Shown on', 'searcio' ) }
											help={ __( 'Phones are screens narrower than 782px.', 'searcio' ) }
											value={ floating.devices }
											onChange={ ( value ) => setFloating( 'devices', value ) }
										>
											<ToggleGroupControlOption value="phones" label={ __( 'Phones', 'searcio' ) } />
											<ToggleGroupControlOption value="all" label={ __( 'Every screen', 'searcio' ) } />
										</ToggleGroupControl>
										<ToggleGroupControl
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											isBlock
											label={ __( 'Button', 'searcio' ) }
											value={ floating.style }
											onChange={ ( value ) => setFloating( 'style', value ) }
										>
											<ToggleGroupControlOption value="icon" label={ __( 'Magnifier', 'searcio' ) } />
											<ToggleGroupControlOption value="label" label={ __( 'With "Search"', 'searcio' ) } />
										</ToggleGroupControl>
										<RangeControl
											__next40pxDefaultSize
											__nextHasNoMarginBottom
											label={ __( 'Distance from the bottom (px)', 'searcio' ) }
											help={ __( 'Lift it above a cookie notice or a cart bar.', 'searcio' ) }
											min={ 0 }
											max={ 400 }
											step={ 4 }
											value={ floating.offset }
											onChange={ ( value ) => setFloating( 'offset', Number.isFinite( value ) ? value : 24 ) }
										/>
									</Stack>
									<Preview
										preview={ catalog?.preview }
										view="floating"
										placement={ placement }
										title={ __( 'Preview of the floating search button', 'searcio' ) }
									/>
								</Grid>
							) }
						</Stack>
					</PlainSection>
				</>
			),
		},
		{
			id: 'look',
			label: __( 'Look', 'searcio' ),
			summary: [
				'box' === search.mode ? __( 'Search field', 'searcio' ) : __( 'Magnifier', 'searcio' ),
				typeLabels[ search.type ] || __( 'All content', 'searcio' ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Look of the shortcode and the widgets', 'searcio' ) }
						description={ __( 'How [searcio], the Searcio Search widget, a form Searcio takes over and the floating button look and behave, unless one of them says otherwise. The block and the Elementor widget keep their own settings.', 'searcio' ) }
					>
						<Grid className="whsc-placement-split" columns={ { base: 1, md: 2 } } gap="var(--wpds-dimension-gap-xl)" align="start">
							<Stack direction="column" gap="lg">
								<ToggleGroupControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									isBlock
									label={ __( 'Shown as', 'searcio' ) }
									value={ search.mode }
									onChange={ ( value ) => setSearch( 'mode', value ) }
								>
									<ToggleGroupControlOption value="icon" label={ __( 'Magnifier', 'searcio' ) } />
									<ToggleGroupControlOption value="box" label={ __( 'Search field', 'searcio' ) } />
								</ToggleGroupControl>
								<InputControl
									label={ __( 'Placeholder', 'searcio' ) }
									description={ translateHint }
									value={ search.placeholder }
									onValueChange={ ( value ) => setSearch( 'placeholder', value ) }
								/>
								<SelectControl
									label={ __( 'Content to search', 'searcio' ) }
									{ ...selectProps( typeItems, search.type, ( value ) => setSearch( 'type', value || '' ) ) }
								/>
								{ 'box' === search.mode && (
									<InputControl
										type="number"
										min={ 0 }
										max={ 1200 }
										label={ __( 'Width of the field (px)', 'searcio' ) }
										description={ __( '0 fills the space it is placed in.', 'searcio' ) }
										value={ String( search.width ?? 0 ) }
										onValueChange={ ( value ) => setSearch( 'width', Math.max( 0, parseInt( value, 10 ) || 0 ) ) }
									/>
								) }
								<ToggleGroupControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									isBlock
									label={ __( 'Alignment', 'searcio' ) }
									value={ search.align }
									onChange={ ( value ) => setSearch( 'align', value ) }
								>
									<ToggleGroupControlOption value="start" label={ __( 'Start', 'searcio' ) } />
									<ToggleGroupControlOption value="center" label={ __( 'Centre', 'searcio' ) } />
									<ToggleGroupControlOption value="end" label={ __( 'End', 'searcio' ) } />
								</ToggleGroupControl>
								<SelectControl
									label={ __( 'Search starts', 'searcio' ) }
									{ ...selectProps( triggerItems, search.trigger, ( value ) => setSearch( 'trigger', value || 'submit' ) ) }
								/>
								<SelectControl
									label={ __( 'Before a search, the window shows', 'searcio' ) }
									{ ...selectProps( highlightItems, search.highlights, ( value ) => setSearch( 'highlights', value || 'newest' ) ) }
								/>
								<RangeControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __( 'Filter buttons in the bar', 'searcio' ) }
									help={ __( '0 shows "All filters" alone.', 'searcio' ) }
									min={ 0 }
									max={ 8 }
									value={ search.filters }
									onChange={ ( value ) => setSearch( 'filters', Number.isFinite( value ) ? value : 5 ) }
								/>
								<SelectControl
									label={ __( 'Opening animation', 'searcio' ) }
									{ ...selectProps( animationItems, search.animation, ( value ) => setSearch( 'animation', value || 'fade' ) ) }
								/>
								<SelectControl
									label={ __( 'Result cards', 'searcio' ) }
									{ ...selectProps( cardItems, search.cards, ( value ) => setSearch( 'cards', value || 'plugin' ) ) }
								/>
								<ToggleControl
									__nextHasNoMarginBottom
									label={ __( 'Voice search', 'searcio' ) }
									checked={ search.voice }
									onChange={ ( checked ) => setSearch( 'voice', checked ) }
								/>
								<ToggleControl
									__nextHasNoMarginBottom
									label={ __( 'Show how many results each filter leaves', 'searcio' ) }
									checked={ search.count }
									onChange={ ( checked ) => setSearch( 'count', checked ) }
								/>
								<Fieldset.Root className="whsc-placement-colors">
									<Fieldset.Legend>{ __( 'Colours', 'searcio' ) }</Fieldset.Legend>
									<Grid auto={ 200 } gap="var(--wpds-dimension-gap-sm)" align="start">
										{ [
											[ 'accent', __( 'Accent', 'searcio' ) ],
											[ 'background', __( 'Window background', 'searcio' ) ],
											[ 'text', __( 'Text', 'searcio' ) ],
											[ 'icon_color', __( 'Magnifier', 'searcio' ) ],
										].map( ( [ key, label ] ) => (
											<ColorField
												key={ key }
												label={ label }
												value={ search[ key ] }
												onChange={ ( value ) => setSearch( key, value || '' ) }
											/>
										) ) }
									</Grid>
								</Fieldset.Root>
								<RangeControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									label={ __( 'Corner radius of the window (px)', 'searcio' ) }
									min={ 0 }
									max={ 48 }
									allowReset
									// The storefront's own radius, where the slider rests while none is set.
									initialPosition={ 14 }
									value={ search.radius ?? undefined }
									onChange={ ( value ) => setSearch( 'radius', Number.isFinite( value ) ? value : null ) }
								/>
							</Stack>

							<Stack direction="column" gap="md" className="whsc-placement-preview-column">
								<ToggleGroupControl
									__next40pxDefaultSize
									__nextHasNoMarginBottom
									isBlock
									label={ __( 'Preview', 'searcio' ) }
									value={ previewView }
									onChange={ ( value ) => setPreviewView( value ) }
								>
									<ToggleGroupControlOption value="trigger" label={ __( 'On the page', 'searcio' ) } />
									<ToggleGroupControlOption value="modal" label={ __( 'Window open', 'searcio' ) } />
								</ToggleGroupControl>
								<Preview
									preview={ catalog?.preview }
									view={ previewView }
									placement={ placement }
									title={ __( 'Preview of the search on a page of the site', 'searcio' ) }
								/>
								<Text render={ <p /> } variant="body-sm" className="whsc-placement-preview-note">
									{ __( 'Drawn in your theme\'s styles, from the settings on screen. Save to put them on the site.', 'searcio' ) }
								</Text>
							</Stack>
						</Grid>
					</PlainSection>
				</>
			),
		},
		{
			id: 'shortcodes',
			label: __( 'Shortcodes', 'searcio' ),
			summary: [
				`[${ SEARCH_TAG }]`,
				`[${ PRODUCTS_TAG }]`,
			],
			content: (
				<>
					{ /* Two regions, so two cards: side by side where each has room. */ }
					<Grid auto={ 360 } gap="var(--wpds-dimension-gap-lg)" align="start">
						<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
							<CardHeading
								title={ __( 'Shortcode for the search', 'searcio' ) }
								description={ __( 'Change what one place needs; what the Look section already sets is left out of the shortcode.', 'searcio' ) }
							/>
							<Card.Content className="whsc-settings-card-content">
								<Stack direction="column" gap="lg">
									<ToggleGroupControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										isBlock
										label={ __( 'Shown as', 'searcio' ) }
										value={ searchValues.mode }
										onChange={ ( value ) => setSearchShortcode( ( current ) => ( { ...current, mode: value } ) ) }
									>
										<ToggleGroupControlOption value="icon" label={ __( 'Magnifier', 'searcio' ) } />
										<ToggleGroupControlOption value="box" label={ __( 'Search field', 'searcio' ) } />
									</ToggleGroupControl>
									<InputControl
										label={ __( 'Placeholder', 'searcio' ) }
										value={ searchValues.placeholder }
										onValueChange={ ( value ) => setSearchShortcode( ( current ) => ( { ...current, placeholder: value } ) ) }
									/>
									<SelectControl
										label={ __( 'Content to search', 'searcio' ) }
										{ ...selectProps( typeItems, searchValues.type, ( value ) => setSearchShortcode( ( current ) => ( { ...current, type: value || '' } ) ) ) }
									/>
									<Snippet code={ buildShortcode( SEARCH_TAG, searchValues, search, SEARCH_ORDER ) } label={ __( 'The search shortcode', 'searcio' ) } />
								</Stack>
							</Card.Content>
						</Card.Root>
						<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
							<CardHeading
								title={ __( 'Shortcode for a product row', 'searcio' ) }
								description={ __( 'Similar products on a product page, or a category listing on a category page. On a page without either, it shows nothing.', 'searcio' ) }
							/>
							<Card.Content className="whsc-settings-card-content">
								<Stack direction="column" gap="lg">
									<ToggleGroupControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										isBlock
										label={ __( 'Products', 'searcio' ) }
										value={ productsValues.source }
										onChange={ ( value ) => setProductsShortcode( ( current ) => ( { ...current, source: value } ) ) }
									>
										<ToggleGroupControlOption value="similar" label={ __( 'Similar', 'searcio' ) } />
										<ToggleGroupControlOption value="category" label={ __( 'Category', 'searcio' ) } />
									</ToggleGroupControl>
									<ToggleGroupControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										isBlock
										label={ __( 'Layout', 'searcio' ) }
										value={ productsValues.layout }
										onChange={ ( value ) => setProductsShortcode( ( current ) => ( { ...current, layout: value } ) ) }
									>
										<ToggleGroupControlOption value="carousel" label={ __( 'Carousel', 'searcio' ) } />
										<ToggleGroupControlOption value="grid" label={ __( 'Grid', 'searcio' ) } />
									</ToggleGroupControl>
									<InputControl
										label={ __( 'Heading', 'searcio' ) }
										value={ productsValues.heading }
										onValueChange={ ( value ) => setProductsShortcode( ( current ) => ( { ...current, heading: value } ) ) }
									/>
									<Snippet code={ buildShortcode( PRODUCTS_TAG, productsValues, products, PRODUCTS_ORDER ) } label={ __( 'The product row shortcode', 'searcio' ) } />
								</Stack>
							</Card.Content>
						</Card.Root>
					</Grid>
				</>
			),
		},
		{
			id: 'products',
			label: __( 'Product rows', 'searcio' ),
			summary: [
				'category' === products.source ? __( 'Category', 'searcio' ) : __( 'Similar', 'searcio' ),
				'grid' === products.layout ? __( 'Grid', 'searcio' ) : __( 'Carousel', 'searcio' ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Defaults of a product row', 'searcio' ) }
						description={ __( 'What [searcio_products] and the Searcio Products widget show unless they say otherwise.', 'searcio' ) }
					>
						<Grid auto={ 240 } rowGap="var(--wpds-dimension-gap-lg)" columnGap="var(--wpds-dimension-gap-xl)" align="start">
							<ToggleGroupControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								isBlock
								label={ __( 'Products', 'searcio' ) }
								value={ products.source }
								onChange={ ( value ) => setProducts( 'source', value ) }
							>
								<ToggleGroupControlOption value="similar" label={ __( 'Similar', 'searcio' ) } />
								<ToggleGroupControlOption value="category" label={ __( 'Category', 'searcio' ) } />
							</ToggleGroupControl>
							<ToggleGroupControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								isBlock
								label={ __( 'Layout', 'searcio' ) }
								value={ products.layout }
								onChange={ ( value ) => setProducts( 'layout', value ) }
							>
								<ToggleGroupControlOption value="carousel" label={ __( 'Carousel', 'searcio' ) } />
								<ToggleGroupControlOption value="grid" label={ __( 'Grid', 'searcio' ) } />
							</ToggleGroupControl>
							<InputControl
								type="number"
								min={ 0 }
								max={ 24 }
								label={ __( 'Number of products', 'searcio' ) }
								description={ __( 'Empty or 0 is 6 similar products, or 12 in a category.', 'searcio' ) }
								value={ null === products.limit ? '' : String( products.limit ) }
								onValueChange={ ( value ) => {
									const limit = parseInt( value, 10 );

									setProducts( 'limit', Number.isFinite( limit ) && limit > 0 ? Math.min( 24, limit ) : null );
								} }
							/>
							<InputControl
								label={ __( 'Heading', 'searcio' ) }
								description={ translateHint }
								value={ products.heading }
								onValueChange={ ( value ) => setProducts( 'heading', value ) }
							/>
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __( 'Show a category\'s banner', 'searcio' ) }
								help={ __( 'A merchandising rule\'s banner, above a category listing.', 'searcio' ) }
								checked={ products.banner }
								onChange={ ( checked ) => setProducts( 'banner', checked ) }
							/>
						</Grid>
					</PlainSection>
				</>
			),
		},
		{
			id: 'ways',
			label: __( 'Other ways to place it', 'searcio' ),
			summary: [
				__( 'Blocks, widgets, menus and links', 'searcio' ),
			],
			content: (
				<>
					<PlainSection
						title={ __( 'Other ways to place it', 'searcio' ) }
						description={ __( 'Each of these uses the settings of the Look section, unless it has settings of its own.', 'searcio' ) }
					>
						<Grid auto={ 300 } rowGap="var(--wpds-dimension-gap-xl)" columnGap="var(--wpds-dimension-gap-2xl)" align="start" className="whsc-placement-ways">
							<Stack direction="column" gap="xs" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'Block editor', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'The Searcio Search and Searcio Products blocks, in a page, a template or a block widget area. They have settings and styles of their own.', 'searcio' ) }</Text>
							</Stack>
							<Stack direction="column" gap="xs" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'Elementor', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'The Searcio Search and Searcio Products widgets, under Searcio in the panel, with settings and styles of their own.', 'searcio' ) }</Text>
							</Stack>
							<Stack direction="column" gap="xs" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'Classic widgets', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'Searcio Search and Searcio Products under Appearance > Widgets, for a theme with classic widget areas.', 'searcio' ) }</Text>
							</Stack>
							<Stack direction="column" gap="xs" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'Menu item', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'Under Appearance > Menus, the Searcio box adds a search item to a menu. In a Navigation block, add a custom link to #searcio.', 'searcio' ) }</Text>
							</Stack>
							<Stack direction="column" gap="sm" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'A link or a button', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'A link to #searcio, or any element with the class searcio-open, opens the search: a page builder\'s button, a theme option\'s link, an icon.', 'searcio' ) }</Text>
								<Snippet code={ '<a href="#searcio" class="searcio-open">' + __( 'Search', 'searcio' ) + '</a>' } label={ __( 'A link that opens the search', 'searcio' ) } />
							</Stack>
							<Stack direction="column" gap="sm" className="whsc-placement-way">
								<Text render={ <h4 /> } variant="heading-sm">{ __( 'PHP in a child theme', 'searcio' ) }</Text>
								<Text render={ <p /> } variant="body-sm">{ __( 'Where a template of the theme should draw the search itself, for example in header.php.', 'searcio' ) }</Text>
								<Snippet code={ "<?php echo do_shortcode( '[searcio]' ); ?>" } label={ __( 'PHP that draws the search', 'searcio' ) } />
							</Stack>
						</Grid>
					</PlainSection>
				</>
			),
		},
	];

	return (
		<Stack direction="column" gap="lg" className="webhead-search-cloud-placement-tab">
			<TabIntro
				title={ __( 'Placement', 'searcio' ) }
				description={ __(
					'Puts the search where a block or an Elementor widget cannot go: into the theme\'s own search, a floating button, shortcodes and classic widgets. Every way here is off until you turn it on.',
					'searcio'
				) }
			/>

			<SectionList label={ __( 'Placement settings', 'searcio' ) } sections={ sections } />

			{ saveError && (
				<Notice.Root intent="error">
					<Notice.Description>{ saveError }</Notice.Description>
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
		</Stack>
	);
};

export default PlacementTab;
