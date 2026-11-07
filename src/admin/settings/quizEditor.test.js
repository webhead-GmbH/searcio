/**
 * The quiz editor's graph rules. Searcio refuses a graph whose answers point
 * at a question that is not there, so every edit has to keep the links whole.
 */
import {
	endingCounts,
	graphForSave,
	newOption,
	newQuestion,
	nextFreeId,
	normalizeQuiz,
	removeQuestion,
	savedForm,
	valueStatus,
} from './quizEditor';

const question = ( id, ...next ) => ( {
	id,
	text: id,
	image: '',
	options: next.map( ( to, index ) => ( { id: `${ id }-${ index }`, label: String( to ), next_question_id: to, tags_matched: [], keywords: '', ranges_matched: [] } ) ),
} );

describe( 'new questions and answers', () => {
	it( 'numbers them after the ones taken, skipping a number in use', () => {
		expect( nextFreeId( [ 'question-1', 'question-3' ], 'question' ) ).toBe( 'question-4' );
		expect( nextFreeId( [ 'question-1', 'question-2' ], 'question' ) ).toBe( 'question-3' );
		expect( newQuestion( [ question( 'question-1' ) ] ) ).toEqual( { id: 'question-2', text: '', image: '', options: [] } );
	} );

	it( 'starts an answer that ends the quiz and narrows nothing', () => {
		expect( newOption( question( 'q', 'a' ) ) ).toEqual( {
			id: 'answer-2',
			label: '',
			next_question_id: null,
			tags_matched: [],
			keywords: '',
			ranges_matched: [],
		} );
	} );
} );

describe( 'removeQuestion', () => {
	it( 'ends the quiz at every answer that led to the question removed', () => {
		const questions = removeQuestion( [ question( 'a', 'b', 'c' ), question( 'b', null ), question( 'c', null ) ], 1 );

		expect( questions.map( ( q ) => q.id ) ).toEqual( [ 'a', 'c' ] );
		expect( questions[ 0 ].options.map( ( option ) => option.next_question_id ) ).toEqual( [ null, 'c' ] );
	} );
} );

describe( 'normalizeQuiz', () => {
	it( 'fills in every part, so each input has a value of its own type', () => {
		const quiz = normalizeQuiz( {
			id: '7',
			name: 'Locks',
			status: 'published',
			lang: '',
			questions: [ { id: 'q', text: 'What?', options: [ { id: 'a', label: 'A door', tags_matched: [ { field: 'categories', value: 'Doors' } ], ranges_matched: [ { field: 'price', min: '10', max: null } ] } ] } ],
		} );

		expect( quiz ).toEqual( {
			id: 7,
			name: 'Locks',
			status: 'published',
			lang: null,
			questions: [ {
				id: 'q',
				text: 'What?',
				image: '',
				options: [ {
					id: 'a',
					label: 'A door',
					next_question_id: null,
					tags_matched: [ { field: 'categories', value: 'Doors' } ],
					keywords: '',
					ranges_matched: [ { field: 'price', min: 10, max: null } ],
				} ],
			} ],
		} );
	} );

	it( 'turns anything but published into a draft', () => {
		expect( normalizeQuiz( { status: 'archived' } ).status ).toBe( 'draft' );
		expect( normalizeQuiz( undefined ).questions ).toEqual( [] );
	} );
} );

describe( 'graphForSave', () => {
	it( 'leaves out what is empty and a condition still being filled in', () => {
		const [ saved ] = graphForSave( [ {
			id: 'q',
			text: ' Who is it for? ',
			image: ' ',
			options: [ {
				id: 'a',
				label: 'A child ',
				next_question_id: null,
				tags_matched: [ { field: 'categories', value: ' Toys ' }, { field: 'brand', value: '' }, { field: '', value: 'x' } ],
				keywords: ' ',
				ranges_matched: [ { field: 'price', min: '', max: '50' }, { field: 'price', min: '', max: '' } ],
			} ],
		} ] );

		expect( saved ).toEqual( {
			id: 'q',
			text: 'Who is it for?',
			options: [ {
				id: 'a',
				label: 'A child',
				next_question_id: null,
				tags_matched: [ { field: 'categories', value: 'Toys' } ],
				ranges_matched: [ { field: 'price', min: null, max: 50 } ],
			} ],
		} );
	} );

	/** A value with a comma is one value: "Jacken, Mäntel & Strick" is a category. */
	it( 'keeps a value with a comma whole', () => {
		const options = graphForSave( [ { ...question( 'q', null ), options: [ { ...newOption( question( 'q' ) ), label: 'Men', tags_matched: [ { field: 'categories', value: 'Jacken, Mäntel & Strick' } ] } ] } ] )[ 0 ].options;

		expect( options[ 0 ].tags_matched ).toEqual( [ { field: 'categories', value: 'Jacken, Mäntel & Strick' } ] );
	} );
} );

describe( 'savedForm', () => {
	it( 'is the same for two quizzes that would store the same', () => {
		const quiz = normalizeQuiz( { name: 'Gifts', questions: [ question( 'q', null ) ] } );
		const withEmptyRow = { ...quiz, name: 'Gifts ', questions: [ { ...quiz.questions[ 0 ], options: [ { ...quiz.questions[ 0 ].options[ 0 ], tags_matched: [ { field: 'brand', value: '' } ] } ] } ] };

		expect( savedForm( withEmptyRow ) ).toBe( savedForm( quiz ) );
		expect( savedForm( { ...quiz, lang: 'de' } ) ).not.toBe( savedForm( quiz ) );
	} );
} );

describe( 'valueStatus', () => {
	const known = [ { value: 'Schwarz', count: 33 }, { value: 'Navy', count: 9 } ];

	it( 'says how many products have a value, or that a value is spelled in another case, or is no value of the site', () => {
		expect( valueStatus( 'Schwarz', known ) ).toEqual( { kind: 'known', count: 33 } );
		expect( valueStatus( 'schwarz', known ) ).toEqual( { kind: 'respell', value: 'Schwarz' } );
		expect( valueStatus( 'Pink', known ) ).toEqual( { kind: 'unknown' } );
	} );

	it( 'says nothing before the values have loaded, or for an empty value', () => {
		expect( valueStatus( 'Schwarz', undefined ) ).toEqual( { kind: 'unchecked' } );
		expect( valueStatus( '', known ) ).toEqual( { kind: 'unchecked' } );
	} );
} );

describe( 'endingCounts', () => {
	it( 'counts the endings, the dead ends and those on a field that is not a filter', () => {
		expect( endingCounts( [ { count: 3 }, { count: 0 }, { count: null }, { count: 0 } ] ) ).toEqual( { total: 4, empty: 2, unknown: 1 } );
	} );
} );
