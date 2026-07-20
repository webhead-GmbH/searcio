import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';

import { askAssistant } from '../../../utils/api';
import CompareTable from './CompareTable';
import { sendIcon, sparkleIcon } from './icons';
import { ResultCard } from './templates';

// Matches the API's history/message caps (docs/api/search.md POST /assistant).
const HISTORY_LIMIT = 20;
const MESSAGE_MAX = 2000;

const errorFor = ( status ) => {
	if ( 403 === status ) {
		return __( 'The assistant is not available on this plan.', 'webhead-search-cloud' );
	}

	if ( 429 === status ) {
		return __( 'The assistant has reached its limit for now. Please try again later.', 'webhead-search-cloud' );
	}

	return __( 'The assistant is unavailable right now. Try searching instead.', 'webhead-search-cloud' );
};

const Message = ( { role, content } ) => (
	<div className={ `whsc-assistant__msg whsc-assistant__msg--${ 'assistant' === role ? 'assistant' : 'user' }` }>
		{ 'assistant' === role && (
			<span className="whsc-assistant__avatar" aria-hidden="true">{ sparkleIcon }</span>
		) }
		<div className="whsc-assistant__bubble">{ content }</div>
	</div>
);

/**
 * The conversational shopping assistant tab: a chat thread on the left and the
 * assistant's found products (as a card grid, or an attribute Compare table) on
 * the right. Talks to the stateless `POST /assistant` endpoint, resending recent
 * turns as history. Rendered only when `/storefront-config` reports the plan
 * includes the assistant (see SearchModal).
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

	// The most recent assistant turn that returned products drives the right pane.
	const withProducts = [ ...messages ].reverse().find(
		( message ) => 'assistant' === message.role && ( message.products || [] ).length > 0
	);
	const products = withProducts?.products || [];

	const send = useCallback( async () => {
		const trimmed = input.trim().slice( 0, MESSAGE_MAX );

		if ( '' === trimmed || isSending ) {
			return;
		}

		const history = messages
			.map( ( { role, content } ) => ( { role, content } ) )
			.slice( -HISTORY_LIMIT );

		setMessages( ( current ) => [ ...current, { role: 'user', content: trimmed } ] );
		setInput( '' );
		setError( '' );
		setCompare( false );
		setIsSending( true );

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

	// Keep the newest turn in view.
	useEffect( () => {
		threadRef.current?.scrollTo( { top: threadRef.current.scrollHeight } );
	}, [ messages, isSending, error ] );

	const onSubmit = ( event ) => {
		event.preventDefault();
		send();
	};

	return (
		<div className="whsc-assistant">
			<div className="whsc-assistant__chat">
				<div className="whsc-assistant__thread" ref={ threadRef }>
					{ 0 === messages.length && (
						<div className="whsc-assistant__intro">
							<span className="whsc-assistant__avatar whsc-assistant__avatar--lg" aria-hidden="true">
								{ sparkleIcon }
							</span>
							<p>
								{ __(
									"Describe what you're looking for and I'll find it in this store.",
									'webhead-search-cloud'
								) }
							</p>
						</div>
					) }

					{ messages.map( ( message, index ) => (
						<Message key={ index } role={ message.role } content={ message.content } />
					) ) }

					{ isSending && (
						<div className="whsc-assistant__msg whsc-assistant__msg--assistant">
							<span className="whsc-assistant__avatar" aria-hidden="true">{ sparkleIcon }</span>
							<div className="whsc-assistant__bubble whsc-assistant__bubble--typing">
								<Spinner />
							</div>
						</div>
					) }

					{ '' !== error && (
						<div className="whsc-assistant__error" role="alert">{ error }</div>
					) }
				</div>

				<form className="whsc-assistant__composer" onSubmit={ onSubmit }>
					<input
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
			</div>

			{ products.length > 0 && (
				<div className="whsc-assistant__results">
					<div className="whsc-assistant__results-head">
						<span className="whsc-assistant__results-count">
							{ sprintf(
								/* translators: %d: number of products. */
								_n( '%d result', '%d results', products.length, 'webhead-search-cloud' ),
								products.length
							) }
						</span>
						{ products.length >= 2 && (
							<Button
								variant="secondary"
								className="whsc-assistant__compare-toggle"
								onClick={ () => setCompare( ( value ) => ! value ) }
							>
								{ compare
									? __( 'Back to list', 'webhead-search-cloud' )
									: __( 'Compare', 'webhead-search-cloud' ) }
							</Button>
						) }
					</div>

					{ compare ? (
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
		</div>
	);
};

export default AiAssistant;
