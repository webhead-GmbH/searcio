import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';

import { currentLangFilter, fetchQuizzes, getConfig, search, trackClick } from '../../../utils/api';
import { appendHits, buildFilterParams, hasMorePages, humanizeFieldLabel } from '../../../utils/facets';
import { applyOption, firstQuestion, nextQuestion, normalizeQuizzes, quizProgress } from '../../../utils/quiz';
import { ResultCard } from './templates';
import SearchResultsSkeleton from './SearchResultsSkeleton';

/**
 * The guided quiz: a few questions that narrow the catalogue down to what the
 * visitor actually wants, for shoppers who know what they need but not what
 * it is called.
 *
 * The whole question graph arrives in a single `/quizzes` response, so every
 * step after the first is answered from memory - the network is only touched
 * again at the end, for the filtered `/search` the answers add up to
 * (`docs/api/quiz.md`, "Widget flow contract").
 *
 * @param {Object}        props
 * @param {string}        [props.cardSource]      Passed through to ResultCard.
 * @param {Array<Object>} [props.serverTemplates] Passed through to ResultCard.
 * @param {Function}      [props.onEmpty]         Called when the site turns out to
 *                                                publish no quiz after all, so the
 *                                                tab can take itself away.
 */
const QuizPane = ( { cardSource, serverTemplates, onEmpty } ) => {
	const [ quizzes, setQuizzes ] = useState( null );
	const [ quiz, setQuiz ] = useState( null );
	const [ question, setQuestion ] = useState( null );
	// One entry per answered question: what was showing and the tags so far, so
	// "Back" restores the previous step exactly rather than restarting.
	const [ history, setHistory ] = useState( [] );
	const [ tags, setTags ] = useState( {} );
	// The wording the visitor picked, per field. The tag value is a catalogue
	// value ("m"); showing that back reads as an internal code, not as the
	// answer they gave ("Medium").
	const [ answerLabels, setAnswerLabels ] = useState( {} );
	const [ results, setResults ] = useState( null );
	const [ isSearching, setIsSearching ] = useState( false );
	const [ isLoadingMore, setIsLoadingMore ] = useState( false );
	const [ error, setError ] = useState( '' );

	const abortRef = useRef( null );
	// The heading of whichever step is on screen - the question, or the results.
	const stepHeadingRef = useRef( null );
	// Bumped when the visitor moves the quiz on (answers, goes back, starts
	// over). Opening the tab is not one of those, so focus is never taken from
	// the tab strip just because the quiz loaded.
	const [ stepMoves, setStepMoves ] = useState( 0 );
	// The answers the results on screen came from, so another page can be asked
	// for without walking the quiz again.
	const appliedTagsRef = useRef( {} );

	// Fetched once when the tab is first opened. An empty list is a normal
	// answer, not a failure - it means nothing is published yet.
	useEffect( () => {
		let cancelled = false;

		fetchQuizzes()
			.then( ( response ) => {
				if ( cancelled ) {
					return;
				}

				const available = normalizeQuizzes( response );

				setQuizzes( available );

				if ( 0 === available.length ) {
					onEmpty?.();

					return;
				}

				// One quiz is the common case; go straight in rather than making
				// the visitor pick from a list of one.
				if ( 1 === available.length ) {
					setQuiz( available[ 0 ] );
					setQuestion( firstQuestion( available[ 0 ] ) );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setQuizzes( [] );
					setError( __( 'The quiz is unavailable right now.', 'searcio' ) );
				}
			} );

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per mount; onEmpty is a stable callback from the parent.
	}, [] );

	useEffect( () => () => abortRef.current?.abort(), [] );

	/*
	 * Each answer replaces the button that was pressed, so the focus it held has
	 * nowhere to go: it fell to <body>, a keyboard user had to find their way
	 * back into the dialog, and a screen reader said nothing about the next
	 * question. Moving it to the new step's heading reads that step out and
	 * puts the next Tab on its first answer.
	 */
	useEffect( () => {
		if ( stepMoves > 0 ) {
			stepHeadingRef.current?.focus();
		}
	}, [ stepMoves ] );

	const runFinalSearch = useCallback( async ( finalTags ) => {
		setIsSearching( true );
		setError( '' );

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		appliedTagsRef.current = finalTags;

		try {
			const response = await search( '', {
				filters: buildFilterParams( {}, { ...finalTags, ...currentLangFilter() } ),
				surface: 'quiz',
				signal: controller.signal,
			} );

			setResults( response );
		} catch ( e ) {
			if ( 'AbortError' !== e.name ) {
				setError( __( 'We could not load your matches. Please try again.', 'searcio' ) );
			}
		} finally {
			setIsSearching( false );
		}
	}, [] );

	const loadMore = useCallback( async () => {
		if ( isLoadingMore ) {
			return;
		}

		const nextPage = ( Number( results?.page ) || 1 ) + 1;

		setIsLoadingMore( true );

		try {
			const response = await search( '', {
				filters: buildFilterParams( {}, { ...appliedTagsRef.current, ...currentLangFilter() } ),
				page: nextPage,
				surface: 'quiz',
			} );

			setResults( ( current ) => ( {
				...response,
				page: nextPage,
				search_id: current?.search_id || response.search_id,
				hits: appendHits( current?.hits, response.hits ),
			} ) );
		} catch ( e ) {
			setError( __( 'We could not load more matches. Please try again.', 'searcio' ) );
		} finally {
			setIsLoadingMore( false );
		}
	}, [ isLoadingMore, results ] );

	const answer = ( option ) => {
		const nextTags = applyOption( tags, option );
		const visited = [ ...history.map( ( step ) => step.question.id ), question.id ];
		const upcoming = nextQuestion( quiz, option, visited );

		setHistory( ( current ) => [ ...current, { question, tags, answerLabels } ] );
		setTags( nextTags );
		setAnswerLabels( ( current ) => {
			const next = { ...current };

			( option.tags_matched || [] ).forEach( ( tag ) => {
				next[ tag.field ] = option.label;
			} );

			return next;
		} );

		setStepMoves( ( n ) => n + 1 );

		if ( null === upcoming ) {
			setQuestion( null );
			void runFinalSearch( nextTags );

			return;
		}

		setQuestion( upcoming );
	};

	const back = () => {
		const previous = history[ history.length - 1 ];

		if ( ! previous ) {
			return;
		}

		abortRef.current?.abort();
		setHistory( ( current ) => current.slice( 0, -1 ) );
		setQuestion( previous.question );
		setTags( previous.tags );
		setAnswerLabels( previous.answerLabels );
		setResults( null );
		setError( '' );
		setIsSearching( false );
		setStepMoves( ( n ) => n + 1 );
	};

	const restart = () => {
		abortRef.current?.abort();
		setHistory( [] );
		setTags( {} );
		setAnswerLabels( {} );
		setResults( null );
		setError( '' );
		setIsSearching( false );
		setQuestion( quiz ? firstQuestion( quiz ) : null );
		setStepMoves( ( n ) => n + 1 );
	};

	const chooseQuiz = ( chosen ) => {
		setQuiz( chosen );
		setQuestion( firstQuestion( chosen ) );
		setHistory( [] );
		setTags( {} );
		setAnswerLabels( {} );
		setResults( null );
		setStepMoves( ( n ) => n + 1 );
	};

	if ( null === quizzes ) {
		return (
			<div className="whsc-quiz">
				<SearchResultsSkeleton />
			</div>
		);
	}

	// More than one published quiz: let the visitor pick which one to take.
	if ( ! quiz ) {
		return (
			<div className="whsc-quiz">
				<div className="whsc-quiz__stage">
					<h3 className="whsc-quiz__question">
						{ __( 'Which one would you like to take?', 'searcio' ) }
					</h3>
					<div className="whsc-quiz__options">
						{ quizzes.map( ( entry, index ) => (
							<button
								key={ entry.id ?? index }
								type="button"
								className="whsc-quiz__option"
								onClick={ () => chooseQuiz( entry ) }
							>
								{ entry.name || __( 'Start the quiz', 'searcio' ) }
							</button>
						) ) }
					</div>
				</div>
			</div>
		);
	}

	const answers = Object.entries( tags );
	const progress = quizProgress( quiz, history.length, question );
	const hits = results?.hits || [];
	// The quiz always searches with an empty term, which the service answers on
	// its lexical path - so unlike a typed search, `total` here is a real count
	// of matches (see `totalIsExact`).
	const totalMatches = Number.isFinite( Number( results?.total ) ) ? Number( results.total ) : hits.length;
	const hasMore = hasMorePages( results, hits.length, true );

	return (
		<div className={ `whsc-quiz${ question ? '' : ' whsc-quiz--results' }` }>
			{ question && (
				<div className="whsc-quiz__stage">
					<div className="whsc-quiz__meta">
						<span className="whsc-quiz__progress">
							{ sprintf(
								/* translators: 1: current question number. 2: total questions in the quiz. */
								__( 'Question %1$d of %2$d', 'searcio' ),
								progress.current,
								progress.total
							) }
						</span>
						{ history.length > 0 && (
							<button type="button" className="whsc-quiz__back" onClick={ back }>
								{ __( 'Back', 'searcio' ) }
							</button>
						) }
					</div>

					{ '' !== question.image && (
						<img className="whsc-quiz__image" src={ question.image } alt="" loading="lazy" />
					) }

					<h3 className="whsc-quiz__question" ref={ stepHeadingRef } tabIndex={ -1 }>
						{ question.text }
					</h3>

					<div className="whsc-quiz__options">
						{ question.options.map( ( option, index ) => (
							<button
								key={ option.id || index }
								type="button"
								className="whsc-quiz__option"
								onClick={ () => answer( option ) }
							>
								{ option.label }
							</button>
						) ) }
					</div>
				</div>
			) }

			{ ! question && (
				<div className="whsc-quiz__results">
					<div className="whsc-quiz__results-head">
						<h3
							className="whsc-quiz__results-count"
							ref={ stepHeadingRef }
							tabIndex={ -1 }
							// Silent once a search has failed: the alert below says so,
							// and a count here read out "0 matches" for answers that
							// were never searched.
							aria-live={ '' === error ? 'polite' : undefined }
						>
							{ isSearching && __( 'Finding your matches…', 'searcio' ) }
							{ ! isSearching && ! results && __( 'Your matches', 'searcio' ) }
							{ ! isSearching && results && ( hasMore
									? sprintf(
										/* translators: 1: number of matches loaded so far. 2: total number of matches. */
										__( '%1$d of %2$d matches', 'searcio' ),
										hits.length,
										totalMatches
									)
									: sprintf(
										/* translators: %d: number of matching products. */
										_n( '%d match', '%d matches', totalMatches, 'searcio' ),
										totalMatches
									) ) }
						</h3>
						<div className="whsc-quiz__results-actions">
							{ history.length > 0 && (
								<button type="button" className="whsc-quiz__back" onClick={ back }>
									{ __( 'Back', 'searcio' ) }
								</button>
							) }
							<button type="button" className="whsc-quiz__restart" onClick={ restart }>
								{ __( 'Start over', 'searcio' ) }
							</button>
						</div>
					</div>

					{ answers.length > 0 && (
						<ul className="whsc-quiz__answers" aria-label={ __( 'Your answers', 'searcio' ) }>
							{ answers.map( ( [ field, value ] ) => (
								<li className="whsc-quiz__answer" key={ field }>
									<span className="whsc-quiz__answer-field">{ humanizeFieldLabel( field, getConfig().fieldLabels ) }</span>
									<span className="whsc-quiz__answer-value">{ answerLabels[ field ] || value }</span>
								</li>
							) ) }
						</ul>
					) }

					{ '' !== error && (
						<p className="whsc-quiz__error" role="alert">
							{ error }
						</p>
					) }

					{ isSearching && <SearchResultsSkeleton /> }

					{ ! isSearching && '' === error && hits.length > 0 && (
						<div className="whsc-quiz__grid">
							{ hits.map( ( hit, index ) => (
								<ResultCard
									key={ hit.id }
									hit={ hit }
									cardSource={ cardSource }
									serverTemplates={ serverTemplates }
									// The quiz ends in a real `/search`, so these
									// clicks feed click-ranking like any other.
									onClick={ () => trackClick( results?.search_id, hit.id, index + 1 ) }
								/>
							) ) }
						</div>
					) }

					{ ! isSearching && hasMore && (
						<div className="whsc-load-more">
							<button
								type="button"
								className="whsc-load-more__button"
								onClick={ () => void loadMore() }
								disabled={ isLoadingMore }
							>
								{ isLoadingMore
									? __( 'Loading…', 'searcio' )
									: __( 'Load more matches', 'searcio' ) }
							</button>
						</div>
					) }

					{ ! isSearching && '' === error && 0 === hits.length && results && (
						<p className="whsc-quiz__empty">
							{ __(
								'Nothing matched every answer. Go back a step and try a different one.',
								'searcio'
							) }
						</p>
					) }
				</div>
			) }
		</div>
	);
};

export default QuizPane;
