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
 *   OR for a filter.
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
		const seen = fromThisAnswer[ tag.field ];

		// Skip a repeat of the same value: `red,red` filters no differently
		// and only makes the URL harder to read.
		if ( undefined === seen ) {
			fromThisAnswer[ tag.field ] = tag.value;
		} else if ( ! seen.split( ',' ).includes( tag.value ) ) {
			fromThisAnswer[ tag.field ] = `${ seen },${ tag.value }`;
		}
	} );

	return { ...tags, ...fromThisAnswer };
};

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
 * How far through the quiz the visitor is. The graph branches, so this counts
 * questions actually answered against the longest the quiz could run - it is a
 * "you are making progress" cue, not an exact prediction.
 *
 * @param {Object} quiz
 * @param {number} answered
 * @return {{current: number, total: number}}
 */
export const quizProgress = ( quiz, answered ) => ( {
	current: Math.min( answered + 1, ( quiz?.questions || [] ).length ),
	total: ( quiz?.questions || [] ).length,
} );
