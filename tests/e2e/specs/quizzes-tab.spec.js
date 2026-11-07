/**
 * The Product finder tab, where a shop makes and edits its quizzes without the
 * Searcio panel. Runs authenticated as admin and mocks the plugin's own
 * `/quizzes` proxy, so the list, the quiz, its endings and Searcio's answers
 * are deterministic; the proxy itself is the integration suite's
 * (`Quizzes_Endpoint_Test`).
 */

import { test, expect, setConnected, touchingInShell } from '../utils';

const TAB_URL = '/wp-admin/admin.php?page=searcio&tab=quizzes';
const SCREEN = '#searcio-root';
const LOADED = { timeout: 20000 };

const QUIZ = {
	id: 7,
	name: 'Gift finder',
	status: 'draft',
	lang: 'en',
	questions: [
		{
			id: 'for',
			text: 'Who is the gift for?',
			options: [
				{ id: 'for-1', label: 'A coffee lover', next_question_id: null, tags_matched: [ { field: 'categories', value: 'Coffee & Tea Makers' } ] },
			],
		},
	],
};

const FACETS = {
	categories: [ { value: 'Coffee & Tea Makers', count: 6 }, { value: 'Jackets, Coats & Knitwear', count: 3 } ],
	brand: [ { value: 'Brühwerk', count: 10 } ],
};

/**
 * The plugin's `/quizzes` routes, from a list that changes as the tab writes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          options
 * @param {Array}                           [options.quizzes]   The quizzes in the list.
 * @param {Array}                           [options.endings]   What `/quizzes/endings` answers.
 * @param {Object}                          [options.refusal]   A body to answer every write with, as a 422.
 * @return {Array} Every write: `{ method, path, body }`.
 */
async function mockQuizzes( page, { quizzes = [ QUIZ ], endings = [ { answers: [ { question: 'Who is the gift for?', answer: 'A coffee lover' } ], count: 6, unknown_fields: [] } ], refusal = null } = {} ) {
	const sent = [];
	const list = quizzes.map( ( quiz ) => ( { ...quiz } ) );
	const json = ( route, body, status = 200 ) => route.fulfill( { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( body ) } );

	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/searcio/v1/quizzes' ),
		( route ) => {
			const request = route.request();
			// apiFetch may tunnel a PUT or a DELETE as a POST.
			const method = request.headers()[ 'x-http-method-override' ] || request.method();
			const path = decodeURIComponent( request.url() ).replace( /^.*\/searcio\/v1/, '' ).replace( /[?&].*$/, '' );

			if ( 'GET' !== method ) {
				sent.push( { method, path, body: request.postDataJSON() } );
			}

			if ( refusal && 'GET' !== method ) {
				return json( route, refusal, 422 );
			}

			if ( '/quizzes/facet-values' === path ) {
				return json( route, { values: FACETS } );
			}

			if ( '/quizzes/endings' === path ) {
				return json( route, { endings, truncated: false } );
			}

			const id = Number( ( path.match( /^\/quizzes\/(\d+)$/ ) || [] )[ 1 ] );

			if ( '/quizzes' === path && 'POST' === method ) {
				const quiz = { id: 8, status: 'draft', questions: [], ...request.postDataJSON().quiz };

				list.push( quiz );

				return json( route, quiz, 201 );
			}

			if ( id && 'PUT' === method ) {
				const at = list.findIndex( ( quiz ) => quiz.id === id );

				list[ at ] = { ...list[ at ], ...request.postDataJSON().quiz };

				return json( route, list[ at ] );
			}

			if ( id && 'DELETE' === method ) {
				list.splice( list.findIndex( ( quiz ) => quiz.id === id ), 1 );

				return json( route, { deleted: true } );
			}

			if ( id ) {
				return json( route, list.find( ( quiz ) => quiz.id === id ) || {}, list.some( ( quiz ) => quiz.id === id ) ? 200 : 404 );
			}

			return json( route, {
				items: list.map( ( quiz ) => ( { ...quiz, question_count: ( quiz.questions || [] ).length, updated_at: '2026-11-07T10:00:00+00:00' } ) ),
				total: list.length,
				limit: 50,
			} );
		}
	);

	// The site's languages, as the Indexing tab's catalogue reports them.
	await page.route(
		( url ) => decodeURIComponent( url.href ).includes( '/indexing/config' ),
		( route ) => json( route, { post_types: [], sources: [], languages: { active: true, available: [ { code: 'de', name: 'Deutsch' }, { code: 'en', name: 'English' } ] } } )
	);

	return sent;
}

