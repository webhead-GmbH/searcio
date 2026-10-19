import {
	applyOption,
	findQuestion,
	firstQuestion,
	nextQuestion,
	normalizeQuiz,
	normalizeQuizzes,
	quizProgress,
} from './quiz';

const QUIZ = {
	id: 4,
	name: 'Find your fit',
	questions: [
		{
			id: 'style',
			text: "What's your style?",
			image: 'https://cdn.example.com/style.jpg',
			options: [
				{
					id: 'casual',
					label: 'Casual',
					next_question_id: 'size',
					tags_matched: [ { field: 'style', value: 'casual' } ],
				},
				{
					id: 'formal',
					label: 'Formal',
					next_question_id: null,
					tags_matched: [ { field: 'style', value: 'formal' } ],
				},
			],
		},
		{
			id: 'size',
			text: 'What size?',
			options: [
				{ id: 'm', label: 'Medium', next_question_id: null, tags_matched: [ { field: 'size', value: 'm' } ] },
			],
		},
	],
};

describe( 'normalizeQuizzes', () => {
	it( 'keeps a well-formed quiz intact', () => {
		const [ quiz ] = normalizeQuizzes( { quizzes: [ QUIZ ] } );

		expect( quiz.name ).toBe( 'Find your fit' );
		expect( quiz.questions ).toHaveLength( 2 );
		expect( quiz.questions[ 0 ].options[ 0 ].tags_matched ).toEqual( [ { field: 'style', value: 'casual' } ] );
	} );

	it( 'returns an empty list for a site with no published quiz', () => {
		expect( normalizeQuizzes( { quizzes: [] } ) ).toEqual( [] );
		expect( normalizeQuizzes( {} ) ).toEqual( [] );
		expect( normalizeQuizzes( null ) ).toEqual( [] );
	} );

	it( 'drops a quiz with no usable questions rather than rendering an empty flow', () => {
		expect( normalizeQuizzes( { quizzes: [ { id: 1, questions: [] } ] } ) ).toEqual( [] );
	} );

	it( 'preserves a null next_question_id, since that is what ends the quiz', () => {
		const quiz = normalizeQuiz( {
			questions: [ { id: 'a', options: [ { label: 'x' } ] } ],
		} );

		expect( quiz.questions[ 0 ].options[ 0 ].next_question_id ).toBeNull();
	} );

	it( 'coerces numeric question ids so pointer lookups still match', () => {
		const quiz = normalizeQuiz( {
			questions: [ { id: 1, options: [ { label: 'x', next_question_id: 2 } ] }, { id: 2, options: [] } ],
		} );

		expect( findQuestion( quiz, 2 ).id ).toBe( '2' );
		expect( nextQuestion( quiz, quiz.questions[ 0 ].options[ 0 ] ).id ).toBe( '2' );
	} );
} );

describe( 'walking the graph', () => {
	const quiz = normalizeQuiz( QUIZ );

	it( 'starts at the first question in authoring order', () => {
		expect( firstQuestion( quiz ).id ).toBe( 'style' );
	} );

	it( 'follows next_question_id to the next question', () => {
		expect( nextQuestion( quiz, quiz.questions[ 0 ].options[ 0 ] ).id ).toBe( 'size' );
	} );

	it( 'ends the quiz on a null pointer', () => {
		expect( nextQuestion( quiz, quiz.questions[ 0 ].options[ 1 ] ) ).toBeNull();
	} );

	it( 'ends rather than looping when a quiz somehow ships a cycle', () => {
		const looped = normalizeQuiz( {
			questions: [ { id: 'a', options: [ { label: 'again', next_question_id: 'a' } ] } ],
		} );

		expect( nextQuestion( looped, looped.questions[ 0 ].options[ 0 ], [ 'a' ] ) ).toBeNull();
	} );

	it( 'ends rather than crashing on a dangling pointer', () => {
		const dangling = normalizeQuiz( {
			questions: [ { id: 'a', options: [ { label: 'go', next_question_id: 'nope' } ] } ],
		} );

		expect( nextQuestion( dangling, dangling.questions[ 0 ].options[ 0 ] ) ).toBeNull();
	} );
} );

