/**
 * Pure helpers for the guided quiz (see `docs/api/quiz.md`).
 *
 * A quiz is a directed graph of questions: each answer optionally tags a
 * catalogue field and points at the next question, and a `null` pointer ends
 * the quiz. The whole graph arrives in one `/quizzes` response, so the walk
 * happens entirely in the browser and only the final, filtered `/search` hits
 * the network again.
 *
 * Kept side-effect free so the traversal can be tested without a DOM or a
 * mocked `fetch`.
 */

import { filterValue } from './facets';

/**
 * A range bound as a number, or null when it is missing or not a number.
 *
 * @param {*} value
 * @return {number|null}
 */
const boundOrNull = ( value ) => {
	if ( null === value || undefined === value || '' === value ) {
		return null;
	}

	const number = Number( value );

	return Number.isFinite( number ) ? number : null;
};

/**
 * The API is the source of truth, but a malformed quiz must not be able to
 * crash the modal - every field is defaulted rather than trusted.
 *
 * @param {Object} raw One entry from `/quizzes`.
 * @return {Object|null} A quiz with at least one question, or null.
 */
export const normalizeQuiz = ( raw ) => {
	const questions = ( Array.isArray( raw?.questions ) ? raw.questions : [] )
		.filter( ( question ) => question && undefined !== question.id && null !== question.id )
		.map( ( question ) => ( {
			id: String( question.id ),
			text: 'string' === typeof question.text ? question.text : '',
			image: 'string' === typeof question.image ? question.image : '',
			options: ( Array.isArray( question.options ) ? question.options : [] ).map( ( option ) => ( {
				id: undefined === option?.id || null === option?.id ? '' : String( option.id ),
				label: 'string' === typeof option?.label ? option.label : '',
				// `null` is meaningful here - it is what ends the quiz - so a
				// missing pointer has to normalize to null, never to ''.
				next_question_id:
					undefined === option?.next_question_id || null === option?.next_question_id
						? null
						: String( option.next_question_id ),
				tags_matched: ( Array.isArray( option?.tags_matched ) ? option.tags_matched : [] )
					.filter( ( tag ) => tag && 'string' === typeof tag.field && '' !== tag.field )
					.map( ( tag ) => ( { field: tag.field, value: String( tag.value ?? '' ) } ) ),
				// Both optional (`quiz.md`): words the products must contain,
				// and numeric ranges such as a budget.
				keywords: 'string' === typeof option?.keywords ? option.keywords.trim() : '',
				ranges_matched: ( Array.isArray( option?.ranges_matched ) ? option.ranges_matched : [] )
					.filter( ( range ) => range && 'string' === typeof range.field && '' !== range.field )
					.map( ( range ) => ( { field: range.field, min: boundOrNull( range.min ), max: boundOrNull( range.max ) } ) )
					.filter( ( range ) => null !== range.min || null !== range.max ),
			} ) ),
		} ) );

	if ( 0 === questions.length ) {
		return null;
	}

	return {
		id: raw?.id ?? null,
		name: 'string' === typeof raw?.name ? raw.name : '',
		questions,
	};
};

/**
 * @param {*} raw The `/quizzes` response.
 * @return {Array<Object>} Only quizzes that can actually be walked.
 */
export const normalizeQuizzes = ( raw ) =>
	( Array.isArray( raw?.quizzes ) ? raw.quizzes : [] )
		.map( normalizeQuiz )
		.filter( Boolean );

/**
 * The entry point. There is no separate "start" pointer in the payload -
 * authoring order is the flow order and the first question is where a visitor
 * begins (`quiz.md`, "Widget flow contract" step 1).
 *
 * @param {Object} quiz
 * @return {Object|undefined}
 */
export const firstQuestion = ( quiz ) => quiz?.questions?.[ 0 ];

/**
 * @param {Object} quiz
 * @param {string} id
 * @return {Object|undefined}
 */
export const findQuestion = ( quiz, id ) =>
	( quiz?.questions || [] ).find( ( question ) => question.id === String( id ) );

/**
 * Fold an answer's tags into the accumulated filter.
 *
 * Two rules, and they are not the same rule (`quiz.md`, "Widget flow
 * contract" steps 3 and 5):
 *
 * - One answer carrying several values for the same field means "any of
 *   these" - a "Clothing" answer tagging both `clothing` and `tshirts` is
 *   asking for either. They are comma-joined, which is how `/search` spells
 *   OR for a filter, or sent as a list when a value holds a comma of its own
 *   ({@see filterValue}). Each tag is one whole value.
 * - A *later* answer for a field replaces whatever an earlier one put there,
 *   because the visitor's most recent choice is the one that counts.
 *
 * @param {Object<string,string>} tags
 * @param {Object}                option
 * @return {Object<string,string>} A new map; the input is left alone.
 */