test.describe( 'Product finder tab', () => {
	test.beforeAll( () => {
		setConnected( true );
	} );

	test.afterAll( () => {
		setConnected( false );
	} );

	test( 'lists the quizzes and opens one in the editor', async ( { page } ) => {
		await mockQuizzes( page );
		await page.goto( TAB_URL );

		const screen = page.locator( SCREEN );
		await expect( screen.getByRole( 'button', { name: 'Gift finder' } ) ).toBeVisible( LOADED );
		await expect( screen.getByText( '1 of 50 quizzes' ) ).toBeVisible();

		await screen.getByRole( 'button', { name: 'Gift finder' } ).click();

		// The quiz, each question and the endings are sections down the side.
		const sections = screen.getByRole( 'tablist', { name: 'Quiz sections' } );
		await expect( sections.getByRole( 'tab' ) ).toHaveCount( 3, LOADED );
		await expect( sections.getByRole( 'tab', { name: /Who is the gift for\?/ } ) ).toBeVisible();
		expect( new URL( page.url() ).searchParams.get( 'quiz' ) ).toBe( '7' );
		expect( await touchingInShell( page ) ).toEqual( [] );
	} );

	test( 'adds a quiz with its language and opens it', async ( { page } ) => {
		const sent = await mockQuizzes( page, { quizzes: [] } );
		await page.goto( TAB_URL );

		const screen = page.locator( SCREEN );
		await expect( screen.getByText( 'No quizzes yet' ) ).toBeVisible( LOADED );
		await screen.getByRole( 'button', { name: 'Add a quiz' } ).first().click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a quiz' } );
		await dialog.getByLabel( 'Name' ).fill( 'Shoe finder' );
		await dialog.getByRole( 'combobox', { name: 'Language' } ).click();
		await page.getByRole( 'option', { name: 'English (en)' } ).click();
		await dialog.getByRole( 'button', { name: 'Add the quiz' } ).click();

		await expect.poll( () => sent.find( ( write ) => '/quizzes' === write.path )?.body ).toEqual( { quiz: { name: 'Shoe finder', lang: 'en' } } );
		await expect( screen.getByRole( 'tablist', { name: 'Quiz sections' } ) ).toBeVisible( LOADED );
		expect( new URL( page.url() ).searchParams.get( 'quiz' ) ).toBe( '8' );
	} );

	test( 'saves an edited answer, with a value that holds a comma kept whole', async ( { page } ) => {
		const sent = await mockQuizzes( page );
		await page.goto( `${ TAB_URL }&quiz=7&section=question-for` );

		const screen = page.locator( SCREEN );
		const save = screen.getByRole( 'button', { name: 'Save changes' } );
		await expect( save ).toBeDisabled( LOADED );

		await screen.getByRole( 'button', { name: 'Add an answer' } ).click();
		const answer = screen.locator( '.whsc-quiz-answer' ).nth( 1 );
		await answer.getByLabel( 'Answer', { exact: true } ).fill( 'Someone who is always cold' );
		await answer.getByRole( 'button', { name: 'Add a filter' } ).click();
		await answer.getByLabel( 'Value' ).fill( 'Jackets, Coats & Knitwear' );
		await expect( answer.getByText( '3 products have this value.' ) ).toBeVisible();

		await save.click();
		await expect( page.locator( '.components-snackbar', { hasText: 'Quiz saved.' } ) ).toBeVisible();
		await expect( save ).toBeDisabled();

		const options = sent.find( ( write ) => '/quizzes/7' === write.path ).body.quiz.questions[ 0 ].options;
		expect( options[ 1 ] ).toEqual( {
			id: 'answer-2',
			label: 'Someone who is always cold',
			next_question_id: null,
			tags_matched: [ { field: 'categories', value: 'Jackets, Coats & Knitwear' } ],
		} );
	} );

	/**
	 * A question's picture comes from the Media Library. Its frame is
	 * WordPress's own; what is pinned is what the editor does with the picture
	 * picked in it, so the frame here hands one over at once.
	 */
	test( "picks a question's picture in the Media Library and saves its large size", async ( { page } ) => {
		const sent = await mockQuizzes( page );
		await page.goto( `${ TAB_URL }&quiz=7&section=question-for` );

		const screen = page.locator( SCREEN );
		await expect( screen.getByRole( 'button', { name: 'Choose a picture' } ) ).toBeVisible( LOADED );
		await page.evaluate( () => {
			window.wp.media = () => {
				const handlers = {};
				const attachment = { url: 'https://example.test/full.jpg', sizes: { large: { url: 'https://example.test/large.jpg' } } };
				const frame = {
					on: ( event, handler ) => {
						handlers[ event ] = handler;

						return frame;
					},
					open: () => handlers.select?.(),
					state: () => ( { get: () => ( { first: () => ( { toJSON: () => attachment } ) } ) } ),
				};

				return frame;
			};
		} );

		await screen.getByRole( 'button', { name: 'Choose a picture' } ).click();
		await expect( screen.getByRole( 'img', { name: "The question's picture" } ) ).toHaveAttribute( 'src', 'https://example.test/large.jpg' );
		await expect( screen.getByRole( 'button', { name: 'Replace' } ) ).toBeVisible();

		await screen.getByRole( 'button', { name: 'Save changes' } ).click();
		await expect.poll( () => sent.find( ( write ) => '/quizzes/7' === write.path )?.body?.quiz?.questions?.[ 0 ]?.image ).toBe( 'https://example.test/large.jpg' );
	} );

	test( 'asks before publishing a quiz with an ending that shows no products', async ( { page } ) => {
		const sent = await mockQuizzes( page, { endings: [ { answers: [ { question: 'Who is the gift for?', answer: 'A coffee lover' } ], count: 0, unknown_fields: [] } ] } );
		await page.goto( `${ TAB_URL }&quiz=7` );

		const screen = page.locator( SCREEN );
		await screen.getByRole( 'button', { name: 'Publish', exact: true } ).click( LOADED );

		const dialog = page.getByRole( 'dialog', { name: 'Publish with endings that show no products?' } );
		await expect( dialog ).toBeVisible();
		expect( sent.some( ( write ) => '/quizzes/7' === write.path ) ).toBe( false );

		await dialog.getByRole( 'button', { name: 'Publish anyway' } ).click();
		await expect.poll( () => sent.find( ( write ) => '/quizzes/7' === write.path )?.body?.quiz?.status ).toBe( 'published' );
		await expect( screen.getByRole( 'button', { name: 'Make a draft' } ) ).toBeVisible();
	} );

	test( 'shows each reason Searcio gave when a save is refused', async ( { page } ) => {
		await mockQuizzes( page, {
			refusal: {
				message: 'The quiz could not be saved.',
				errors: { questions: [ 'Question "Who is the gift for?" has an answer without a label.', 'A quiz can have at most 30 questions.' ] },
			},
		} );
		await page.goto( `${ TAB_URL }&quiz=7` );

		const screen = page.locator( SCREEN );
		await screen.getByLabel( 'Name' ).fill( 'Gift finder 2' );
		await screen.getByRole( 'button', { name: 'Save changes' } ).click();

		await expect( screen.getByText( 'Question "Who is the gift for?" has an answer without a label.' ) ).toBeVisible();
		await expect( screen.getByText( 'A quiz can have at most 30 questions.' ) ).toBeVisible();
	} );

	test( 'asks before leaving a quiz with unsaved changes', async ( { page } ) => {
		await mockQuizzes( page );
		await page.goto( `${ TAB_URL }&quiz=7` );

		const screen = page.locator( SCREEN );
		await screen.getByLabel( 'Name' ).fill( 'Gift finder, renamed', LOADED );
		await screen.getByRole( 'button', { name: 'All quizzes' } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Leave without saving?' } );
		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Leave without saving' } ).click();
		await expect( screen.getByRole( 'button', { name: 'Gift finder' } ) ).toBeVisible( LOADED );
	} );
} );