describe( 'applyOption', () => {
	it( 'accumulates tags across answers', () => {
		const quiz = normalizeQuiz( QUIZ );
		const afterStyle = applyOption( {}, quiz.questions[ 0 ].options[ 0 ] );

		expect( applyOption( afterStyle, quiz.questions[ 1 ].options[ 0 ] ) ).toEqual( {
			style: 'casual',
			size: 'm',
		} );
	} );

	it( 'lets a later answer replace an earlier one for the same field', () => {
		const first = applyOption( {}, { tags_matched: [ { field: 'style', value: 'casual' } ] } );

		expect( applyOption( first, { tags_matched: [ { field: 'style', value: 'formal' } ] } ) ).toEqual( {
			style: 'formal',
		} );
	} );

	it( 'does not mutate the accumulator it was given', () => {
		const tags = { style: 'casual' };

		applyOption( tags, { tags_matched: [ { field: 'size', value: 'm' } ] } );

		expect( tags ).toEqual( { style: 'casual' } );
	} );

	it( 'is a no-op for an answer that tags nothing', () => {
		expect( applyOption( { style: 'casual' }, { label: 'Skip' } ) ).toEqual( { style: 'casual' } );
	} );

	/**
	 * One answer meaning "any of these" - a "Clothing" option tagging both
	 * `clothing` and `tshirts`. Overwriting would silently drop the first and
	 * search for half of what the merchant asked for.
	 */
	it( 'comma-joins several values one answer gives for the same field', () => {
		const option = {
			label: 'Clothing',
			tags_matched: [
				{ field: 'category', value: 'clothing' },
				{ field: 'category', value: 'tshirts' },
			],
		};

		expect( applyOption( {}, option ) ).toEqual( { category: 'clothing,tshirts' } );
	} );

	it( 'does not repeat a value an answer lists twice', () => {
		const option = {
			tags_matched: [
				{ field: 'category', value: 'shoes' },
				{ field: 'category', value: 'shoes' },
			],
		};

		expect( applyOption( {}, option ) ).toEqual( { category: 'shoes' } );
	} );

	/** A later answer still replaces, rather than accumulating forever. */
	it( 'replaces a multi-value answer wholesale when the field is answered again', () => {
		const first = applyOption( {}, {
			tags_matched: [
				{ field: 'category', value: 'clothing' },
				{ field: 'category', value: 'tshirts' },
			],
		} );

		expect( applyOption( first, { tags_matched: [ { field: 'category', value: 'shoes' } ] } ) ).toEqual( {
			category: 'shoes',
		} );
	} );
} );

describe( 'quizProgress', () => {
	const question = ( id, ...next ) => ( {
		id,
		text: id,
		options: next.map( ( to, i ) => ( { id: `${ id }-${ i }`, label: String( to ), next_question_id: to, tags_matched: [] } ) ),
	} );
	const quizOf = ( ...questions ) => normalizeQuiz( { id: 9, name: 'Q', questions } );

	it( 'counts the question being answered against the questions on the way', () => {
		const quiz = normalizeQuiz( QUIZ );

		expect( quizProgress( quiz, 0 ) ).toEqual( { current: 1, total: 2 } );
		expect( quizProgress( quiz, 1, findQuestion( quiz, 'size' ) ) ).toEqual( { current: 2, total: 2 } );
	} );

	it( 'does not count the questions of a branch the visitor cannot reach', () => {
		// Three questions, two on any path: what, then either kind or colour.
		const quiz = quizOf( question( 'what', 'kind', 'colour' ), question( 'kind', null ), question( 'colour', null ) );

		expect( quizProgress( quiz, 0 ) ).toEqual( { current: 1, total: 2 } );
		expect( quizProgress( quiz, 1, findQuestion( quiz, 'kind' ) ) ).toEqual( { current: 2, total: 2 } );
	} );

	it( 'promises the longest branch, and shrinks once a shorter one is taken', () => {
		const quiz = quizOf( question( 'start', 'short', 'long' ), question( 'short', null ), question( 'long', 'last' ), question( 'last', null ) );

		expect( quizProgress( quiz, 0 ) ).toEqual( { current: 1, total: 3 } );
		expect( quizProgress( quiz, 1, findQuestion( quiz, 'short' ) ) ).toEqual( { current: 2, total: 2 } );
		expect( quizProgress( quiz, 1, findQuestion( quiz, 'long' ) ) ).toEqual( { current: 2, total: 3 } );
		expect( quizProgress( quiz, 2, findQuestion( quiz, 'last' ) ) ).toEqual( { current: 3, total: 3 } );
	} );

	it( 'gives a number for a quiz that loops', () => {
		const quiz = quizOf( question( 'a', 'b' ), question( 'b', 'a' ) );

		expect( quizProgress( quiz, 0 ) ).toEqual( { current: 1, total: 2 } );
	} );
} );