export const applyOption = ( tags, option ) => {
	const fromThisAnswer = {};

	( option?.tags_matched || [] ).forEach( ( tag ) => {
		( fromThisAnswer[ tag.field ] ||= [] ).push( tag.value );
	} );

	// A repeat of the same value is sent once: `red,red` filters no
	// differently and only makes the URL harder to read.
	return {
		...tags,
		...Object.fromEntries( Object.entries( fromThisAnswer ).map( ( [ field, values ] ) => [ field, filterValue( values ) ] ) ),
	};
};

/**
 * Fold an answer's ranges into the accumulated ones, as `range[field]=min:max`
 * values. Like a filter, a later answer's range on a field replaces an
 * earlier one; a missing bound is left blank ("50:" is "at least 50").
 *
 * @param {Object<string,string>} ranges
 * @param {Object}                option
 * @return {Object<string,string>} A new map; the input is left alone.
 */
export const applyRanges = ( ranges, option ) => {
	const fromThisAnswer = {};

	( option?.ranges_matched || [] ).forEach( ( range ) => {
		fromThisAnswer[ range.field ] = `${ range.min ?? '' }:${ range.max ?? '' }`;
	} );

	return { ...ranges, ...fromThisAnswer };
};

/**
 * The words this answer asks the products to contain, or '' when it asks for
 * none. Unlike filters they never replace each other: every answered group has
 * to be met, so they are kept as a list, one entry per answer.
 *
 * @param {Object} option
 * @return {string}
 */
export const answerKeywords = ( option ) => ( 'string' === typeof option?.keywords ? option.keywords.trim() : '' );

/**
 * Where the quiz goes after this answer.
 *
 * The server rejects cycles and dangling pointers at publish time, so the
 * `visited` guard is not the primary defence - it is there so a quiz that
 * somehow ships a loop stops the walk instead of rendering forever.
 *
 * @param {Object}        quiz
 * @param {Object}        option
 * @param {Array<string>} [visited] Question ids already shown in this run.
 * @return {Object|null} The next question, or null when the quiz has ended.
 */
export const nextQuestion = ( quiz, option, visited = [] ) => {
	const target = option?.next_question_id;

	if ( null === target || undefined === target || '' === target ) {
		return null;
	}

	if ( visited.includes( String( target ) ) ) {
		return null;
	}

	return findQuestion( quiz, target ) || null;
};

/**
 * How many questions a visitor can still be asked from `question` on, itself
 * included: the longest run of answers from there to the end of the quiz.
 *
 * A question already on the run ends it, as `nextQuestion()` ends a visit, so
 * a quiz that ships a loop still gives a number.
 *
 * @param {Object}      quiz
 * @param {Object|null} question
 * @return {number} 0 when there is no question.
 */
const questionsFrom = ( quiz, question ) => {
	const longest = new Map();
	const onRun = new Set();

	const walk = ( current ) => {
		if ( ! current || onRun.has( current.id ) ) {
			return 0;
		}

		if ( longest.has( current.id ) ) {
			return longest.get( current.id );
		}

		onRun.add( current.id );
		const after = Math.max( 0, ...( current.options || [] ).map( ( option ) => walk( nextQuestion( quiz, option ) ) ) );
		onRun.delete( current.id );
		longest.set( current.id, 1 + after );

		return 1 + after;
	};

	return walk( question );
};

/**
 * How far through the quiz the visitor is: the question on screen against the
 * questions answered so far plus the longest way on from this one. The graph
 * branches, so a quiz holds questions a visitor never sees, and counting them
 * all promised a "Question 3 of 3" that never came. The total can only shrink
 * as answers rule branches out; it is a "you are making progress" cue, exact
 * once the remaining path no longer branches.
 *
 * @param {Object}      quiz
 * @param {number}      answered
 * @param {Object|null} [question] The question on screen; the first one by default.
 * @return {{current: number, total: number}}
 */
export const quizProgress = ( quiz, answered, question = firstQuestion( quiz ) ) => ( {
	current: answered + 1,
	total: answered + Math.max( 1, questionsFrom( quiz, question ) ),
} );
