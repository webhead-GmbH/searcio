import { useCallback, useEffect, useState } from '@wordpress/element';
import { Stack } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import { addQueryArgs, removeQueryArgs } from '@wordpress/url';
import apiFetch from '@wordpress/api-fetch';

import TabIntro from '../TabIntro';
import QuizList from '../quiz/QuizList';
import QuizEditor from '../quiz/QuizEditor';
import NewQuizModal from '../quiz/NewQuizModal';
import { INDEXING_CONFIG_PATH } from '../quiz/quizApi';

const QUIZ_PARAMETER = 'quiz';

const quizInAddress = () => Number( new URLSearchParams( window.location.search ).get( QUIZ_PARAMETER ) ) || 0;

/**
 * The Product finder tab: the site's quizzes, and the editor of one of them.
 * Searcio holds the quizzes, and the Searcio panel edits the same ones. The
 * quiz being edited is in the address (`quiz=`), so a reload or a copied link
 * opens it again.
 */
const QuizzesTab = () => {
	const [ quizId, setQuizId ] = useState( quizInAddress );
	const [ isAdding, setIsAdding ] = useState( false );
	const [ languages, setLanguages ] = useState( [] );
	const [ reload, setReload ] = useState( 0 );

	// The site's languages, as the Search Config tab lists them; none on a
	// single-language site, which then has no language to choose.
	useEffect( () => {
		apiFetch( { path: INDEXING_CONFIG_PATH } )
			.then( ( catalog ) => setLanguages( catalog?.languages?.active && Array.isArray( catalog.languages.available ) ? catalog.languages.available : [] ) )
			.catch( () => setLanguages( [] ) );
	}, [] );

	// The editor's sections are its own; the list has none.
	useEffect( () => () => {
		window.history.replaceState( {}, '', removeQueryArgs( window.location.href, QUIZ_PARAMETER ) );
	}, [] );

	const open = useCallback( ( id ) => {
		const address = id
			? addQueryArgs( removeQueryArgs( window.location.href, 'section' ), { [ QUIZ_PARAMETER ]: id } )
			: removeQueryArgs( window.location.href, QUIZ_PARAMETER, 'section' );

		window.history.replaceState( {}, '', address );
		setQuizId( id );

		if ( ! id ) {
			setReload( ( value ) => value + 1 );
		}
	}, [] );

	const closeAdding = useCallback( () => setIsAdding( false ), [] );

	return (
		<Stack direction="column" gap="lg" className="searcio-quizzes-tab">
			<TabIntro
				title={ __( 'Product finder', 'searcio' ) }
				description={ __(
					'Quizzes ask shoppers a few questions and show the products that fit their answers, in the search window\'s Product finder tab. They are the same quizzes as in the Searcio panel.',
					'searcio'
				) }
			/>

			{ quizId ? (
				<QuizEditor key={ quizId } id={ quizId } languages={ languages } onClose={ () => open( 0 ) } />
			) : (
				<QuizList languages={ languages } onOpen={ open } onCreate={ () => setIsAdding( true ) } reload={ reload } />
			) }

			<NewQuizModal
				isOpen={ isAdding }
				onClose={ closeAdding }
				languages={ languages }
				onCreated={ ( id ) => {
					setIsAdding( false );
					open( id );
				} }
			/>
		</Stack>
	);
};

export default QuizzesTab;
