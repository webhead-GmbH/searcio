import {useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from '@wordpress/element';
import {Button, Icon, Modal} from '@wordpress/components';
import {chevronDown, closeSmall, search as searchIcon} from '@wordpress/icons';
import {__, _n, sprintf} from '@wordpress/i18n';

import {currentLangFilter, fetchCardTemplates, fetchPopularSearches, fetchStorefrontConfig, getConfig, isConfigured, isLanguageSupported, search, suggest, trackClick, visualSearch} from '../../../utils/api';
import {addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch} from '../../../utils/storage';
import {activeFilterCount, appendHits, buildFilterParams, buildRangeParams, buildTypeParam, detectFacetDisplay, extractFieldFacets, extractRangeFields, facetCoverage, filterButtonLabel, freezeValueOrder, hasBound, hasMorePages, humanizeFieldLabel, mergeFieldFacets, mergeRangeFields, orderFacetGroups, rangeLabel, summarizeSelection, toggleSelection, totalIsExact} from '../../../utils/facets';
import {formatPrice, PRICE_FIELDS} from '../../../utils/currency';
import {redirectTarget} from '../../../utils/redirect';
import {trackScrollEnd} from '../../../utils/scrollEnd';
import {ResultCard} from './templates';
import {micIcon} from './icons';
import AiAssistant from './AiAssistant';
import QuizPane from './QuizPane';
import ActiveFilters from './ActiveFilters';
import FilterBar from './FilterBar';
import FilterPanel from './FilterPanel';
import FilterPopover from './FilterPopover';
import FilterSheet from './FilterSheet';
import SearchInput from './SearchInput';
import Suggestions, {optionId} from './Suggestions';
import Browse from './Browse';
import Carousel from './Carousel';
import SearchResultsSkeleton from './SearchResultsSkeleton';
import VisualSearchButton from './VisualSearchButton';
import SearcioCredit from './SearcioCredit';

const SUGGEST_DEBOUNCE = 200;
const LIVE_SEARCH_DEBOUNCE = 300;
const LIVE_SEARCH_MIN_LENGTH = 3;
// Picks made in quick succession share one request.
const FILTER_DEBOUNCE = 250;
// Under this width of the modal, the phone's layout: one scrolling row of
// filters, and sheets from the bottom instead of popovers and a drawer. The
// stylesheet's container queries use the same width.
const NARROW_WIDTH = 640;
// Under this width the input row has no room for three icon buttons.
const TIGHT_WIDTH = 360;
const DEFAULT_BAR_LIMIT = 5;
// Keep the skeleton on screen for at least this long so a very fast API
// response doesn't make the loading state flash by imperceptibly.
const MIN_LOADING = 0;

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * The width of the modal's scroll area, kept current as the window changes.
 * The filters lay themselves out by the modal's width, not the viewport's, so
 * a placement that narrows the modal gets the phone's layout too.
 *
 * @param {{current: ?HTMLElement}} ref An element inside the scroll area.
 * @return {number} 0 until it has been measured.
 */
const useModalWidth = (ref) => {
	const [width, setWidth] = useState(0);

	useLayoutEffect(() => {
		const area = ref.current?.closest('.components-modal__content') || ref.current;

		if (!area) {
			return undefined;
		}

		let frame = 0;
		const measure = () => setWidth(Math.round(area.clientWidth));

		measure();

		if (!window.ResizeObserver) {
			return undefined;
		}

		const observer = new window.ResizeObserver(() => {
			window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(measure);
		});

		observer.observe(area);

		return () => {
			observer.disconnect();
			window.cancelAnimationFrame(frame);
		};
	}, [ref]);

	return width;
};

const supportsVoice = () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

const nativeSearchUrl = (query) => {
	const config = getConfig();
	const url = new URL(config.siteHome || '/', window.location.origin);

	url.searchParams.set('s', query);

	return url.toString();
};

/**
 * Whether this run of a typing effect is the one a committed search caused
 * by putting `skipRef.current` in the field. The mark is used up by the first
 * run either way, so a later query is never skipped for it.
 *
 * @param {{current: ?string}} skipRef
 * @param {string}             trimmedQuery
 * @return {boolean}
 */
const takeSkip = (skipRef, trimmedQuery) => {
	const marked = skipRef.current;

	skipRef.current = null;

	return marked === trimmedQuery;
};

/**
 * Scroll one tab fully into the sideways-scrolling tab row, by the least
 * distance that does it.
 *
 * @param {?HTMLElement} list The tablist.
 * @param {?HTMLElement} tab  One of its tabs.
 */
const revealTab = (list, tab) => {
	if (!list || !tab || !list.contains(tab)) {
		return;
	}

	const row = list.getBoundingClientRect();
	const box = tab.getBoundingClientRect();

	if (box.left < row.left) {
		list.scrollLeft -= row.left - box.left;
	} else if (box.right > row.right) {
		list.scrollLeft += box.right - row.right;
	}
};

/**
 * @param {Object}   props
 * @param {string}   props.scopeType      Restrict results to one document type (empty = all types).
 * @param {string}   props.placeholder    Placeholder text for the search input.
 * @param {boolean}  props.enableVoice    Show the voice-input button for this instance.
 * @param {string}   [props.voiceIconHtml] Custom icon chosen for the voice button (Elementor icon picker); falls back to the built-in mic glyph when empty.
 * @param {string}   props.searchTrigger  'type' (auto-search past 3 chars) or 'submit' (Enter/button only).
 * @param {string}   props.instanceClass  Per-placement class so per-instance colors reach the portalled modal.
 * @param {string}   [props.cardSource]   'server' to render result cards from Searcio-designed templates
 *                                        (falls back to the plugin's own card per hit when no template matches).
 * @param {string}   [props.highlightsSource] 'featured' to source the empty-query highlights carousel from
 *                                            `filter[featured]=true` instead of a plain match-all (default 'newest').
 * @param {number}   [props.facetBarLimit] How many filter buttons the bar shows at most; 0 shows "All filters" alone.
 * @param {boolean}  [props.editorPreview] Opened by the Elementor editor for styling rather than by a visitor:
 *                                        it takes no focus and runs its search term once.
 * @param {string}   props.initialQuery   Seed value when opened from a box trigger the user was already typing in.
 * @param {(query: string) => void} [props.onQueryChange] Keeps a box trigger's own input in sync while the modal is open.
 * @param {Function} props.onRequestClose
 */
const SearchModal = ({
											 scopeType,
											 placeholder,
											 enableVoice,
											 voiceIconHtml,
											 searchTrigger,
											 instanceClass,
											 cardSource,
											 highlightsSource,
											 showCount,
											 animation,
											 facetBarLimit = DEFAULT_BAR_LIMIT,
											 editorPreview = false,
											 initialQuery,
											 onQueryChange,
											 onRequestClose,
										 }) => {
	const config = getConfig();
	const i18n = config.i18n || {};
	const typeLabels = config.typeLabels || {};
	const fieldLabels = config.fieldLabels || {};
	const suggestionsId = useId();
	const statusId = useId();

	const [query, setQuery] = useState(initialQuery || '');
	// A scope-locked instance never touches this - `buildTypeParam()` always
	// prefers `scopeType` when it's set.
	const [activeTypes, setActiveTypes] = useState([]);
	// Per-field facet selections, e.g. {brand: ['Acme', 'Duff']}.
	const [activeFacets, setActiveFacets] = useState({});
	// Every facet key from the last `/search` response other than the
	// built-in `types`, rendered as its own dynamic chip group.
	const [facetGroups, setFacetGroups] = useState({});
	// Numeric facet fields and the span the loaded hits cover, plus the bounds
	// the visitor has applied to them (`range[field]=min:max`).
	const [rangeFields, setRangeFields] = useState({});
	const [activeRanges, setActiveRanges] = useState({});
	// The filters as last picked, read by the request a pick schedules: the
	// state above has not re-rendered yet when it is sent.
	const filtersRef = useRef({types: [], facets: {}, ranges: {}});
	const filterTimer = useRef(null);
	// Which search the facet groups on screen came from, and what it loaded,
	// counted up each time an answer brings new groups.
	const groupsSource = useRef({key: null, hits: [], total: 0});
	const [groupsVersion, setGroupsVersion] = useState(0);
	// The bar's groups in order, and how each draws its values. Set once per
	// search and type scope (see the effect below), never by a pick.
	const [bar, setBar] = useState({key: null, order: [], displays: {}, types: []});
	// The panel open: a group's popover, a group's sheet on a phone, or "All
	// filters" (`all`). `anchor` is the button that opened it.
	const [openFilter, setOpenFilter] = useState(null);
	// The order each open panel's values had when it opened.
	const [frozen, setFrozen] = useState({});
	// Which sections of "All filters" are expanded.
	const [expanded, setExpanded] = useState({});
	// A press on the dimmed page that closed a popover, until it is let go.
	const [pressClosedPopover, setPressClosedPopover] = useState(false);
	const [fontsVersion, setFontsVersion] = useState(0);
	const bodyRef = useRef(null);
	const headerRef = useRef(null);
	const resultsHeadingRef = useRef(null);
	const popoverId = useId();
	const modalWidth = useModalWidth(bodyRef);
	const narrow = modalWidth > 0 && modalWidth < NARROW_WIDTH;
	const tight = modalWidth > 0 && modalWidth < TIGHT_WIDTH;
	const [suggestions, setSuggestions] = useState([]);
	const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
	// The suggestion the arrow keys are on, or -1 while they are on none.
	const [activeSuggestion, setActiveSuggestion] = useState(-1);
	const [results, setResults] = useState(null);
	const [highlights, setHighlights] = useState([]);
	// The search_id of the highlights carousel, so clicks on it attribute to the
	// same search the way result clicks attribute to `results.search_id`.
	const [highlightsSearchId, setHighlightsSearchId] = useState('');
	// Which of the extra modes this site may show - all read from
	// /storefront-config, so an upgrade (or publishing a quiz) flips them on
	// with no code change and nothing here ever offers a control the API would
	// only answer 403 to.
	const [assistantEnabled, setAssistantEnabled] = useState(false);
	const [quizEnabled, setQuizEnabled] = useState(false);
	const [visualEnabled, setVisualEnabled] = useState(false);
	// Semantic search changes what `total` in a `/search` response means - see
	// `totalIsExact()`.
	const [semanticEnabled, setSemanticEnabled] = useState(false);
	const [activeTab, setActiveTab] = useState('search');
	const [assistantOpened, setAssistantOpened] = useState(false);
	const [quizOpened, setQuizOpened] = useState(false);
	const tabListRef = useRef(null);

	// The tab row scrolls sideways once it is too narrow for every label, and
	// the close button that joins it on the assistant and quiz tabs narrows it
	// further - at 320px the tab just chosen was the one cut off. Bring the
	// active tab fully into the row, before paint so it never shows cut.
	useLayoutEffect(() => {
		revealTab(tabListRef.current, tabListRef.current?.querySelector('.whsc-modal-tab.is-active'));
	}, [activeTab]);
	// A tab the row's end cuts off fades out, so "Produktfinder" cut to
	// "Produl" at 320px reads as more to scroll to, not as a typo.
	useEffect(() => trackScrollEnd(tabListRef.current));
	// What the vision model saw in the uploaded photo, shown above the results
	// so a surprising result set is explained rather than just odd.
	const [visualTags, setVisualTags] = useState([]);
	// A photo search owns the results area even though the search box is empty,
	// which would otherwise read as "idle" and show the highlights carousel.
	const [visualActive, setVisualActive] = useState(false);
	// The photo being searched, shown beside what the model read from it. An
	// object URL for the visitor's own file - nothing is uploaded to show it.
	const [visualPreview, setVisualPreview] = useState('');
	// Which kind of search is in flight, apart from what is on screen: a typed
	// search run over a photo's results still has the photo's state until its
	// own answer arrives, and was titled and announced as a photo search.
	const [pendingKind, setPendingKind] = useState('text');
	const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
	const [facets, setFacets] = useState([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState('');
	const [recent, setRecent] = useState(() => getRecentSearches());
	const [isListening, setIsListening] = useState(false);
	const [serverTemplates, setServerTemplates] = useState([]);
	const [livePopularSearches, setLivePopularSearches] = useState([]);

	const suggestTimer = useRef(null);
	const liveSearchTimer = useRef(null);
	const recognitionRef = useRef(null);
	const inputRef = useRef(null);
	// Set by an explicit (committed) search to the query it put in the field, so
	// the run of the autocomplete effect that query causes skips
	// re-fetching/re-opening the dropdown over the results. Live "while typing"
	// searches leave it alone so suggestions keep updating as the visitor types.
	// It holds the query rather than a yes: a committed search for what the
	// field already holds (Enter) changes nothing, so the effect does not run
	// for it, and a yes stayed set and swallowed the visitor's next keystroke.
	const skipSuggestRef = useRef(null);
	// Like `skipSuggestRef`, but stops the "while typing" live-search effect
	// from firing a second, redundant request right after a committed search
	// (clicking a recent/popular/suggestion item sets the query, which would
	// otherwise trigger the live effect too).
	const skipLiveSearchRef = useRef(null);
	// Aborts the previous in-flight search when a newer one starts, and a
	// monotonic id so only the latest search may update state (rapid clicks no
	// longer race stale responses onto the screen).
	const abortRef = useRef(null);
	const searchSeq = useRef(0);
	// The same for the highlights: a newer load replaces what an older one
	// would still write.
	const highlightsSeq = useRef(0);

	// Type filters only make sense when the placement isn't already locked to
	// a single type, and when the search had more than one type to choose
	// between. A pressed type keeps the switch, so the way back to all types
	// stays. The types are the ones the search started with, each with its
	// count now: a type a pick leaves empty stays, at 0, so the bar never moves.
	const barTypes = bar.types.length > 0 ? bar.types : facets.map((facet) => facet.value);
	const typeFacets = barTypes.map((value) => ({value, count: facets.find((facet) => facet.value === value)?.count ?? 0}));
	const showTypes = '' === (scopeType || '') && (typeFacets.length > 1 || activeTypes.length > 0);
	// The filters Search Config lists, in its order, with how each is drawn.
	// Dynamic field facet groups (brand, color, ...) are orthogonal to a
	// type-scope lock - they render whenever the site has any configured,
	// regardless of `scopeType`.
	const configFacets = Array.isArray(config.facets) ? config.facets : [];
	const facetSettings = useMemo(() => Object.fromEntries(configFacets.map((facet) => [facet.field, facet])), [configFacets]);
	const configuredOrder = useMemo(
		() => [...configFacets].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).map((facet) => facet.field),
		[configFacets]
	);
	const locale = document.documentElement.lang || undefined;
	const activeCount = activeFilterCount(activeFacets, activeRanges);

	filtersRef.current = {types: activeTypes, facets: activeFacets, ranges: activeRanges};
	const filtered = activeTypes.length > 0 || activeCount > 0;
	const curatedPopularSearches = Array.isArray(config.popularSearches) ? config.popularSearches : [];
	// Live queries from the API are the primary source - they reflect what
	// visitors are actually searching for right now. The curated admin list
	// is only a fallback, used when the live fetch hasn't returned anything
	// yet, comes back empty, or errors out.
	const popularSearches = livePopularSearches.length > 0 ? livePopularSearches : curatedPopularSearches;
	const trimmedQuery = query.trim();
	const queryRef = useRef(query);

	queryRef.current = query;

	// An empty field with a filter picked browses the catalogue by that filter;
	// only an empty field with nothing picked is the window at rest.
	const showEmptyState = '' === trimmedQuery && !visualActive && !filtered;
	// The tab bar exists only if there is a second mode to switch to; with none,
	// the modal is the plain search box it has always been.
	const hasTabs = assistantEnabled || quizEnabled;
	const showSearchPane = !hasTabs || 'search' === activeTab;

	useEffect(() => {
		onQueryChange?.(query);
	}, [query, onQueryChange]);

	// In the Elementor editor the modal reopens every time a Content setting
	// re-renders the widget; taking focus then would pull it out of the field
	// being typed into in the editor's panel.
	useEffect(() => {
		if (!editorPreview) {
			inputRef.current?.focus();
		}
	}, [editorPreview]);

	// `Modal` (`@wordpress/components`) always portals its frame straight to
	// `document.body` and doesn't forward unrecognized props to it, so
	// `data-webhead-frontend-root` can't be passed in as a prop like
	// `className` above - it has to be set on the real DOM node once it
	// exists. Scopes the shared frontend reset
	// (`src/components/Default/frontend-reset.scss`) to the modal, the same
	// way `instanceClass` already reaches it despite not being a DOM
	// descendant of the trigger.
	//
	// Set on `.whsc-modal-overlay` (via `overlayClassName` below), the actual
	// parent of `.components-modal__frame.whsc-modal` - not on the frame
	// itself. Every themed rule in `style.scss` is written as
	// `.whsc-modal .whsc-facet` etc. (the attribute-boosted wrapper prepends
	// a strict descendant combinator), and a `.whsc-modal .foo` selector can
	// only match when the attribute lives on an actual ancestor of the frame.
	// Setting it directly on the frame made `.whsc-modal` and the attribute
	// holder the *same node*, so none of those descendant selectors ever
	// matched and every rule silently lost to the shared reset instead.
	useEffect(() => {
		const overlay = document.querySelector('.whsc-modal-overlay');

		overlay?.setAttribute('data-webhead-frontend-root', '');
	}, []);

	// Fetched once per modal session (not per query) per `card-templates.md`'s
	// "fetch once per page load" guidance - `api.js`'s own TTL cache also
	// covers the case where the visitor closes and reopens the modal shortly
	// after. A fetch failure just leaves the list empty, so every hit falls
	// back to the plugin's own card rather than breaking the search.
	useEffect(() => {
		if ('server' !== cardSource || !isConfigured()) {
			return;
		}

		let cancelled = false;

		fetchCardTemplates()
			.then((response) => {
				if (!cancelled) {
					setServerTemplates(response.templates || []);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setServerTemplates([]);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [cardSource]);

	// What this site's plan and setup allow. Fetched once so each extra mode
	// only appears when the account can actually use it; a failure leaves them
	// all off, which degrades to plain search rather than to a broken control.
	useEffect(() => {
		if (!isConfigured()) {
			return undefined;
		}

		let cancelled = false;

		fetchStorefrontConfig()
			.then((response) => {
				if (!cancelled) {
					const capabilities = response?.capabilities || {};

					setAssistantEnabled(Boolean(capabilities.assistant));
					setQuizEnabled(Boolean(capabilities.quiz));
					setVisualEnabled(Boolean(capabilities.visual_search));
					setSemanticEnabled(Boolean(capabilities.semantic_search));
				}
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, []);

	// The curated `popular_searches` setting is only a fallback for when this
	// fetch returns nothing or fails - `popularSearches` above starts on the
	// curated list and only stays there if the live list ends up empty.
	useEffect(() => {
		if (!isConfigured()) {
			return;
		}

		let cancelled = false;

		fetchPopularSearches()
			.then((response) => {
				if (!cancelled) {
					setLivePopularSearches((response.popular || []).map((item) => item.query));
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLivePopularSearches([]);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	// `facetsOverride` lets a field-facet click pass its just-toggled selection
	// straight through instead of reading `activeFacets` state, which hasn't
	// re-rendered yet at the point the click handler fires the request.
	const loadHighlights = useCallback(async (type, facetsOverride, rangesOverride) => {
		if (!isConfigured()) {
			setIsLoadingHighlights(false);

			return;
		}

		const seq = ++highlightsSeq.current;
		const isLatest = () => seq === highlightsSeq.current;
		// The chips, the field facets and the ranges are the search's once one
		// has started: they describe the results on screen. The first, empty
		// request of a modal can take seconds, and its answer for the whole
		// catalogue replaced the chips over the results of the query typed
		// meanwhile ("Products 152" over 20 results).
		const searchBefore = searchSeq.current;

		setIsLoadingHighlights(true);
		const started = Date.now();

		// Only the empty-query carousel gets this forced filter, not a real
		// text search. `currentLangFilter()` quietly resolves to no filter at
		// all for an unsupported/unrestricted language, since there's no
		// sensible native-search fallback for a passive, empty-query carousel
		// (unlike a real committed search below).
		const forced = {...currentLangFilter(), ...('featured' === highlightsSource ? {featured: 'true'} : {})};
		const appliedFacets = facetsOverride ?? activeFacets;
		const appliedRanges = rangesOverride ?? activeRanges;
		const filters = buildFilterParams(appliedFacets, forced);
		const ranges = buildRangeParams(appliedRanges);

		try {
			const response = await search('', {type, filters, ranges, perPage: 12});

			if (!isLatest()) {
				return;
			}

			setHighlights(response.hits || []);
			setHighlightsSearchId(response.search_id || '');

			if (searchBefore !== searchSeq.current) {
				return;
			}

			// Only refresh the type chip list when this request had no type
			// filter applied - confirmed live that this API's `facets.types`
			// collapses to just the active selection otherwise, which would
			// erase every other chip a multi-select needs to stay clickable.
			if ('' === type) {
				setFacets(response.facets?.types || []);
			}
			setFacetGroups((current) => mergeFieldFacets(current, extractFieldFacets(response.facets), appliedFacets));
			setRangeFields((current) => mergeRangeFields(current, extractRangeFields(response.facets, response.hits), appliedRanges));
			groupsSource.current = {key: `|${type}`, hits: response.hits || [], total: Number(response.total) || 0};
			setGroupsVersion((version) => version + 1);
		} catch (e) {
			if (isLatest()) {
				setHighlights([]);
			}
		} finally {
			await delay(Math.max(0, MIN_LOADING - (Date.now() - started)));

			if (isLatest()) {
				setIsLoadingHighlights(false);
			}
		}
	}, [activeFacets, activeRanges, highlightsSource]);

	useEffect(() => {
		void loadHighlights(scopeType || '');
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount; facet/type changes reload explicitly.
	}, []);

	// Lightweight autocomplete - always runs while typing regardless of
	// `searchTrigger`; it's cheap and not metered as a search.
	useEffect(() => {
		window.clearTimeout(suggestTimer.current);

		if (takeSkip(skipSuggestRef, trimmedQuery)) {
			return;
		}

		setSuggestionsDismissed(false);

		if ('' === trimmedQuery) {
			setSuggestions([]);

			return;
		}

		if (!isConfigured()) {
			return;
		}

		suggestTimer.current = window.setTimeout(async () => {
			try {
				const response = await suggest(trimmedQuery);

				setSuggestions(response.suggestions || []);
			} catch (e) {
				setSuggestions([]);
			}
		}, SUGGEST_DEBOUNCE);

		return () => window.clearTimeout(suggestTimer.current);
	}, [trimmedQuery]);

	/**
	 * Search for `q` with the filters given, or the ones on screen.
	 *
	 * A pick passes its filters in (`types`, `facets`, `ranges`): the state
	 * they were just written to has not re-rendered yet when the request goes
	 * out. A pick also keeps the results on screen while the new ones load
	 * (`keep`), so they change behind an open popover instead of turning into
	 * a skeleton under it.
	 *
	 * An empty query with a filter picked searches the whole catalogue by that
	 * filter; an empty query with none puts the highlights back.
	 *
	 * @param {string} q
	 * @param {Object} [options]
	 * @param {string[]} [options.types]
	 * @param {Object}   [options.facets]
	 * @param {Object}   [options.ranges]
	 * @param {boolean}  [options.commit] An explicit search, see below.
	 * @param {boolean}  [options.keep]   Keep the results on screen while it loads.
	 */
	const runSearch = useCallback(async (q, {types, facets: facetsOverride, ranges: rangesOverride, commit = true, keep = false} = {}) => {
		const trimmed = q.trim();
		const appliedTypes = types ?? activeTypes;
		const appliedFacets = facetsOverride ?? activeFacets;
		const appliedRanges = rangesOverride ?? activeRanges;
		const type = buildTypeParam(scopeType, appliedTypes);
		const browseCatalogue = '' === trimmed && (appliedTypes.length > 0 || activeFilterCount(appliedFacets, appliedRanges) > 0);

		setQuery(q);

		// A committed search (Enter, Search button, suggestion/chip/popular
		// click, voice) closes the autocomplete dropdown and tells the typing
		// effect to skip its next re-open. A live "while typing" search leaves
		// the dropdown alone so suggestions keep tracking the query.
		if (commit) {
			setSuggestions([]);
			setSuggestionsDismissed(true);
			skipSuggestRef.current = trimmed;
			// A committed query also arrives at the live-search effect; skip its
			// run for this query and cancel any already-scheduled live-search
			// timer so the same query isn't fetched a second time (which also
			// defeats the response cache).
			skipLiveSearchRef.current = trimmed;
			window.clearTimeout(liveSearchTimer.current);
		}

		if ('' === trimmed && !browseCatalogue) {
			// Nothing still loading may write its results over the highlights.
			abortRef.current?.abort();
			searchSeq.current += 1;
			setIsSearching(false);
			setResults(null);
			// An empty search leaves the photo behind too. Kept, the column stayed
			// in the photo state with nothing left to show in it.
			setVisualTags([]);
			setVisualActive(false);
			setVisualPreview('');

			return;
		}

		// An unsupported visitor language degrades exactly like an
		// unconfigured/unreachable API - native search, not a Searcio
		// query scoped to the wrong (or no) content. Browsing by a filter has
		// no query to hand over, so it stays where it is.
		if (!isConfigured() || !isLanguageSupported()) {
			if (browseCatalogue) {
				// A pick marked the results as loading before it got here.
				setIsSearching(false);
			} else {
				window.location.href = nativeSearchUrl(trimmed);
			}

			return;
		}

		// Cancel any in-flight search and claim the latest sequence id.
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const seq = ++searchSeq.current;
		const isLatest = () => seq === searchSeq.current;

		setPendingKind(keep ? 'filter' : 'text');
		setIsSearching(true);
		setError('');
		const started = Date.now();

		const filters = buildFilterParams(appliedFacets, currentLangFilter());
		const ranges = buildRangeParams(appliedRanges);

		try {
			const response = await search(trimmed, {type, filters, ranges, signal: controller.signal});

			if (!isLatest()) {
				return;
			}

			/*
			 * A term the merchant configured as a redirect answers with
			 * `{query, redirect}` and no results at all, so this has to be
			 * checked before anything tries to render hits.
			 *
			 * Only a committed search navigates. In "search as you type" mode a
			 * live search fires from the fourth character on, so a visitor
			 * typing "sale shoes" on a site that redirects "sale" would be
			 * thrown off the page mid-word. Pressing Enter - or clicking a
			 * suggestion, chip or popular term - is an explicit "search for
			 * exactly this", which is when the rule is meant to fire.
			 */
			const target = '' === trimmed ? '' : redirectTarget(response);

			if ('' !== target) {
				if (commit) {
					setRecent(addRecentSearch(trimmed));
					window.location.href = target;

					return;
				}

				// Nothing to show for this keystroke: leave whatever is on
				// screen alone rather than blanking it out.
				return;
			}

			setResults({...response, pageCount: (response.hits || []).length, searchedQuery: trimmed});
			// A typed search replaces whatever a photo put on screen.
			setVisualTags([]);
			setVisualActive(false);
			setVisualPreview('');

			// See the matching comment in `loadHighlights()` - only refresh the
			// type chip list from an unfiltered-by-type request.
			if ('' === type) {
				setFacets(response.facets?.types || []);
			}

			setFacetGroups((current) => mergeFieldFacets(current, extractFieldFacets(response.facets), appliedFacets));
			setRangeFields((current) => mergeRangeFields(current, extractRangeFields(response.facets, response.hits), appliedRanges));
			groupsSource.current = {key: `${trimmed}|${type}`, hits: response.hits || [], total: Number(response.total) || 0};
			setGroupsVersion((version) => version + 1);

			if ('' !== trimmed) {
				setRecent(addRecentSearch(trimmed));
			}
		} catch (e) {
			// A superseded/cancelled request must not touch state or navigate.
			if ('AbortError' === e.name || !isLatest()) {
				return;
			}

			setError(i18n.error || __('Search is unavailable right now.', 'searcio'));

			// Handing the visitor over to native search is right for a search
			// they asked for. It is wrong for a keystroke: in "search as you
			// type" mode this fires on every character, so a single 429 or 5xx
			// mid-word would navigate them away with half a word as their query.
			// A live search that fails just shows the notice and waits.
			if (commit && !browseCatalogue) {
				window.location.href = nativeSearchUrl(trimmed);
			}
		} finally {
			if (isLatest()) {
				await delay(Math.max(0, MIN_LOADING - (Date.now() - started)));

				if (isLatest()) {
					setIsSearching(false);
				}
			}
		}
	}, [activeTypes, activeFacets, activeRanges, i18n.error, scopeType]);

	/**
	 * Search by photo. A vision model turns the image into tags and runs those
	 * as an ordinary search, so the response carries the same hits and facets a
	 * typed search would (`docs/api/visual-search.md`).
	 *
	 * Unlike a failed typed search this does not fall back to native `?s=`
	 * search: there is no query to hand over, and WordPress cannot search by
	 * photo. A failure says so and leaves the visitor where they are.
	 *
	 * @param {File} file
	 */
	useEffect(() => () => {
		if ('' !== visualPreview) {
			URL.revokeObjectURL(visualPreview);
		}
	}, [visualPreview]);

	const runVisualSearch = useCallback(async (file) => {
		if (!isConfigured()) {
			return;
		}

		// Clear the typed query so the results on screen are unambiguously the
		// photo's, and stop the live-search effect reacting to that change.
		skipLiveSearchRef.current = '';
		skipSuggestRef.current = '';
		setQuery('');
		setSuggestions([]);
		setSuggestionsDismissed(true);

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const seq = ++searchSeq.current;
		const isLatest = () => seq === searchSeq.current;

		setPendingKind('photo');
		setIsSearching(true);
		setError('');
		setVisualActive(true);
		setVisualTags([]);
		setVisualPreview(URL.createObjectURL(file));
		setResults(null);
		// A photo search takes no filters, and its response carries no facets to
		// re-render the chips from. Anything left over from a typed search would
		// be describing results that are no longer on screen - the type chip
		// still reading "product 4" over three photo matches - and a field
		// selection would sit invisible and silently narrow the next search.
		setActiveFacets({});
		setActiveTypes([]);
		setFacets([]);
		// `/search/visual` takes no filters at all, so an applied bound would
		// sit on screen describing a narrowing that is not being applied.
		setActiveRanges({});
		setRangeFields({});
		// Nor may a pick still waiting to be sent search over the photo.
		window.clearTimeout(filterTimer.current);
		filtersRef.current = {types: [], facets: {}, ranges: {}};
		setOpenFilter(null);

		try {
			const response = await visualSearch(file, {signal: controller.signal});

			if (!isLatest()) {
				return;
			}

			setVisualTags(Array.isArray(response?.tags) ? response.tags : []);
			setResults(response);
			setFacetGroups((current) => mergeFieldFacets(current, extractFieldFacets(response.facets), {}));
		} catch (e) {
			if ('AbortError' === e.name || !isLatest()) {
				return;
			}

			// Back to browsing, with the notice on top. Left in the photo state the
			// results column stayed empty - nothing a skeleton could resolve to,
			// and a blank half of the modal read as a broken page. The filters were
			// cleared for the photo, so the highlights come back unfiltered, with
			// the type chips and ranges that belong to them.
			setVisualActive(false);
			setVisualPreview('');
			void loadHighlights(scopeType || '', {}, {});

			if (403 === e.status) {
				// The capability said yes but the site has since turned it off.
				setVisualEnabled(false);
				setError(__('Photo search is not available on this store.', 'searcio'));
			} else if (422 === e.status) {
				setError(__('That file is not an image we can read. Try a JPEG or PNG under 8 MB.', 'searcio'));
			} else if (429 === e.status) {
				setError(__('Photo search has reached its limit for now. Please try again later.', 'searcio'));
			} else {
				setError(__('That photo search failed. Try another photo.', 'searcio'));
			}
		} finally {
			if (isLatest()) {
				setIsSearching(false);
			}
		}
	}, [loadHighlights, scopeType]);

	// Only in `type` mode does typing itself trigger the metered `/search`
	// call, and only once the query is long enough to be meaningful.
	useEffect(() => {
		window.clearTimeout(liveSearchTimer.current);

		// A committed search already ran this query; don't duplicate it here.
		if (takeSkip(skipLiveSearchRef, trimmedQuery)) {
			return;
		}

		if ('type' !== searchTrigger || trimmedQuery.length <= LIVE_SEARCH_MIN_LENGTH) {
			return;
		}

		liveSearchTimer.current = window.setTimeout(() => {
			void runSearch(query, {commit: false});
		}, LIVE_SEARCH_DEBOUNCE);

		return () => window.clearTimeout(liveSearchTimer.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on each keystroke via trimmedQuery is intentional.
	}, [trimmedQuery, searchTrigger]);

	// The editor preview opens with its search term already in the field; run
	// it once so there are results to style. Uncommitted: it is nobody's
	// search, so it is not saved as a recent search, and a term configured as
	// a redirect does not navigate the editor away. The suggestions dropdown
	// is closed as a committed search would close it, or it would cover the
	// filters and recent searches being styled; typing in the preview's own
	// field opens it again.
	useEffect(() => {
		if (editorPreview && '' !== trimmedQuery) {
			setSuggestionsDismissed(true);
			skipSuggestRef.current = trimmedQuery;
			void runSearch(query, {commit: false});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the preview opens.
	}, []);

	/**
	 * Write a set of filters and search with them.
	 *
	 * Every pick applies - there is no "Apply" - so picks made in quick
	 * succession wait for each other ({@see FILTER_DEBOUNCE}) and share one
	 * request, and a newer request overtakes an older one as typing does. A
	 * bound applies at once (`immediate`): its field waited for the typing to
	 * stop already.
	 *
	 * An empty field with nothing picked any more goes back to the highlights,
	 * and to the groups of the whole catalogue for the bar's panels.
	 *
	 * @param {{types: string[], facets: Object, ranges: Object}} next
	 * @param {{immediate?: boolean}} [options]
	 */
	const applyFilters = (next, {immediate = false} = {}) => {
		filtersRef.current = next;
		setActiveTypes(next.types);
		setActiveFacets(next.facets);
		setActiveRanges(next.ranges);
		window.clearTimeout(filterTimer.current);

		const searches = '' !== queryRef.current.trim() || next.types.length > 0 || activeFilterCount(next.facets, next.ranges) > 0;

		// Between the pick and its request the results are already on their
		// way: no flash of the highlights, nor of results the pick has undone.
		if (searches) {
			setPendingKind('filter');
			setIsSearching(true);
		}

		const send = () => {
			const latest = filtersRef.current;
			const q = queryRef.current;

			if ('' === q.trim() && 0 === latest.types.length && 0 === activeFilterCount(latest.facets, latest.ranges)) {
				void runSearch(q, {...latest, commit: false});
				void loadHighlights(buildTypeParam(scopeType, []), {}, {});

				return;
			}

			void runSearch(q, {...latest, commit: false, keep: true});
		};

		if (immediate) {
			send();
		} else {
			filterTimer.current = window.setTimeout(send, FILTER_DEBOUNCE);
		}
	};

	useEffect(() => () => window.clearTimeout(filterTimer.current), []);

	// Clicking "All" (empty type) clears the selection; clicking a type
	// toggles it in/out.
	const onTypeFacetClick = (type) => {
		const current = filtersRef.current;

		applyFilters({...current, types: '' === type ? [] : toggleSelection(current.types, type)});
	};

	// Multi-select per field, OR'ed together for that field's
	// `filter[field]=` value.
	const onFieldFacetClick = (field, value) => {
		const current = filtersRef.current;

		applyFilters({...current, facets: {...current.facets, [field]: toggleSelection(current.facets[field] || [], value)}});
	};

	// A bound arrives once its field has stopped changing (see `PriceRange`):
	// a partly typed number ("1" on the way to "150") is a different, wrong
	// filter, and searching for it would make the field fight the person
	// typing in it.
	const onRangeApply = (field, bound) => {
		const current = filtersRef.current;
		const ranges = {...current.ranges};

		if (hasBound(bound)) {
			ranges[field] = {min: String(bound.min ?? '').trim(), max: String(bound.max ?? '').trim()};
		} else {
			delete ranges[field];
		}

		applyFilters({...current, ranges}, {immediate: true});
	};

	const resetGroup = (field) => {
		const current = filtersRef.current;
		const facets = {...current.facets};
		const ranges = {...current.ranges};

		delete facets[field];
		delete ranges[field];
		applyFilters({...current, facets, ranges});
	};

	// The type stays: it is a scope, not one of the filters "Reset all" lists.
	const resetAll = () => applyFilters({...filtersRef.current, facets: {}, ranges: {}});

	// The bar's order for a search, set when the first answer for a new query
	// or type scope arrives. A pick narrows the groups but never reorders them:
	// a group the answer no longer has keeps its place, and one it newly has
	// is added at the end.
	useEffect(() => {
		const {key, hits, total} = groupsSource.current;
		const rangeOnly = Object.keys(rangeFields).filter((field) => !facetGroups[field]);
		const fields = [...Object.keys(facetGroups), ...rangeOnly];
		const active = [
			...Object.keys(activeFacets).filter((field) => (activeFacets[field] || []).length > 0),
			...Object.keys(activeRanges).filter((field) => hasBound(activeRanges[field])),
		];
		const display = (field) => (rangeOnly.includes(field)
			? 'range'
			: detectFacetDisplay(field, (facetGroups[field] || []).map((entry) => entry.value), facetSettings[field]));

		setBar((current) => {
			if (current.key !== key) {
				const coverage = facetCoverage({...facetGroups, ...Object.fromEntries(rangeOnly.map((field) => [field, []]))}, hits, total);
				const order = orderFacetGroups(fields, {configuredOrder, coverage, active});

				// The types too: a pick that leaves one type must not take the
				// switch out from under the bar.
				return {key, order, displays: Object.fromEntries(order.map((field) => [field, display(field)])), types: facets.map((facet) => facet.value)};
			}

			const added = fields.filter((field) => !current.order.includes(field));

			return 0 === added.length ? current : {
				...current,
				order: [...current.order, ...added],
				displays: {...current.displays, ...Object.fromEntries(added.map((field) => [field, display(field)]))},
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- once per answer that brought groups.
	}, [groupsVersion]);

	// A web font that arrives late widens the buttons it was measured without.
	useEffect(() => {
		let cancelled = false;

		document.fonts?.ready?.then(() => {
			if (!cancelled) {
				setFontsVersion((version) => version + 1);
			}
		});

		return () => {
			cancelled = true;
		};
	}, []);

	const labelOf = (field) => humanizeFieldLabel(field, fieldLabels);
	const displayOf = (field) => bar.displays[field]
		|| (rangeFields[field] && !facetGroups[field] ? 'range' : detectFacetDisplay(field, (facetGroups[field] || []).map((entry) => entry.value), facetSettings[field]));
	const isGroupActive = (field) => (activeFacets[field] || []).length > 0 || hasBound(activeRanges[field]);

	// A bound of a price field is written as the shop writes prices, without
	// decimals when it has none ("from 100 €"); any other is written as typed.
	const formatBound = (field) => (value) => {
		const number = Number(value);
		const currency = config.currency || {};

		if (!PRICE_FIELDS.has(field) || !Number.isFinite(number)) {
			return String(value);
		}

		return formatPrice(number, {...currency, decimals: Number.isInteger(number) ? 0 : (currency.decimals ?? 2)});
	};

	const selectionOf = (field) => {
		if (hasBound(activeRanges[field])) {
			return rangeLabel(activeRanges[field], formatBound(field));
		}

		const count = (activeFacets[field] || []).length;

		return count > 0 ? sprintf(
			/* translators: %d: number of filter values selected. */
			_n('%d selected', '%d selected', count, 'searcio'),
			count
		) : '';
	};

	// Fixes the order of a group's values for as long as its panel is open, so
	// no row moves under the pointer as picks change the counts.
	const freeze = (field) => {
		const values = facetGroups[field] || [];
		const counts = Object.fromEntries(values.map((entry) => [entry.value, entry.count]));

		setFrozen((current) => ({
			...current,
			[field]: freezeValueOrder(values.map((entry) => entry.value), counts, activeFacets[field] || [], {natural: 'tiles' === displayOf(field), locale}),
		}));
	};

	/**
	 * @param {{kind: string, field?: string, anchor?: HTMLElement}} next
	 */
	const openPanel = (next) => {
		setFrozen({});

		if ('all' === next.kind) {
			const active = bar.order.filter(isGroupActive);
			const open = active.length > 0 ? active : bar.order.slice(0, 1);

			setExpanded(Object.fromEntries(open.map((field) => [field, true])));
			open.forEach(freeze);
		} else {
			freeze(next.field);
		}

		// Results that change behind a popover must not move the bar it hangs
		// from: the body keeps the height it had when the popover opened.
		if ('popover' === next.kind && bodyRef.current && '' === bodyRef.current.style.minHeight) {
			bodyRef.current.style.minHeight = `${bodyRef.current.offsetHeight}px`;
		}

		setOpenFilter(next);
	};

	/**
	 * Close the open panel. A popover hands focus back to its button
	 * (`restore`), or on to the next control of the bar (`next`); a sheet's
	 * `Modal` gives it back to what opened it by itself. Every pick has
	 * applied already, so nothing is lost.
	 *
	 * @param {{restore?: boolean, next?: boolean, outside?: boolean}} [how]
	 */
	const closePanel = ({restore = true, next = false, outside = false} = {}) => {
		const current = openFilter;

		if (!current) {
			return;
		}

		// The popover goes as the press starts; the search must not go too
		// when it ends on the dimmed page. React draws the modal again in
		// between, and without this hold it would be listening by then.
		if (outside) {
			setPressClosedPopover(true);

			const release = () => {
				window.removeEventListener('pointerup', release);
				window.removeEventListener('pointercancel', release);
				// After the modal has had the press's end, and ignored it.
				window.setTimeout(() => setPressClosedPopover(false));
			};

			window.addEventListener('pointerup', release);
			window.addEventListener('pointercancel', release);
		}

		if ('popover' === current.kind && current.anchor) {
			const popover = document.getElementById(popoverId);
			const hadFocus = popover?.contains(popover.ownerDocument.activeElement);

			if (next) {
				const controls = Array.from(headerRef.current?.querySelectorAll('.whsc-filterbar .whsc-facet:not([hidden])') || []);
				const after = controls[controls.indexOf(current.anchor) + 1];

				(after || current.anchor).focus();
			} else if (restore || hadFocus) {
				// A press elsewhere that lands on nothing focusable would leave
				// focus on the page under the modal.
				current.anchor.focus({preventScroll: !restore});
			}
		}

		setOpenFilter(null);
		setFrozen({});
	};

	const onGroup = (field, button) => {
		if ('popover' === openFilter?.kind && field === openFilter.field) {
			closePanel();

			return;
		}

		openPanel({kind: narrow ? 'sheet' : 'popover', field, anchor: button});
	};

	const toggleSection = (field) => {
		if (!expanded[field]) {
			freeze(field);
		}

		setExpanded((current) => ({...current, [field]: !current[field]}));
	};

	// The body is held only while a popover is open.
	useEffect(() => {
		if ('popover' !== openFilter?.kind && bodyRef.current) {
			bodyRef.current.style.minHeight = '';
		}
	}, [openFilter]);

	// A popover belongs to the bar of one search at one width: a new search,
	// or the modal crossing into the phone's layout, closes it.
	useEffect(() => {
		setOpenFilter((current) => ('popover' === current?.kind ? null : current));
	}, [bar.key, narrow]);

	// The header stays at the top of the scroll area and draws a line under
	// itself once the results scroll beneath it.
	useEffect(() => {
		const header = headerRef.current;
		const scroller = header?.closest('.components-modal__content');

		if (!header || !scroller) {
			return undefined;
		}

		const onScroll = () => {
			const stuck = scroller.scrollTop > 0 && header.getBoundingClientRect().top - scroller.getBoundingClientRect().top < 1;

			header.classList.toggle('is-stuck', stuck);
		};

		scroller.addEventListener('scroll', onScroll, {passive: true});

		return () => scroller.removeEventListener('scroll', onScroll);
	}, [activeTab]);

	const onSelectSuggestion = (label) => {
		setSuggestionsDismissed(true);
		void runSearch(label);
	};

	/**
	 * Append the next page of the search already on screen.
	 *
	 * The API has always paged (`page` / `per_page`, with the true `total`
	 * alongside the hits); the modal only ever asked for page one and reported
	 * what it had loaded as if that were everything, so on a catalogue of any
	 * size the other results were unreachable.
	 *
	 * Appends rather than replaces: this is one continuous result list a
	 * visitor scrolls, not a numbered page they navigate away to.
	 */
	const loadMore = useCallback(async () => {
		if (isLoadingMore || !results) {
			return;
		}

		// Not a new search, so this must not claim a new sequence id - it only
		// has to notice if a real search has replaced what it was extending.
		const seq = searchSeq.current;
		const nextPage = (Number(results.page) || 1) + 1;
		const controller = new AbortController();

		abortRef.current = controller;
		setIsLoadingMore(true);

		try {
			const response = await search(trimmedQuery, {
				type: buildTypeParam(scopeType, activeTypes),
				filters: buildFilterParams(activeFacets, currentLangFilter()),
				ranges: buildRangeParams(activeRanges),
				page: nextPage,
				signal: controller.signal,
			});

			if (seq !== searchSeq.current) {
				return;
			}

			setResults((current) => ({
				...response,
				// Track the page that was asked for, not the one the response
				// echoes: a response without `page` would otherwise re-request
				// the same page on every click.
				page: nextPage,
				pageCount: (response.hits || []).length,
				// Clicks on every page attribute to the search that started it.
				search_id: current?.search_id || response.search_id,
				searchedQuery: current?.searchedQuery,
				hits: appendHits(current?.hits, response.hits),
			}));
		} catch (e) {
			if ('AbortError' !== e.name && seq === searchSeq.current) {
				setError(i18n.error || __('Search is unavailable right now.', 'searcio'));
			}
		} finally {
			// Released unconditionally, unlike the results above. A new search
			// starting mid-request is exactly when this must be let go: the
			// flag only says "a load-more request is in flight", and gating it
			// on the sequence would leave the next search's button reading
			// "Loading…" and disabled with nothing left to answer it.
			setIsLoadingMore(false);
		}
	}, [isLoadingMore, results, trimmedQuery, scopeType, activeTypes, activeFacets, activeRanges, i18n.error]);

	const onRemoveRecent = (label) => setRecent(removeRecentSearch(label));
	const onClearRecent = () => setRecent(clearRecentSearches());

	const onVoiceClick = () => {
		if (!supportsVoice()) {
			return;
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition();

		recognitionRef.current = recognition;
		recognition.lang = document.documentElement.lang || 'en-US';
		recognition.onstart = () => setIsListening(true);
		recognition.onend = () => setIsListening(false);
		recognition.onresult = (event) => {
			const transcript = event.results?.[0]?.[0]?.transcript || '';

			void runSearch(transcript);
		};
		recognition.start();
	};

	useEffect(() => () => {
		if (recognitionRef.current) {
			try {
				recognitionRef.current.stop();
			} catch (e) {
				// Already stopped.
			}
		}

		// Cancel any in-flight request when the modal closes.
		abortRef.current?.abort();
	}, []);

	const suggestionsOpen = !suggestionsDismissed && suggestions.length > 0;

	// A new list has nothing marked in it, and neither has one the visitor
	// has typed on from: Enter then searches for what is in the field.
	useEffect(() => {
		setActiveSuggestion(-1);
	}, [suggestions, query]);

	/**
	 * The keys of the search field. Down and Up move through the suggestions
	 * and round from one end to the other, while focus stays in the field;
	 * Enter searches for the one that is marked, and for what was typed when
	 * none is. Down also brings back a list that Escape put away.
	 */
	const onInputKeyDown = (event) => {
		// A key that only confirms a character being composed is not for us.
		// Safari reports the Enter that ends a composition as not composing,
		// with the key code every browser gives a key an input method took.
		if (event.nativeEvent?.isComposing || 229 === event.keyCode) {
			return;
		}

		if (('ArrowDown' === event.key || 'ArrowUp' === event.key) && suggestions.length > 0) {
			event.preventDefault();

			const step = 'ArrowDown' === event.key ? 1 : -1;
			const last = suggestions.length - 1;

			if (!suggestionsOpen) {
				setSuggestionsDismissed(false);
				setActiveSuggestion(1 === step ? 0 : last);

				return;
			}

			setActiveSuggestion((current) => {
				if (current < 0) {
					return 1 === step ? 0 : last;
				}

				return (current + step + suggestions.length) % suggestions.length;
			});

			return;
		}

		if ('Enter' === event.key) {
			event.preventDefault();

			if (suggestionsOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
				onSelectSuggestion(suggestions[activeSuggestion]);

				return;
			}

			void runSearch(query);
		}
	};

	const resultsHits = results?.hits || [];
	// `total` is only a count of matches on the lexical path; a semantic query
	// reports the size of the window it retrieved. Say "of 137" only when that
	// number means what it looks like it means.
	const exactTotal = totalIsExact(semanticEnabled, trimmedQuery);
	const totalResults = Number.isFinite(Number(results?.total)) ? Number(results.total) : resultsHits.length;
	// A photo search is a single fixed page server-side - it takes no `page`
	// parameter - so there is nothing more to load for one.
	const hasMore = !visualActive && hasMorePages(results, resultsHits.length, exactTotal);
	// Without an exact total there is only one number that is true: how many
	// are on screen.
	const shownTotal = exactTotal ? totalResults : resultsHits.length;

	// A pick keeps the results it narrows on screen while the new ones load,
	// so they change behind an open popover instead of turning into a skeleton.
	const updating = isSearching && 'filter' === pendingKind && null !== results;

	// The main slot inside the browse layout swaps between highlights (idle),
	// a skeleton (loading), and the results carousel / empty message. Recent
	// and popular searches go with the highlights, and popular searches with
	// a search that found nothing.
	let mainTitle;
	let mainContent;
	let helpers = 'none';

	// Which photo the results are for, and what the model read from it - so an
	// unexpected result set reads as a misread photo rather than broken search.
	const photoQuery = visualActive && '' !== visualPreview ? (
		<div className="whsc-visual-query">
			<img
				// A fresh element per photo: the `hidden` a failed one set is not
				// something React manages, and would hide every photo after it.
				key={visualPreview}
				className="whsc-visual-query__photo"
				src={visualPreview}
				alt={__('Your photo', 'searcio')}
				// A file that is not an image gets as far as the server before it
				// is refused; until then, no broken-image glyph.
				onError={(event) => {
					event.currentTarget.hidden = true;
				}}
			/>
			{!isSearching && visualTags.length > 0 && (
				<div className="whsc-visual-tags">
					<span className="whsc-visual-tags__label">
						{__('From your photo', 'searcio')}
					</span>
					<div className="whsc-visual-tags__list">
						{visualTags.map((tag) => (
							<span className="whsc-visual-tag" key={tag}>{tag}</span>
						))}
					</div>
				</div>
			)}
		</div>
	) : null;

	// The highlights also stay while a query is typed but not yet searched
	// (submit mode, before Enter). That state used to show their title over a
	// skeleton, which looked like a search loading that never finished.
	if (showEmptyState || (!isSearching && !results)) {
		helpers = 'all';
		mainTitle = __('Current highlights', 'searcio');
		mainContent = isLoadingHighlights ? (
			<SearchResultsSkeleton/>
		) : (
			<Carousel
				items={highlights}
				getKey={(hit) => hit.id}
				renderItem={(hit, index) => (
					<ResultCard
						hit={hit}
						cardSource={cardSource}
						serverTemplates={serverTemplates}
						onClick={() => trackClick(highlightsSearchId, hit.id, index + 1)}
					/>
				)}
				ariaLabel={__('Current highlights', 'searcio')}
			/>
		);
	} else if (isSearching && !updating) {
		mainTitle = 'photo' === pendingKind
			? __('Looking at your photo…', 'searcio')
			: __('Results', 'searcio');
		mainContent = (
			<>
				{'photo' === pendingKind && photoQuery}
				<SearchResultsSkeleton/>
			</>
		);
	} else if (results) {
		mainTitle = resultsHits.length > 0
			? (exactTotal && hasMore
				? sprintf(
					/* translators: 1: number of results loaded so far. 2: total number of results. */
					__('%1$d of %2$d results', 'searcio'),
					resultsHits.length,
					totalResults
				)
				: sprintf(
					/* translators: %d: number of results. */
					_n('%d result', '%d results', shownTotal, 'searcio'),
					shownTotal
				))
			: __('Results', 'searcio');
		mainContent = resultsHits.length > 0 ? (
			<div className={`whsc-results${updating ? ' is-updating' : ''}`} aria-busy={updating || undefined}>
			{photoQuery}
			<Carousel
				items={resultsHits}
				getKey={(hit) => hit.id}
				renderItem={(hit, index) => (
					<ResultCard
						hit={hit}
						cardSource={cardSource}
						serverTemplates={serverTemplates}
						onClick={() => trackClick(results?.search_id, hit.id, index + 1)}
					/>
				)}
				ariaLabel={__('Search results', 'searcio')}
			/>
			{hasMore && (
				<div className="whsc-load-more">
					<button
						type="button"
						className="whsc-load-more__button"
						onClick={() => void loadMore()}
						disabled={isLoadingMore}
					>
						{isLoadingMore
							? __('Loading…', 'searcio')
							: __('Load more results', 'searcio')}
					</button>
				</div>
			)}
			</div>
		) : (
			<>
			{photoQuery}
			<div className="whsc-no-results">
				<p className="whsc-no-results__title">
					{visualActive
						// A photo that matched nothing is a photo problem, not a
						// catalogue problem - say what to do about it.
						? __('No matches for that photo. Try a clearer shot, or one item on its own.', 'searcio')
						: (i18n.noResults || __('No results found.', 'searcio'))}
				</p>
				{!visualActive && (
					<p className="whsc-no-results__text">
						{activeCount > 0
							? __('No result matches the filters you chose. Remove one, or reset them all.', 'searcio')
							: __('Check the spelling, or try a more general word.', 'searcio')}
					</p>
				)}
				{!visualActive && activeCount > 0 && (
					<button type="button" className="whsc-btn whsc-btn--secondary" onClick={resetAll}>
						{__('Reset filters', 'searcio')}
					</button>
				)}
			</div>
			</>
		);

		if (0 === resultsHits.length) {
			helpers = 'popular';
		}
	}

	// The filters applied, as chips on the result line.
	const chips = [];

	[...new Set([...bar.order, ...Object.keys(activeFacets), ...Object.keys(activeRanges)])].forEach((field) => {
		if (hasBound(activeRanges[field])) {
			chips.push({key: `${field}:`, field, value: '', name: labelOf(field), label: rangeLabel(activeRanges[field], formatBound(field))});
		}

		(activeFacets[field] || []).forEach((value) => {
			chips.push({key: `${field}:${value}`, field, value, name: labelOf(field), label: value});
		});
	});

	const onRemoveChip = (chip) => {
		if ('' === chip.value) {
			onRangeApply(chip.field, {min: '', max: ''});
		} else {
			onFieldFacetClick(chip.field, chip.value);
		}
	};

	const showingResults = null !== results && !showEmptyState && !visualActive;
	const currency = config.currency || {};

	const panel = (field) => (
		<FilterPanel
			key={field}
			field={field}
			label={labelOf(field)}
			display={displayOf(field)}
			values={facetGroups[field] || []}
			selected={activeFacets[field] || []}
			frozen={frozen[field] || []}
			colors={facetSettings[field]?.colors || {}}
			showCount={showCount}
			locale={locale}
			onToggle={onFieldFacetClick}
			range={{
				span: rangeFields[field],
				active: activeRanges[field],
				onApply: onRangeApply,
				format: formatBound(field),
				unit: PRICE_FIELDS.has(field) ? (currency.symbol || '') : '',
				unitBefore: String(currency.position || '').startsWith('left'),
				decimalSep: currency.decimalSep || '.',
			}}
		/>
	);

	// "Reset" takes this group's picks, or every pick, away; the other button
	// only closes - its label says what is on screen now.
	const panelFooter = (field) => {
		const has = field ? isGroupActive(field) : activeCount > 0;
		let done = __('Done', 'searcio');

		if (showingResults) {
			done = 0 === shownTotal
				? __('No results', 'searcio')
				: sprintf(
					/* translators: %d: number of results the filters leave. */
					_n('Show %d result', 'Show %d results', shownTotal, 'searcio'),
					shownTotal
				);
		}

		return (
			<>
				<button
					type="button"
					className="whsc-btn whsc-btn--secondary"
					// Off, but still reachable: a disabled button would drop focus.
					aria-disabled={!has}
					onClick={() => {
						if (has) {
							if (field) {
								resetGroup(field);
							} else {
								resetAll();
							}
						}
					}}
				>
					{__('Reset', 'searcio')}
				</button>
				<button type="button" className="whsc-btn whsc-btn--primary" onClick={() => closePanel({restore: true})}>
					{done}
				</button>
			</>
		);
	};

	const sections = bar.order.map((field, index) => {
		const open = Boolean(expanded[field]);
		const summary = summarizeSelection(activeFacets[field], activeRanges[field], formatBound(field));
		const sectionId = `${popoverId}-section-${index}`;

		return (
			<section className="whsc-acc" key={field}>
				<h3 className="whsc-acc__heading">
					<button
						type="button"
						className="whsc-acc__btn"
						aria-expanded={open}
						aria-controls={sectionId}
						onClick={() => toggleSection(field)}
					>
						<span className="whsc-acc__title whsc-facet-group__label">{labelOf(field)}</span>
						{'' !== summary && <span className="whsc-acc__sum"><bdi>{summary}</bdi></span>}
						<Icon icon={chevronDown} className="whsc-chev" size={20}/>
					</button>
				</h3>
				<div className="whsc-acc__panel" id={sectionId} hidden={!open}>
					{open && panel(field)}
				</div>
			</section>
		);
	});

	const allSelected = activeCount > 0 ? sprintf(
		/* translators: %d: number of filter values selected. */
		_n('%d selected', '%d selected', activeCount, 'searcio'),
		activeCount
	) : '';
	const sheetOpen = null !== openFilter && 'popover' !== openFilter.kind;
	// On a phone with the tabs on, the close button joins the tab row, which
	// leaves the search field the room for its placeholder.
	const closeInTabs = hasTabs && tight;

	return (
		<Modal
			__experimentalHideHeader
			focusOnMount={editorPreview ? false : undefined}
			onRequestClose={onRequestClose}
			className={`whsc-modal whsc-anim-${animation || 'fade'}${instanceClass ? ` ${instanceClass}` : ''}`}
			// The instance class goes on the overlay too: the widget's CSS custom
			// properties are set on it, and the overlay is the frame's parent,
			// so it would never see the frame's own copy (e.g. its colour).
			overlayClassName={`whsc-modal-overlay${instanceClass ? ` ${instanceClass}` : ''}`}
			contentLabel={i18n.placeholder || __('Search', 'searcio')}
			// A press on the dimmed page while a popover is open closes only the
			// popover (see `FilterPopover`), not the search.
			shouldCloseOnClickOutside={'popover' !== openFilter?.kind && !pressClosedPopover}
			onKeyDown={(event) => {
				// Escape with a popover open but focus outside it, on its button
				// say: the popover goes, the search stays.
				if ('Escape' === event.key && !event.defaultPrevented && 'popover' === openFilter?.kind) {
					event.preventDefault();
					closePanel({restore: true});
				}
			}}
		>
			<div className="whsc-modal-body" ref={bodyRef}>
				{hasTabs && (
					<div className="whsc-modal-tabbar">
					<div
						className="whsc-modal-tabs"
						role="tablist"
						aria-label={__('Search modes', 'searcio')}
						ref={tabListRef}
						// Tabbing onto a tab the row cuts off does not scroll it: the
						// browser leaves a partly visible element where it is.
						onFocus={(event) => revealTab(tabListRef.current, event.target)}
					>
						<button
							type="button"
							role="tab"
							aria-selected={'search' === activeTab}
							className={`whsc-modal-tab${'search' === activeTab ? ' is-active' : ''}`}
							onClick={() => setActiveTab('search')}
						>
							{__('Search', 'searcio')}
						</button>
						{assistantEnabled && (
							<button
								type="button"
								role="tab"
								aria-selected={'assistant' === activeTab}
								className={`whsc-modal-tab${'assistant' === activeTab ? ' is-active' : ''}`}
								onClick={() => {
									setOpenFilter(null);
									setAssistantOpened(true);
									setActiveTab('assistant');
								}}
							>
								{__('AI Assistant', 'searcio')}
							</button>
						)}
						{quizEnabled && (
							<button
								type="button"
								role="tab"
								aria-selected={'quiz' === activeTab}
								className={`whsc-modal-tab${'quiz' === activeTab ? ' is-active' : ''}`}
								onClick={() => {
									setOpenFilter(null);
									setQuizOpened(true);
									setActiveTab('quiz');
								}}
							>
								{__('Product finder', 'searcio')}
							</button>
						)}
					</div>
					{/* Only the tabs without a search input need a close control
					    here; the search tab keeps its own inside the input row, so
					    turning these modes on never restyles the search tab - except
					    on a phone too narrow for the field and three icon buttons.
					    It sits beside the tablist rather than in it: a tablist holds
					    tabs. */}
					{('search' !== activeTab || closeInTabs) && (
						<Button
							className="whsc-modal-close whsc-modal-close--tabbed"
							icon={closeSmall}
							label={i18n.close || __('Close search', 'searcio')}
							showTooltip={false}
							onClick={onRequestClose}
						/>
					)}
					</div>
				)}

				{showSearchPane && (
					<>
				<div className="whsc-modal-header" ref={headerRef}>
					<div className="whsc-modal-search">
					<div className="whsc-input-row">
						<SearchInput
							ref={inputRef}
							value={query}
							onChange={setQuery}
							onKeyDown={onInputKeyDown}
							placeholder={placeholder || i18n.placeholder || ''}
							suggestionsId={suggestionsId}
							suggestionsOpen={suggestionsOpen}
							activeSuggestionId={suggestionsOpen && activeSuggestion >= 0 ? optionId(suggestionsId, activeSuggestion) : ''}
						/>
						{'submit' === searchTrigger && (
							<Button
								variant="primary"
								className="whsc-submit-btn"
								onClick={() => void runSearch(query)}
							>
								{/* On a phone only the icon shows; the label stays the name. */}
								<Icon icon={searchIcon} className="whsc-submit-btn__icon"/>
								<span className="whsc-submit-btn__label">{__('Search', 'searcio')}</span>
							</Button>
						)}
						{enableVoice && supportsVoice() && (
							<Button
								className="whsc-voice-btn"
								icon={voiceIconHtml ? (
									// A custom icon chosen in the editor (Elementor's icon picker)
									// arrives as a pre-rendered, server-escaped HTML string; render
									// it in place of the default outline mic glyph. Kept out of
									// `.whsc-default-voice-icon` (see style.scss) so the forced
									// `fill: none` on the built-in glyph never applies to it - a
									// custom icon may legitimately be a solid/filled design.
									<span
										className="whsc-custom-voice-icon"
										// eslint-disable-next-line react/no-danger -- sanitized server-side via Elementor's Icons_Manager / wp_kses.
										dangerouslySetInnerHTML={{__html: voiceIconHtml}}
									/>
								) : (
									<span className="whsc-default-voice-icon">{micIcon}</span>
								)}
								label={i18n.voiceSearch || __('Search by voice', 'searcio')}
								showTooltip={false}
								isPressed={isListening}
								onClick={onVoiceClick}
							/>
						)}
						{visualEnabled && (
							<VisualSearchButton busy={isSearching} onSelect={(file) => void runVisualSearch(file)}/>
						)}
						{!closeInTabs && (
							<Button
								className="whsc-modal-close"
								icon={closeSmall}
								label={i18n.close || __('Close search', 'searcio')}
								showTooltip={false}
								onClick={onRequestClose}
							/>
						)}
					</div>

					{suggestionsOpen && (
						<Suggestions
							id={suggestionsId}
							suggestions={suggestions}
							activeIndex={activeSuggestion}
							onSelect={onSelectSuggestion}
							onDismiss={() => setSuggestionsDismissed(true)}
						/>
					)}
					</div>

					{/* A photo search takes no filters. */}
					{!visualActive && (
						<FilterBar
							narrow={narrow}
							types={typeFacets}
							activeTypes={activeTypes}
							showTypes={showTypes}
							onType={onTypeFacetClick}
							typeLabels={typeLabels}
							allTypesLabel={i18n.allTypes}
							// The type counts come from the same window as `total`: when the
							// heading cannot give an exact number, neither can they, and two
							// numbers that disagree ("20 results", "Products 21") help no one.
							showCount={showCount && exactTotal}
							groups={bar.order}
							buttonLabel={(field) => filterButtonLabel(labelOf(field), activeFacets[field], activeRanges[field], formatBound(field))}
							isActive={isGroupActive}
							openField={openFilter?.field || ''}
							allOpen={'all' === openFilter?.kind}
							popoverId={popoverId}
							activeCount={activeCount}
							limit={facetBarLimit}
							fitKey={`${bar.key}|${modalWidth}|${fontsVersion}`}
							onGroup={onGroup}
							onAll={(button) => openPanel({kind: 'all', anchor: button})}
						/>
					)}

					{'popover' === openFilter?.kind && (
						<FilterPopover
							id={popoverId}
							title={labelOf(openFilter.field)}
							selection={selectionOf(openFilter.field)}
							kind={displayOf(openFilter.field)}
							anchor={openFilter.anchor}
							layoutKey={`${groupsVersion}|${modalWidth}`}
							onClose={closePanel}
							footer={panelFooter(openFilter.field)}
						>
							{panel(openFilter.field)}
						</FilterPopover>
					)}
				</div>

				{'string' === typeof results?.banner && '' !== results.banner && (
					// A merchandising rule can attach a banner to a search (or to a
					// category listing). The plugin's own Search Config tab writes
					// these, so not rendering them made the field look broken.
					// Merchant-authored text, rendered as text - never as markup.
					<p className="whsc-banner" role="status">{results.banner}</p>
				)}

				{error && (
					// The surface's own box, as the assistant and the product finder
					// draw theirs. A `Notice` of `@wordpress/components` looks like
					// whichever version of that package the plugin was built with:
					// a bar with a red edge in one release, a bordered box in the next.
					<p className="whsc-search-error" role="alert">{error}</p>
				)}

				<Browse
					recent={recent}
					popularSearches={popularSearches}
					mainTitle={mainTitle}
					query={'all' === helpers || visualActive ? '' : String(results?.searchedQuery ?? '')}
					meta={'all' !== helpers && !visualActive && (
						<ActiveFilters
							chips={chips}
							// A search that found nothing has its own "Reset filters".
							showReset={'popular' !== helpers}
							onRemove={onRemoveChip}
							onReset={resetAll}
							fallbackRef={resultsHeadingRef}
						/>
					)}
					main={mainContent}
					busy={isSearching && !updating}
					// Clearing the field keeps the last results in state but puts the
					// highlights back on screen, with the searches beside them.
					helpers={helpers}
					headingRef={resultsHeadingRef}
					onSelect={(label) => void runSearch(label)}
					onRemoveRecent={onRemoveRecent}
					onClearRecent={onClearRecent}
				/>

				<p id={statusId} className="whsc-visually-hidden" role="status" aria-live="polite">
					{isSearching && 'filter' !== pendingKind && ('photo' === pendingKind
						? __('Looking at your photo…', 'searcio')
						: (i18n.searching || __('Searching…', 'searcio')))}
					{!isSearching && results && (
						resultsHits.length > 0
							? (exactTotal && hasMore
								? sprintf(
									/* translators: 1: number of results shown. 2: total number of results found. */
									__('Showing %1$d of %2$d results.', 'searcio'),
									resultsHits.length,
									totalResults
								)
								: sprintf(
									/* translators: %d: number of results found. */
									_n('%d result found.', '%d results found.', shownTotal, 'searcio'),
									shownTotal
								))
							: (i18n.noResults || __('No results found.', 'searcio'))
					)}
				</p>
					</>
				)}

				{/* Kept mounted once opened so switching to Search and back doesn't drop the conversation. */}
				{assistantEnabled && assistantOpened && (
					<div className="whsc-assistant-pane" hidden={'assistant' !== activeTab}>
						<AiAssistant cardSource={cardSource} serverTemplates={serverTemplates} />
					</div>
				)}

				{/* Same reasoning as the assistant: staying mounted keeps the
				    visitor's answers if they look something up in Search mid-quiz. */}
				{quizEnabled && quizOpened && (
					<div className="whsc-quiz-pane" hidden={'quiz' !== activeTab}>
						<QuizPane
							cardSource={cardSource}
							serverTemplates={serverTemplates}
							onEmpty={() => {
								// The capability says a quiz is published but the list
								// came back empty; take the tab away rather than leave
								// a door onto nothing.
								setQuizEnabled(false);
								setActiveTab('search');
							}}
						/>
					</div>
				)}

				<SearcioCredit/>
			</div>

			{/* Rendered inside the search modal so that it nests in it: see `FilterSheet`. */}
			{sheetOpen && (
				<FilterSheet
					variant={narrow ? 'sheet' : 'drawer'}
					title={'all' === openFilter.kind ? (narrow ? __('Filters', 'searcio') : __('All filters', 'searcio')) : labelOf(openFilter.field)}
					selection={'all' === openFilter.kind ? allSelected : selectionOf(openFilter.field)}
					single={'all' !== openFilter.kind}
					instanceClass={instanceClass}
					onClose={() => closePanel({restore: false})}
					footer={panelFooter('all' === openFilter.kind ? null : openFilter.field)}
				>
					{'all' === openFilter.kind ? sections : panel(openFilter.field)}
				</FilterSheet>
			)}
		</Modal>
	);
};

export default SearchModal;
