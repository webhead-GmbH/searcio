/**
 * The Product finder tab's quiz data, and the edits to it that have to keep
 * the question graph consistent: a removed question must not leave answers
 * pointing at a question that no longer exists.
 *
 * The rules are Searcio's own (`docs/api/quiz.md`, "Managing quizzes from a
 * plugin"), and the Searcio panel's quiz builder edits a quiz the same way,
 * so a quiz made in one opens in the other as it was left. Pure, so they are
 * tested without rendering the editor.
 */

/** Searcio's limits for one quiz. */
export const MAX_QUESTIONS = 30;
export const MAX_OPTIONS = 8;

/**
 * The first free id of the form `prefix-N`, counting up from one more than
 * the ids taken, so a new question reads "question-3", not a timestamp.
 *
 * @param {Array<string>} taken
 * @param {string}        prefix
 * @return {string} The id.
 */
export const nextFreeId = ( taken, prefix ) => {
	let number = taken.length + 1;

	while ( taken.includes( `${ prefix }-${ number }` ) ) {
		number++;
	}

	return `${ prefix }-${ number }`;
};

/**
 * @param {Array<Object>} questions The quiz's questions so far.
 * @return {Object} An empty question with an id of its own.
 */
export const newQuestion = ( questions ) => ( {
	id: nextFreeId( questions.map( ( question ) => question.id ), 'question' ),
	text: '',
	image: '',
	options: [],
} );

/**
 * @param {Object} question
 * @return {Object} An empty answer of that question, which ends the quiz.
 */
export const newOption = ( question ) => ( {
	id: nextFreeId( question.options.map( ( option ) => option.id ), 'answer' ),
	label: '',
	next_question_id: null,
	tags_matched: [],
	keywords: '',
	ranges_matched: [],
} );

/**
 * Drop a question. Answers that led to it end the quiz instead of pointing at
 * nothing, which Searcio would refuse to save.
 *
 * @param {Array<Object>} questions
 * @param {number}        index
 * @return {Array<Object>} The questions without it.
 */
export const removeQuestion = ( questions, index ) => {
	const removed = questions[ index ]?.id;

	return questions
		.filter( ( _, i ) => i !== index )
		.map( ( question ) => ( {
			...question,
			options: question.options.map( ( option ) =>
				option.next_question_id === removed ? { ...option, next_question_id: null } : option
			),
		} ) );
};

const text = ( value ) => ( 'string' === typeof value || 'number' === typeof value ? String( value ) : '' );

const bound = ( value ) => {
	if ( null === value || undefined === value || '' === value ) {
		return null;
	}

	const number = Number( value );

	return Number.isFinite( number ) ? number : null;
};

/**
 * A quiz as Searcio sent it, with every part present, so each input of the
 * editor has a value of its own type.
 *
 * @param {Object} raw
 * @return {Object} `{ id, name, status, lang, questions }`.
 */
export const normalizeQuiz = ( raw ) => ( {
	id: Number( raw?.id ) || 0,
	name: text( raw?.name ),
	status: 'published' === raw?.status ? 'published' : 'draft',
	lang: 'string' === typeof raw?.lang && '' !== raw.lang ? raw.lang : null,
	questions: ( Array.isArray( raw?.questions ) ? raw.questions : [] ).map( ( question ) => ( {
		id: text( question?.id ),
		text: text( question?.text ),
		image: text( question?.image ),
		options: ( Array.isArray( question?.options ) ? question.options : [] ).map( ( option ) => ( {
			id: text( option?.id ),
			label: text( option?.label ),
			next_question_id: null === option?.next_question_id || undefined === option?.next_question_id ? null : text( option.next_question_id ),
			tags_matched: ( Array.isArray( option?.tags_matched ) ? option.tags_matched : [] )
				.map( ( tag ) => ( { field: text( tag?.field ), value: text( tag?.value ) } ) ),
			keywords: text( option?.keywords ),
			ranges_matched: ( Array.isArray( option?.ranges_matched ) ? option.ranges_matched : [] )
				.map( ( range ) => ( { field: text( range?.field ), min: bound( range?.min ), max: bound( range?.max ) } ) ),
		} ) ),
	} ) ),
} );

/**
 * The graph as it is sent: the optional parts left out when they are empty,
 * range bounds as numbers, and a condition with no field or no value, which
 * the editor shows while it is being filled in, left out.
 *
 * @param {Array<Object>} questions
 * @return {Array<Object>} The questions to send.
 */
export const graphForSave = ( questions ) => questions.map( ( question ) => {
	const image = question.image?.trim() ?? '';

	return {
		id: question.id,
		text: question.text.trim(),
		...( '' !== image ? { image } : {} ),
		options: question.options.map( ( option ) => {
			const keywords = option.keywords?.trim() ?? '';
			const ranges = ( option.ranges_matched || [] )
				.map( ( range ) => ( { field: range.field, min: bound( range.min ), max: bound( range.max ) } ) )
				.filter( ( range ) => '' !== range.field && ( null !== range.min || null !== range.max ) );

			return {
				id: option.id,
				label: option.label.trim(),
				next_question_id: option.next_question_id,
				tags_matched: ( option.tags_matched || [] ).filter( ( tag ) => '' !== tag.field && '' !== tag.value.trim() )
					.map( ( tag ) => ( { field: tag.field, value: tag.value.trim() } ) ),
				...( '' !== keywords ? { keywords } : {} ),
				...( ranges.length > 0 ? { ranges_matched: ranges } : {} ),
			};
		} ),
	};
} );

/**
 * What a save would store, as one string: two quizzes that would store the
 * same compare equal, whatever half-filled rows the editor still shows.
 *
 * @param {Object} quiz
 * @return {string} A comparable form.
 */
export const savedForm = ( quiz ) => JSON.stringify( {
	name: quiz.name.trim(),
	lang: quiz.lang,
	questions: graphForSave( quiz.questions ),
} );

/**
 * How a typed filter value relates to the values the site has: one of them,
 * the same one spelled in another case (a filter matches the case too, so
 * "schwarz" finds nothing), or none of them. Undecided while the values have
 * not loaded, so nothing is flagged early.
 *
 * @param {string}                                    value
 * @param {Array<{value: string, count: number}>|undefined} known
 * @return {{kind: string, count?: number, value?: string}} The verdict.
 */
export const valueStatus = ( value, known ) => {
	const typed = String( value || '' ).trim();

	if ( undefined === known || '' === typed ) {
		return { kind: 'unchecked' };
	}

	const exact = known.find( ( entry ) => entry.value === typed );

	if ( exact ) {
		return { kind: 'known', count: exact.count };
	}

	const near = known.find( ( entry ) => entry.value.toLocaleLowerCase() === typed.toLocaleLowerCase() );

	return near ? { kind: 'respell', value: near.value } : { kind: 'unknown' };
};

/**
 * @param {Array<Object>} endings `endings` from Searcio.
 * @return {{total: number, empty: number, unknown: number}} How many endings, how many show nothing, how many use a field that is not a filter.
 */
export const endingCounts = ( endings ) => ( {
	total: endings.length,
	empty: endings.filter( ( ending ) => 0 === ending.count ).length,
	unknown: endings.filter( ( ending ) => null === ending.count ).length,
} );
