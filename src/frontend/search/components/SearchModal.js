import {useCallback, useEffect, useId, useRef, useState} from '@wordpress/element';
import {Button, Modal, Notice} from '@wordpress/components';
import {closeSmall} from '@wordpress/icons';
import {__, _n, sprintf} from '@wordpress/i18n';

import {currentLangFilter, fetchCardTemplates, fetchPopularSearches, fetchStorefrontConfig, getConfig, isConfigured, isLanguageSupported, search, suggest, trackClick} from '../../../utils/api';
import {addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch} from '../../../utils/storage';
import {buildFilterParams, buildTypeParam, extractFieldFacets, humanizeFieldLabel, mergeFieldFacets, toggleSelection} from '../../../utils/facets';
import {ResultCard} from './templates';
import {micIcon} from './icons';
import AiAssistant from './AiAssistant';
import SearchInput from './SearchInput';
import Suggestions from './Suggestions';
import Browse from './Browse';
import Carousel from './Carousel';
import SearchResultsSkeleton from './SearchResultsSkeleton';

const SUGGEST_DEBOUNCE = 200;
const LIVE_SEARCH_DEBOUNCE = 300;
const LIVE_SEARCH_MIN_LENGTH = 3;
// Keep the skeleton on screen for at least this long so a very fast API
// response doesn't make the loading state flash by imperceptibly.
const MIN_LOADING = 0;

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Compact a large result count so facet chips stay narrow: 1000+ becomes
 * "{n}k+" (e.g. 32494 → "32k+"), millions become "{n}M+". Smaller counts are
 * shown as-is.
 *
 * @param {number} value
 * @return {string}
 */
const formatCount = (value) => {
	const n = Number(value) || 0;

	if (n >= 1000000) {
		return `${Math.floor(n / 1000000)}M+`;
	}

	if (n >= 1000) {
		return `${Math.floor(n / 1000)}K+`;
	}

	return String(n);
};

const supportsVoice = () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

const nativeSearchUrl = (query) => {
	const config = getConfig();
	const url = new URL(config.siteHome || '/', window.location.origin);

	url.searchParams.set('s', query);

	return url.toString();
};

