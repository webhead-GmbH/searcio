/**
 * The guided quiz. The whole question graph arrives in one `/quizzes` response,
 * so the walk happens in the browser and the network is only touched again for
 * the filtered `/search` the answers add up to — which is the thing worth
 * pinning here: that the accumulated answers actually reach the query.
 */

import {
	test,
	expect,
	SearchWidget,
	mockSearchCloud,
	configureSearchKey,
	createBlockPost,
	postHit,
} from '../utils';

test.use( { storageState: { cookies: [], origins: [] } } );

const QUIZ = {
	id: 4,
	name: 'Find your fit',
	questions: [
		{
			id: 'style',
			text: "What's your style?",
			options: [
				{ id: 'casual', label: 'Casual', next_question_id: 'size', tags_matched: [ { field: 'style', value: 'casual' } ] },
				{ id: 'formal', label: 'Formal', next_question_id: 'size', tags_matched: [ { field: 'style', value: 'formal' } ] },
			],
		},
		{
			id: 'size',
			text: 'What size?',
			options: [
				{ id: 'm', label: 'Medium', next_question_id: null, tags_matched: [ { field: 'size', value: 'm' } ] },
				{ id: 'l', label: 'Large', next_question_id: null, tags_matched: [ { field: 'size', value: 'l' } ] },
			],
		},
	],
};

test.describe( 'guided quiz', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await configureSearchKey( requestUtils );
	} );

	test( 'has no tab when the site publishes no quiz', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { quiz: false } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();

		await expect( page.locator( '.whsc-modal-tabs' ) ).toHaveCount( 0 );
	} );

	/**
	 * The capability only says "at least one quiz is published". If the list
	 * comes back empty anyway, the tab is a door onto nothing.
	 */
	test( 'takes its own tab away when the quiz list turns out to be empty', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { quiz: true, quizzes: [] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );

		await expect( widget.modal.getByRole( 'tab', { name: /product finder/i } ) ).toHaveCount( 0 );
		await expect( widget.input ).toBeVisible();
	} );

	test( 'walks the questions and searches with every answer', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, {
			quiz: true,
			quizzes: [ QUIZ ],
			onSearch: ( url ) => searches.push( url ),
			hits: [ postHit( { title: 'Casual Medium Tee', type: 'product' }, 'q-1' ) ],
		} );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );

		await expect( widget.quizQuestion ).toHaveText( "What's your style?" );
		await widget.answerQuiz( 'Casual' );

		await expect( widget.quizQuestion ).toHaveText( 'What size?' );
		await widget.answerQuiz( 'Medium' );

		await expect( widget.quizCards ).toHaveCount( 1 );

		const final = searches[ searches.length - 1 ];
		expect( final.searchParams.get( 'filter[style]' ) ).toBe( 'casual' );
		expect( final.searchParams.get( 'filter[size]' ) ).toBe( 'm' );
	} );

	test( 'shows what was answered so a thin result set is explainable', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { quiz: true, quizzes: [ QUIZ ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );
		await widget.answerQuiz( 'Formal' );
		await widget.answerQuiz( 'Large' );

		await expect( widget.quizAnswers ).toHaveCount( 2 );
		await expect( widget.quizAnswers.first() ).toContainText( 'formal' );
	} );

	test( 'lets a visitor go back and change an answer', async ( { page, requestUtils } ) => {
		const searches = [];

		await mockSearchCloud( page, { quiz: true, quizzes: [ QUIZ ], onSearch: ( url ) => searches.push( url ) } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );
		await widget.answerQuiz( 'Casual' );
		await widget.answerQuiz( 'Medium' );
		await expect( widget.quizCards.first() ).toBeVisible();

		// Back to the size question, then pick the other one.
		await widget.modal.locator( '.whsc-quiz__back' ).first().click();
		await expect( widget.quizQuestion ).toHaveText( 'What size?' );
		await widget.answerQuiz( 'Large' );
		await expect( widget.quizCards.first() ).toBeVisible();

		const final = searches[ searches.length - 1 ];
		expect( final.searchParams.get( 'filter[size]' ) ).toBe( 'l' );
		expect( final.searchParams.get( 'filter[style]' ) ).toBe( 'casual' );
	} );

	/**
	 * The graph is already in memory after the first response; re-fetching it
	 * per question would be a wasted round trip on every answer.
	 */
	test( 'fetches the question graph once, not per question', async ( { page, requestUtils } ) => {
		let fetches = 0;

		page.on( 'request', ( request ) => {
			if ( request.url().includes( '/quizzes' ) ) {
				fetches++;
			}
		} );

		await mockSearchCloud( page, { quiz: true, quizzes: [ QUIZ ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );
		await widget.answerQuiz( 'Casual' );
		await widget.answerQuiz( 'Medium' );
		await expect( widget.quizCards.first() ).toBeVisible();

		expect( fetches ).toBe( 1 );
	} );

	test( 'keeps the answers when the visitor looks something up in Search and comes back', async ( { page, requestUtils } ) => {
		await mockSearchCloud( page, { quiz: true, quizzes: [ QUIZ ] } );
		await page.goto( await createBlockPost( requestUtils, { mode: 'icon' } ) );

		const widget = new SearchWidget( page );
		await widget.openModal();
		await widget.openTab( /product finder/i );
		await widget.answerQuiz( 'Casual' );
		await expect( widget.quizQuestion ).toHaveText( 'What size?' );

		await widget.openTab( 'Search' );
		await expect( widget.input ).toBeVisible();

		await widget.openTab( /product finder/i );
		await expect( widget.quizQuestion ).toHaveText( 'What size?' );
	} );
} );
