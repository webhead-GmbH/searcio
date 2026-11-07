/**
 * What the Product finder tab's screens share: the REST paths, the names of a
 * status and a language, and how a refusal from Searcio reads.
 */
import { __, sprintf } from '@wordpress/i18n';

const pluginData = window.searcioData || {};

export const QUIZZES_PATH = pluginData?.api?.quizzesPath || '/searcio/v1/quizzes';
export const INDEXING_CONFIG_PATH = pluginData?.api?.indexingConfigPath || '/searcio/v1/indexing/config';

/**
 * @param {string} status `draft` or `published`.
 * @return {string} Its name.
 */
export const statusLabel = ( status ) => ( 'published' === status ? __( 'Published', 'searcio' ) : __( 'Draft', 'searcio' ) );

/**
 * @param {?string}       code
 * @param {Array<Object>} languages The site's languages, `{ code, name }`.
 * @return {string} The language's name, or "Every language" for none.
 */
export const languageName = ( code, languages ) => {
	if ( ! code ) {
		return __( 'Every language', 'searcio' );
	}

	return languages.find( ( language ) => language.code === code )?.name || code;
};

/**
 * What Searcio or the REST route said, as sentences to show: the reasons a
 * quiz was refused (`errors.questions`, `errors.quiz`, one sentence each), or
 * the message.
 *
 * @param {Object} error What `apiFetch` rejected with.
 * @return {Array<string>} The sentences.
 */
export const quizErrors = ( error ) => {
	const reasons = [ error?.errors?.questions, error?.errors?.quiz, error?.errors?.name ]
		.flatMap( ( list ) => ( Array.isArray( list ) ? list : [] ) )
		.filter( ( reason ) => 'string' === typeof reason && '' !== reason );

	if ( reasons.length > 0 ) {
		return reasons;
	}

	return [ 'string' === typeof error?.message && '' !== error.message ? error.message : __( 'The request to Searcio failed. Try again.', 'searcio' ) ];
};

/**
 * @param {Object} error What `apiFetch` rejected with.
 * @return {string} The sentences in one line.
 */
export const quizErrorMessage = ( error ) => quizErrors( error ).join( ' ' );

/**
 * @param {Object} question
 * @param {number} index
 * @return {string} The question's text, or its place for one without text.
 */
export const questionTitle = ( question, index ) =>
	question.text.trim() || sprintf(
		/* translators: %d: the question's position in the quiz. */
		__( 'Question %d', 'searcio' ),
		index + 1
	);