/**
 * @param {Object}   props
 * @param {string}   props.scopeType      Restrict results to one document type (empty = all types).
 * @param {string}   props.placeholder    Placeholder text for the search input.
 * @param {boolean}  props.enableVoice    Show the voice-input button for this instance.
 * @param {string}   [props.voiceIconHtml] Custom icon chosen for the voice button (Elementor icon picker); falls back to the built-in mic glyph when empty.
 * @param {string}   props.searchTrigger  'type' (auto-search past 3 chars) or 'submit' (Enter/button only).
 * @param {string}   props.instanceClass  Per-placement class so per-instance colors reach the portalled modal.
 * @param {string}   [props.cardSource]   'server' to render result cards from Search Cloud-designed templates
 *                                        (falls back to the plugin's own card per hit when no template matches).
 * @param {string}   [props.highlightsSource] 'featured' to source the empty-query highlights carousel from
 *                                            `filter[featured]=true` instead of a plain match-all (default 'newest').
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
											 initialQuery,
											 onQueryChange,
											 onRequestClose,
										 }) => {
	const config = getConfig();
	const i18n = config.i18n || {};
	const typeLabels = config.typeLabels || {};
	const suggestionsId = useId();
	const statusId = useId();

	const [query, setQuery] = useState(initialQuery || '');
	// A scope-locked instance never touches this — `buildTypeParam()` always
	// prefers `scopeType` when it's set.
	const [activeTypes, setActiveTypes] = useState([]);
	// Per-field facet selections, e.g. {brand: ['Acme', 'Duff']}.
	const [activeFacets, setActiveFacets] = useState({});
	// Every facet key from the last `/search` response other than the
	// built-in `types`, rendered as its own dynamic chip group.
	const [facetGroups, setFacetGroups] = useState({});
	const [suggestions, setSuggestions] = useState([]);
	const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
	const [results, setResults] = useState(null);
	const [highlights, setHighlights] = useState([]);
	// The search_id of the highlights carousel, so clicks on it attribute to the
	// same search the way result clicks attribute to `results.search_id`.
	const [highlightsSearchId, setHighlightsSearchId] = useState('');
	// The AI assistant tab is offered only when the plan includes it — read from
	// /storefront-config so an upgrade flips it on with no code change.
	const [assistantEnabled, setAssistantEnabled] = useState(false);
	const [activeTab, setActiveTab] = useState('search');
	const [assistantOpened, setAssistantOpened] = useState(false);
	const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
	const [facets, setFacets] = useState([]);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState('');
	const [recent, setRecent] = useState(() => getRecentSearches());
	const [isListening, setIsListening] = useState(false);
	const [serverTemplates, setServerTemplates] = useState([]);
	const [livePopularSearches, setLivePopularSearches] = useState([]);

	const suggestTimer = useRef(null);
	const liveSearchTimer = useRef(null);
	const recognitionRef = useRef(null);
	const inputRef = useRef(null);
	// Set true by an explicit (committed) search so the very next run of the
	// autocomplete effect skips re-fetching/re-opening the dropdown over the
	// results. Live "while typing" searches leave it false so suggestions keep
	// updating as the visitor types.
	const skipSuggestRef = useRef(false);
	// Like `skipSuggestRef`, but stops the "while typing" live-search effect
	// from firing a second, redundant request right after a committed search
	// (clicking a recent/popular/suggestion item sets the query, which would
	// otherwise trigger the live effect too).
	const skipLiveSearchRef = useRef(false);
	// Aborts the previous in-flight search when a newer one starts, and a
	// monotonic id so only the latest search may update state (rapid clicks no
	// longer race stale responses onto the screen).
	const abortRef = useRef(null);
	const searchSeq = useRef(0);

	// Type filters only make sense when the placement isn't already locked to
	// a single type.
	const showFacets = '' === (scopeType || '') && facets.length > 0;
	// Dynamic field facet groups (brand, color, ...) are orthogonal to a
	// type-scope lock — they render whenever the site has any configured,
	// regardless of `scopeType`.
	const facetGroupEntries = Object.entries(facetGroups);
	const curatedPopularSearches = Array.isArray(config.popularSearches) ? config.popularSearches : [];
	// Live queries from the API are the primary source — they reflect what
	// visitors are actually searching for right now. The curated admin list
	// is only a fallback, used when the live fetch hasn't returned anything
	// yet, comes back empty, or errors out.
	const popularSearches = livePopularSearches.length > 0 ? livePopularSearches : curatedPopularSearches;
	const trimmedQuery = query.trim();
	const showEmptyState = '' === trimmedQuery;

	useEffect(() => {
		onQueryChange?.(query);
	}, [query, onQueryChange]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// `Modal` (`@wordpress/components`) always portals its frame straight to
	// `document.body` and doesn't forward unrecognized props to it, so
	// `data-webhead-frontend-root` can't be passed in as a prop like
	// `className` above — it has to be set on the real DOM node once it
	// exists. Scopes the shared frontend reset
	// (`src/components/Default/frontend-reset.scss`) to the modal, the same
	// way `instanceClass` already reaches it despite not being a DOM
	// descendant of the trigger.
	//
	// Set on `.whsc-modal-overlay` (via `overlayClassName` below), the actual
	// parent of `.components-modal__frame.whsc-modal` — not on the frame
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
	// "fetch once per page load" guidance — `api.js`'s own TTL cache also
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

	// Whether the plan includes the AI assistant. Fetched once so the tab only
	// appears when the account can actually use it; a failure just hides it.
	useEffect(() => {
		if (!isConfigured()) {
			return undefined;
		}

		let cancelled = false;

		fetchStorefrontConfig()
			.then((response) => {
				if (!cancelled) {
					setAssistantEnabled(Boolean(response?.capabilities?.assistant));
				}
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, []);

	// The curated `popular_searches` setting is only a fallback for when this
	// fetch returns nothing or fails — `popularSearches` above starts on the
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
	const loadHighlights = useCallback(async (type, facetsOverride) => {
		if (!isConfigured()) {
			setIsLoadingHighlights(false);

			return;
		}

		setIsLoadingHighlights(true);
		const started = Date.now();

		// Only the empty-query carousel gets this forced filter, not a real
		// text search. `currentLangFilter()` quietly resolves to no filter at
		// all for an unsupported/unrestricted language, since there's no
		// sensible native-search fallback for a passive, empty-query carousel
		// (unlike a real committed search below).
		const forced = {...currentLangFilter(), ...('featured' === highlightsSource ? {featured: 'true'} : {})};
		const appliedFacets = facetsOverride ?? activeFacets;
		const filters = buildFilterParams(appliedFacets, forced);

		try {
			const response = await search('', {type, filters, perPage: 12});

			setHighlights(response.hits || []);
			setHighlightsSearchId(response.search_id || '');
			// Only refresh the type chip list when this request had no type
			// filter applied — confirmed live that this API's `facets.types`
			// collapses to just the active selection otherwise, which would
			// erase every other chip a multi-select needs to stay clickable.
			if ('' === type) {
				setFacets(response.facets?.types || []);
			}
			setFacetGroups((current) => mergeFieldFacets(current, extractFieldFacets(response.facets), appliedFacets));
		} catch (e) {
			setHighlights([]);
		} finally {
			await delay(Math.max(0, MIN_LOADING - (Date.now() - started)));
			setIsLoadingHighlights(false);
		}
	}, [activeFacets, highlightsSource]);

	useEffect(() => {
		void loadHighlights(scopeType || '');
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount; facet/type changes reload explicitly.
	}, []);

	// Lightweight autocomplete — always runs while typing regardless of
	// `searchTrigger`; it's cheap and not metered as a search.
	useEffect(() => {
		window.clearTimeout(suggestTimer.current);

		if (skipSuggestRef.current) {
			skipSuggestRef.current = false;

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

	// `facetsOverride` mirrors `loadHighlights()`'s param — used only by a
	// field-facet click, which needs its just-toggled selection applied before
	// `activeFacets` state itself has re-rendered.
	const runSearch = useCallback(async (q, type = buildTypeParam(scopeType, activeTypes), commit = true, facetsOverride) => {
		const trimmed = q.trim();

		setQuery(q);

		// A committed search (Enter, Search button, suggestion/chip/popular
		// click, voice) closes the autocomplete dropdown and tells the typing
		// effect to skip its next re-open. A live "while typing" search leaves
		// the dropdown alone so suggestions keep tracking the query.
		if (commit) {
			setSuggestions([]);
			setSuggestionsDismissed(true);
			skipSuggestRef.current = true;
			// A committed query also arrives at the live-search effect; skip its
			// next run and cancel any already-scheduled live-search timer so the
			// same query isn't fetched a second time (which also defeats the
			// response cache).
			skipLiveSearchRef.current = true;
			window.clearTimeout(liveSearchTimer.current);
		}

		if ('' === trimmed) {
			setResults(null);

			return;
		}

		// An unsupported visitor language degrades exactly like an
		// unconfigured/unreachable API — native search, not a Search Cloud
		// query scoped to the wrong (or no) content.
		if (!isConfigured() || !isLanguageSupported()) {
			window.location.href = nativeSearchUrl(trimmed);

			return;
		}

		// Cancel any in-flight search and claim the latest sequence id.
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const seq = ++searchSeq.current;
		const isLatest = () => seq === searchSeq.current;

		setIsSearching(true);
		setError('');
		const started = Date.now();

		const appliedFacets = facetsOverride ?? activeFacets;
		const filters = buildFilterParams(appliedFacets, currentLangFilter());

		try {
			const response = await search(trimmed, {type, filters, signal: controller.signal});

			if (!isLatest()) {
				return;
			}

			setResults(response);

			// See the matching comment in `loadHighlights()` — only refresh the
			// type chip list from an unfiltered-by-type request.
			if ('' === type) {
				setFacets(response.facets?.types || []);
			}

			setFacetGroups((current) => mergeFieldFacets(current, extractFieldFacets(response.facets), appliedFacets));

			setRecent(addRecentSearch(trimmed));
		} catch (e) {
			// A superseded/cancelled request must not touch state or navigate.
			if ('AbortError' === e.name || !isLatest()) {
				return;
			}

			setError(i18n.error || __('Search is unavailable right now.', 'webhead-search-cloud'));
			window.location.href = nativeSearchUrl(trimmed);
		} finally {
			if (isLatest()) {
				await delay(Math.max(0, MIN_LOADING - (Date.now() - started)));

				if (isLatest()) {
					setIsSearching(false);
				}
			}
		}
	}, [activeTypes, activeFacets, i18n.error, scopeType]);

	// Only in `type` mode does typing itself trigger the metered `/search`
	// call, and only once the query is long enough to be meaningful.
	useEffect(() => {
		window.clearTimeout(liveSearchTimer.current);

		// A committed search already ran this query; don't duplicate it here.
		if (skipLiveSearchRef.current) {
			skipLiveSearchRef.current = false;

			return;
		}

		if ('type' !== searchTrigger || trimmedQuery.length <= LIVE_SEARCH_MIN_LENGTH) {
			return;
		}

		liveSearchTimer.current = window.setTimeout(() => {
			void runSearch(query, buildTypeParam(scopeType, activeTypes), false);
		}, LIVE_SEARCH_DEBOUNCE);

		return () => window.clearTimeout(liveSearchTimer.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on each keystroke via trimmedQuery is intentional.
	}, [trimmedQuery, searchTrigger]);

	// Clicking "All" (empty type) clears the selection; clicking a type
	// toggles it in/out.
	const onTypeFacetClick = (type) => {
		const nextTypes = '' === type ? [] : toggleSelection(activeTypes, type);

		setActiveTypes(nextTypes);
		const typeParam = buildTypeParam(scopeType, nextTypes);

		if ('' === trimmedQuery) {
			void loadHighlights(typeParam);
		} else {
			void runSearch(query, typeParam);
		}
	};

	// Multi-select per field, OR'ed together for that field's
	// `filter[field]=` value.
	const onFieldFacetClick = (field, value) => {
		const nextFacets = {...activeFacets, [field]: toggleSelection(activeFacets[field] || [], value)};

		setActiveFacets(nextFacets);
		const typeParam = buildTypeParam(scopeType, activeTypes);

		if ('' === trimmedQuery) {
			void loadHighlights(typeParam, nextFacets);
		} else {
			void runSearch(query, typeParam, true, nextFacets);
		}
	};

	const onSelectSuggestion = (label) => {
		setSuggestionsDismissed(true);
		void runSearch(label);
	};

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

	const onInputKeyDown = (event) => {
		if ('Enter' === event.key) {
			event.preventDefault();
			void runSearch(query);
		}
	};

	const resultsHits = results?.hits || [];

	// The main slot inside the browse layout swaps between highlights (idle),
	// a skeleton (loading), and the results carousel / empty message.
	let mainTitle;
	let mainContent;

	if (showEmptyState) {
		mainTitle = __('Current highlights', 'webhead-search-cloud');
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
				ariaLabel={__('Current highlights', 'webhead-search-cloud')}
			/>
		);
	} else if (isSearching) {
		mainTitle = __('Results', 'webhead-search-cloud');
		mainContent = <SearchResultsSkeleton/>;
	} else if (results) {
		mainTitle = resultsHits.length > 0
			? sprintf(
				/* translators: %d: number of results. */
				_n('%d result', '%d results', resultsHits.length, 'webhead-search-cloud'),
				resultsHits.length
			)
			: __('Results', 'webhead-search-cloud');
		mainContent = resultsHits.length > 0 ? (
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
				ariaLabel={__('Search results', 'webhead-search-cloud')}
			/>
		) : (
			<p className="whsc-no-results">
				{i18n.noResults || __('No results found.', 'webhead-search-cloud')}
			</p>
		);
	} else {
		mainTitle = __('Current highlights', 'webhead-search-cloud');
		mainContent = <SearchResultsSkeleton/>;
	}

	return (
		<Modal
			__experimentalHideHeader
			onRequestClose={onRequestClose}
			className={`whsc-modal whsc-anim-${animation || 'fade'}${instanceClass ? ` ${instanceClass}` : ''}`}
			overlayClassName="whsc-modal-overlay"
			contentLabel={i18n.placeholder || __('Search', 'webhead-search-cloud')}
		>
			<div className="whsc-modal-body">
				{assistantEnabled && (
					<div className="whsc-modal-tabs" role="tablist" aria-label={__('Search modes', 'webhead-search-cloud')}>
						<button
							type="button"
							role="tab"
							aria-selected={'search' === activeTab}
							className={`whsc-modal-tab${'search' === activeTab ? ' is-active' : ''}`}
							onClick={() => setActiveTab('search')}
						>
							{__('Search', 'webhead-search-cloud')}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={'assistant' === activeTab}
							className={`whsc-modal-tab${'assistant' === activeTab ? ' is-active' : ''}`}
							onClick={() => {
								setAssistantOpened(true);
								setActiveTab('assistant');
							}}
						>
							{__('AI Assistant', 'webhead-search-cloud')}
						</button>
						{/* Only the assistant tab needs a close control here; the
						    search tab keeps its own inside the input row, so
						    enabling the assistant never restyles the search tab. */}
						{'assistant' === activeTab && (
							<Button
								className="whsc-modal-close whsc-modal-close--tabbed"
								icon={closeSmall}
								label={i18n.close || __('Close search', 'webhead-search-cloud')}
								showTooltip={false}
								onClick={onRequestClose}
							/>
						)}
					</div>
				)}

				{(!assistantEnabled || 'search' === activeTab) && (
					<>
				<div className="whsc-modal-header">
					<div className="whsc-input-row">
						<SearchInput
							ref={inputRef}
							value={query}
							onChange={setQuery}
							onKeyDown={onInputKeyDown}
							placeholder={placeholder || i18n.placeholder || ''}
							suggestionsId={suggestionsId}
							suggestionsOpen={!suggestionsDismissed && suggestions.length > 0}
						/>
						{'submit' === searchTrigger && (
							<Button
								variant="primary"
								className="whsc-submit-btn"
								onClick={() => void runSearch(query)}
							>
								{__('Search', 'webhead-search-cloud')}
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
									// `fill: none` on the built-in glyph never applies to it — a
									// custom icon may legitimately be a solid/filled design.
									<span
										className="whsc-custom-voice-icon"
										// eslint-disable-next-line react/no-danger -- sanitized server-side via Elementor's Icons_Manager / wp_kses.
										dangerouslySetInnerHTML={{__html: voiceIconHtml}}
									/>
								) : (
									<span className="whsc-default-voice-icon">{micIcon}</span>
								)}
								label={i18n.voiceSearch || __('Search by voice', 'webhead-search-cloud')}
								showTooltip={false}
								isPressed={isListening}
								onClick={onVoiceClick}
							/>
						)}
						<Button
							className="whsc-modal-close"
							icon={closeSmall}
							label={i18n.close || __('Close search', 'webhead-search-cloud')}
							showTooltip={false}
							onClick={onRequestClose}
						/>
					</div>

					{!suggestionsDismissed && suggestions.length > 0 && (
						<Suggestions
							id={suggestionsId}
							suggestions={suggestions}
							onSelect={onSelectSuggestion}
							onDismiss={() => setSuggestionsDismissed(true)}
						/>
					)}
				</div>

				{showFacets && (
					// A group of independent toggle buttons, not an ARIA tablist —
					// multi-select means more than one can be "selected" at once,
					// which the tablist/tab/aria-selected pattern assumes never happens.
					<div className="whsc-facets" role="group" aria-label={__('Filter by type', 'webhead-search-cloud')}>
						<button
							type="button"
							aria-pressed={0 === activeTypes.length}
							className={`whsc-facet${0 === activeTypes.length ? ' is-active' : ''}`}
							onClick={() => onTypeFacetClick('')}
						>
							<span className="whsc-facet__label">{i18n.allTypes || __('All', 'webhead-search-cloud')}</span>
						</button>
						{facets.map((facet) => (
							<button
								key={facet.value}
								type="button"
								aria-pressed={activeTypes.includes(facet.value)}
								className={`whsc-facet${activeTypes.includes(facet.value) ? ' is-active' : ''}`}
								onClick={() => onTypeFacetClick(facet.value)}
							>
								<span className="whsc-facet__label">{typeLabels[facet.value] || facet.value}</span>
								{showCount && <span className="whsc-facet__count">{formatCount(facet.count)}</span>}
							</button>
						))}
					</div>
				)}

				{facetGroupEntries.length > 0 && facetGroupEntries.map(([field, values]) => (
					<div className="whsc-facet-group" key={field}>
						<span className="whsc-facet-group__label">{humanizeFieldLabel(field)}</span>
						<div className="whsc-facets" role="group" aria-label={humanizeFieldLabel(field)}>
							{values.map((entry) => (
								<button
									key={entry.value}
									type="button"
									aria-pressed={(activeFacets[field] || []).includes(entry.value)}
									className={`whsc-facet${(activeFacets[field] || []).includes(entry.value) ? ' is-active' : ''}`}
									onClick={() => onFieldFacetClick(field, entry.value)}
								>
									<span className="whsc-facet__label">{entry.value}</span>
									{showCount && <span className="whsc-facet__count">{formatCount(entry.count)}</span>}
								</button>
							))}
						</div>
					</div>
				))}

				{error && (
					<Notice status="error" isDismissible={false}>
						{error}
					</Notice>
				)}

				<Browse
					recent={recent}
					popularSearches={popularSearches}
					mainTitle={mainTitle}
					main={mainContent}
					busy={isSearching}
					onSelect={(label) => void runSearch(label)}
					onRemoveRecent={onRemoveRecent}
					onClearRecent={onClearRecent}
				/>

				<p id={statusId} className="whsc-visually-hidden" role="status" aria-live="polite">
					{isSearching && (i18n.searching || __('Searching…', 'webhead-search-cloud'))}
					{!isSearching && results && (
						resultsHits.length > 0
							? sprintf(
								/* translators: %d: number of results found. */
								_n('%d result found.', '%d results found.', resultsHits.length, 'webhead-search-cloud'),
								resultsHits.length
							)
							: (i18n.noResults || __('No results found.', 'webhead-search-cloud'))
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
			</div>
		</Modal>
	);
};

export default SearchModal;
