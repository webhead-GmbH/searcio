import { useCallback, useEffect, useLayoutEffect, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';

import { askAssistant } from '../../../utils/api';
import { NARROW, useMediaQuery } from '../../../utils/mediaQuery';
import CompareTable, { comparisonRows } from './CompareTable';
import Markdown from './markdown';
import { compareIcon, gridIcon, sendIcon, sparkleIcon } from './icons';
import { ResultCard } from './templates';

// Matches the API's history/message caps (docs/api/search.md POST /assistant).
const HISTORY_LIMIT = 20;
const MESSAGE_MAX = 2000;
// Each history entry is validated separately: `required` and `max:4000`. A
// reply longer than that - or an empty one from a provider hiccup - would make
// every following turn 422, and because the entry stays in the thread no retry
// could ever clear it. Trimmed on the way out instead.
const HISTORY_CONTENT_MAX = 4000;

const errorFor = ( status ) => {
	if ( 403 === status ) {
		return __( 'The assistant is not available on this plan.', 'webhead-search-cloud' );
	}

	if ( 429 === status ) {
		return __( 'The assistant has reached its limit for now. Please try again later.', 'webhead-search-cloud' );
	}

	return __( 'The assistant is unavailable right now. Try searching instead.', 'webhead-search-cloud' );
};

const Message = ( { role, content } ) => {
	const isAssistant = 'assistant' === role;

	return (
		<div className={ `whsc-assistant__msg whsc-assistant__msg--${ isAssistant ? 'assistant' : 'user' }` }>
			{ isAssistant && (
				<span className="whsc-assistant__avatar" aria-hidden="true">{ sparkleIcon }</span>
			) }
			<div className="whsc-assistant__bubble">
				{ /* The assistant answers in Markdown; the visitor's own message is
				     literal text and must never be reinterpreted as formatting. */ }
				{ isAssistant ? <Markdown content={ content } /> : content }
			</div>
		</div>
	);
};

/**
 * The conversational shopping assistant tab: a chat thread on the left and the
 * assistant's found products (as a card grid, or an attribute Compare table) on
 * the right. Talks to the stateless `POST /assistant` endpoint, resending recent
 * turns as history. Rendered only when `/storefront-config` reports the plan
 * includes the assistant (see SearchModal).
 *
 * On a narrow screen the chat and the products stack in one column, and the
 * message field goes last, under the products it asks about. That order is the
 * DOM's, not a CSS `order`: reordered visually, Tab from the field jumped back
 * up into the products it had just passed.
 *
 * @param {Object}        props
 * @param {string}        [props.cardSource]       Passed through to ResultCard.
 * @param {Array<Object>} [props.serverTemplates]  Passed through to ResultCard.
 */
const AiAssistant = ( { cardSource, serverTemplates } ) => {
	const [ messages, setMessages ] = useState( [] );
	const [ input, setInput ] = useState( '' );
	const [ isSending, setIsSending ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ compare, setCompare ] = useState( false );
	const threadRef = useRef( null );
	const abortRef = useRef( null );
	const lastAttemptRef = useRef( null );
	const isNarrow = useMediaQuery( NARROW );
	const inputRef = useRef( null );
	// Crossing 782px - a phone turned sideways, a window zoomed - moves the
	// field to its other place, which means a new element. Whether the old one
	// had focus, and where the caret was, is read while rendering: the old
	// element is still in the page then, and gone by the time an effect runs.
	const refocusRef = useRef( null );
	const field = inputRef.current;

	refocusRef.current = field && field === field.ownerDocument.activeElement
		? [ field.selectionStart, field.selectionEnd ]
		: null;

	useLayoutEffect( () => {
		const caret = refocusRef.current;
		const input = inputRef.current;

		if ( caret && input && input !== input.ownerDocument.activeElement ) {
			input.focus();
			input.setSelectionRange( caret[ 0 ], caret[ 1 ] );
		}
	}, [ isNarrow ] );

	// The most recent assistant turn that returned products drives the right pane.
	const withProducts = [ ...messages ].reverse().find(
		( message ) => 'assistant' === message.role && ( message.products || [] ).length > 0
	);
	const products = withProducts?.products || [];
	// Offered only when the table would have a row: products that carry just a
	// title, link, image and price opened a table with a header and no body.
	const canCompare = products.length >= 2 && comparisonRows( products ).length > 0;
	// A new product set can have nothing to compare while the toggle was on.
	const comparing = compare && canCompare;

	// Store-agnostic openers for the empty state. Kept short so all three sit on
	// one row rather than wrapping into a lopsided 2 + 1.
	const STARTERS = [
		__( "What's popular?", 'webhead-search-cloud' ),
		__( 'Help me find a gift', 'webhead-search-cloud' ),
		__( "What's on sale?", 'webhead-search-cloud' ),
	];

	const send = useCallback( async ( preset ) => {
		const trimmed = ( 'string' === typeof preset ? preset : input ).trim().slice( 0, MESSAGE_MAX );

		if ( '' === trimmed || isSending ) {
			return;
		}

		const history = messages
			.map( ( { role, content } ) => ( { role, content: String( content || '' ).slice( 0, HISTORY_CONTENT_MAX ) } ) )
			.filter( ( turn ) => '' !== turn.content )
			.slice( -HISTORY_LIMIT );

		setMessages( ( current ) => [ ...current, { role: 'user', content: trimmed } ] );
		setInput( '' );
		setError( '' );
		setCompare( false );
		setIsSending( true );
		// Remembered so a failure can be retried without the visitor having to
		// retype what they already sent.
		lastAttemptRef.current = { message: trimmed, history };

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const response = await askAssistant( trimmed, history, { signal: controller.signal } );

			setMessages( ( current ) => [
				...current,
				{ role: 'assistant', content: response.reply || '', products: response.products || [] },
			] );
		} catch ( e ) {
			if ( 'AbortError' !== e.name ) {
				setError( errorFor( e.status ) );
			}
		} finally {
			setIsSending( false );
		}
	}, [ input, isSending, messages ] );

	/**
	 * Re-send the message that failed. The turn is already in the thread, so
	 * this replays the request rather than appending the message a second time.
	 */
	const retry = useCallback( async () => {
		const attempt = lastAttemptRef.current;

		if ( ! attempt || isSending ) {
			return;
		}

		setError( '' );
		setCompare( false );
		setIsSending( true );

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const response = await askAssistant( attempt.message, attempt.history, { signal: controller.signal } );

			setMessages( ( current ) => [
				...current,
				{ role: 'assistant', content: response.reply || '', products: response.products || [] },
			] );
		} catch ( e ) {
			if ( 'AbortError' !== e.name ) {
				setError( errorFor( e.status ) );
			}
		} finally {
			setIsSending( false );
		}
	}, [ isSending ] );

	// Keep the newest turn in view.
	useEffect( () => {
		threadRef.current?.scrollTo( { top: threadRef.current.scrollHeight } );
	}, [ messages, isSending, error ] );

	const onSubmit = ( event ) => {
		event.preventDefault();
		send();
	};

	const composer = (
		<form className="whsc-assistant__composer" onSubmit={ onSubmit }>
			<input
				ref={ inputRef }
				type="text"
				className="whsc-assistant__input"
				value={ input }
				maxLength={ MESSAGE_MAX }
				placeholder={ __( 'Write what you need', 'webhead-search-cloud' ) }
				aria-label={ __( 'Message the assistant', 'webhead-search-cloud' ) }
				onChange={ ( event ) => setInput( event.target.value ) }
				disabled={ isSending }
			/>
			<Button
				type="submit"
				className="whsc-assistant__send"
				icon={ sendIcon }
				label={ __( 'Send', 'webhead-search-cloud' ) }
				disabled={ isSending || '' === input.trim() }
			/>
		</form>
	);

	return (
		<div className={ `whsc-assistant${ products.length > 0 ? ' whsc-assistant--split' : '' }` }>
			<div className="whsc-assistant__chat">
				<div className="whsc-assistant__thread" ref={ threadRef }>
					{ 0 === messages.length && (
						<div className="whsc-assistant__intro">
							<span className="whsc-assistant__avatar whsc-assistant__avatar--lg" aria-hidden="true">
								{ sparkleIcon }
							</span>
							<p className="whsc-assistant__intro-text">
								{ __(
									"Describe what you're looking for and I'll find it in this store.",
									'webhead-search-cloud'
								) }
							</p>
							{ /* A blank chat box gives no clue what it can do, so offer
							     store-agnostic openers that fill and send the message. */ }
							<div className="whsc-assistant__starters">
								{ STARTERS.map( ( starter ) => (
									<button
										key={ starter }
										type="button"
										className="whsc-assistant__starter"
										onClick={ () => send( starter ) }
									>
										{ starter }
									</button>
								) ) }
							</div>
						</div>
					) }

					{ messages.map( ( message, index ) => (
						<Message key={ index } role={ message.role } content={ message.content } />
					) ) }

					{ /* A bare spinner reads as "something is loading", not as the
					     assistant working on an answer - so say so, and animate it
					     so the wait feels alive rather than frozen. */ }
					{ isSending && (
						<div className="whsc-assistant__msg whsc-assistant__msg--assistant">
							<span
								className="whsc-assistant__avatar whsc-assistant__avatar--thinking"
								aria-hidden="true"
							>
								{ sparkleIcon }
							</span>
							<p className="whsc-assistant__thinking" role="status">
								<span className="whsc-assistant__thinking-text">
									{ __( 'Thinking', 'webhead-search-cloud' ) }
								</span>
								<span className="whsc-assistant__dots" aria-hidden="true">
									<i /><i /><i />
								</span>
							</p>
						</div>
					) }

					{ /* Given the same avatar and row as a reply: a failure is the
					     assistant answering, not a form validation message
					     floating loose in the thread. */ }
					{ '' !== error && (
						<div className="whsc-assistant__msg whsc-assistant__msg--assistant">
							<span className="whsc-assistant__avatar" aria-hidden="true">{ sparkleIcon }</span>
							<div className="whsc-assistant__error" role="alert">
								<span>{ error }</span>
								{ null !== lastAttemptRef.current && (
									<button
										type="button"
										className="whsc-assistant__retry"
										onClick={ retry }
									>
										{ __( 'Try again', 'webhead-search-cloud' ) }
									</button>
								) }
							</div>
						</div>
					) }
				</div>

				{ ! isNarrow && composer }
			</div>

			{ products.length > 0 && (
				<div className="whsc-assistant__results">
					<div className="whsc-assistant__results-head">
						<span className="whsc-assistant__results-count">
							{ comparing
								? sprintf(
									/* translators: %d: number of products being compared. */
									_n( 'Comparing %d product', 'Comparing %d products', products.length, 'webhead-search-cloud' ),
									products.length
								)
								: sprintf(
									/* translators: %d: number of products. */
									_n( '%d result', '%d results', products.length, 'webhead-search-cloud' ),
									products.length
								) }
						</span>
						{ canCompare && (
							<button
								type="button"
								className="whsc-assistant__compare-toggle"
								aria-pressed={ comparing }
								onClick={ () => setCompare( ( value ) => ! value ) }
							>
								<span className="whsc-assistant__compare-icon" aria-hidden="true">
									{ comparing ? gridIcon : compareIcon }
								</span>
								{ comparing
									? __( 'Back to list', 'webhead-search-cloud' )
									: __( 'Compare', 'webhead-search-cloud' ) }
							</button>
						) }
					</div>

					{ comparing ? (
						<CompareTable products={ products } />
					) : (
						<div className="whsc-assistant__grid">
							{ products.map( ( hit ) => (
								<ResultCard
									key={ hit.id }
									hit={ hit }
									cardSource={ cardSource }
									serverTemplates={ serverTemplates }
								/>
							) ) }
						</div>
					) }
				</div>
			) }

			{ isNarrow && composer }
		</div>
	);
};

export default AiAssistant;
