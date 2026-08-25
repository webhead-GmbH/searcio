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
} );

describe( 'quizProgress', () => {
	it( 'counts the question being answered, capped at the quiz length', () => {
		const quiz = normalizeQuiz( QUIZ );

		expect( quizProgress( quiz, 0 ) ).toEqual( { current: 1, total: 2 } );
		expect( quizProgress( quiz, 1 ) ).toEqual( { current: 2, total: 2 } );
		expect( quizProgress( quiz, 5 ) ).toEqual( { current: 2, total: 2 } );
	} );
} );
