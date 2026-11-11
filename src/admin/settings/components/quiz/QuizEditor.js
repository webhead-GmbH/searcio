import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { Badge, InputControl, Notice, SelectControl, Skeleton, Stack, Text } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';
import { chevronLeft } from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';
import apiFetch from '@wordpress/api-fetch';

import Modal from '../../../../components/Modal';
import SectionList from '../../../../components/SectionList';
import { Grid } from '../../../../components/Layout';
import { showToast } from '../../../../toast';
import { useAnnounce } from '../../../../utils/announce';
import { selectProps } from '../../../../utils/select';
import { MAX_QUESTIONS, endingCounts, graphForSave, newQuestion, normalizeQuiz, removeQuestion, savedForm } from '../../quizEditor';
import QuestionEditor from './QuestionEditor';
import QuizEndings from './QuizEndings';
import { QUIZZES_PATH, languageName, questionTitle, quizErrorMessage, quizErrors, statusLabel } from './quizApi';
import { forget, readOnce } from '../../remote';

const LIST_PREFIX = 'whsc-quiz-values';
const NO_ENDINGS = { endings: null, truncated: false, isChecking: false, error: '', checkedForm: '' };

const sectionOf = ( question ) => `question-${ question.id }`;

/**
 * One quiz, edited as the Searcio panel's quiz builder edits it: the quiz's
 * name and language, each question in a section of its own, and every way
 * through it with the products it ends on. Changes are kept until "Save
 * changes"; publishing saves them too, after a check of the endings.
 *
 * @param {Object}        props
 * @param {number}        props.id        The quiz.
 * @param {Array<Object>} props.languages The site's languages, `{ code, name }`.
 * @param {Function}      props.onClose   Back to the list.
 */
const QuizEditor = ( { id, languages, onClose } ) => {
	const [ quiz, setQuiz ] = useState( null );
	const [ saved, setSaved ] = useState( '' );
	const [ facetValues, setFacetValues ] = useState( null );
	const [ loadError, setLoadError ] = useState( '' );
	const [ attempt, setAttempt ] = useState( 0 );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ saveErrors, setSaveErrors ] = useState( [] );
	const [ endings, setEndings ] = useState( NO_ENDINGS );
	const [ confirmPublish, setConfirmPublish ] = useState( false );
	const [ confirmLeave, setConfirmLeave ] = useState( false );
	// SectionList reads its section from the address when it mounts; a new
	// question is opened by writing it there and mounting the list again.
	const [ listKey, setListKey ] = useState( 0 );

	const current = quiz ? savedForm( quiz ) : '';
	const isDirty = null !== quiz && current !== saved;

	useAnnounce( loadError, 'assertive' );
	useAnnounce( saveErrors.join( ' ' ), 'assertive' );

	useEffect( () => {
		let cancelled = false;

		setLoadError( '' );
		Promise.all( [
			apiFetch( { path: `${ QUIZZES_PATH }/${ id }` } ),
			// The values are a help for typing a filter; the editor works without them.
			readOnce( { path: `${ QUIZZES_PATH }/facet-values` } ).catch( () => ( { values: {} } ) ),
		] )
			.then( ( [ raw, facets ] ) => {
				if ( cancelled ) {
					return;
				}

				const loaded = normalizeQuiz( raw );

				// A quiz always has a question to fill in.
				if ( 0 === loaded.questions.length ) {
					loaded.questions = [ newQuestion( [] ) ];
				}

				setQuiz( loaded );
				setSaved( savedForm( normalizeQuiz( raw ) ) );
				setFacetValues( facets?.values && 'object' === typeof facets.values && ! Array.isArray( facets.values ) ? facets.values : {} );
			} )
			.catch( ( error ) => {
				if ( ! cancelled ) {
					setLoadError( quizErrorMessage( error ) );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ id, attempt ] );

	// Leaving the page with changes asks first, as the settings screen does.
	useEffect( () => {
		if ( ! isDirty ) {
			return undefined;
		}

		const warn = ( event ) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener( 'beforeunload', warn );

		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ isDirty ] );

	const jumpTo = ( section ) => {
		window.history.replaceState( {}, '', addQueryArgs( window.location.href, { section } ) );
		setListKey( ( key ) => key + 1 );
	};

	const setQuestions = ( questions ) => setQuiz( ( value ) => ( { ...value, questions } ) );

	const addQuestion = () => {
		const question = newQuestion( quiz.questions );

		setQuestions( [ ...quiz.questions, question ] );
		jumpTo( sectionOf( question ) );
	};

	const checkEndings = async () => {
		const form = savedForm( quiz );

		setEndings( ( value ) => ( { ...value, isChecking: true, error: '' } ) );

		try {
			const response = await apiFetch( {
				path: `${ QUIZZES_PATH }/endings`,
				method: 'POST',
				// A quiz in one language finds that language's products.
				data: { quiz: { lang: quiz.lang, questions: graphForSave( quiz.questions ) } },
			} );
			const list = Array.isArray( response?.endings ) ? response.endings : [];

			setEndings( { endings: list, truncated: Boolean( response?.truncated ), isChecking: false, error: '', checkedForm: form } );

			return endingCounts( list );
		} catch ( error ) {
			setEndings( ( value ) => ( { ...value, isChecking: false, error: quizErrorMessage( error ) } ) );

			return null;
		}
	};

	/**
	 * @param {string} [status] `published` or `draft` to change it with the save.
	 */
	const save = async ( status ) => {
		setIsSaving( true );
		setSaveErrors( [] );

		try {
			const response = await apiFetch( {
				path: `${ QUIZZES_PATH }/${ id }`,
				method: 'PUT',
				data: { quiz: { name: quiz.name.trim(), lang: quiz.lang, questions: graphForSave( quiz.questions ), ...( status ? { status } : {} ) } },
			} );

			forget( `${ QUIZZES_PATH }?` );
			const next = normalizeQuiz( response );

			setQuiz( next );
			setSaved( savedForm( next ) );

			if ( 'published' === status ) {
				showToast( __( 'The quiz is in the product finder.', 'searcio' ), 'success' );
			} else if ( 'draft' === status ) {
				showToast( __( 'The quiz is a draft again.', 'searcio' ), 'success' );
			} else {
				showToast( __( 'Quiz saved.', 'searcio' ), 'success' );
			}
		} catch ( error ) {
			setSaveErrors( quizErrors( error ) );
		} finally {
			setIsSaving( false );
		}
	};

	// A dead end is allowed but sends shoppers nowhere, so publishing one is
	// asked about; a field that is not a filter Searcio refuses itself.
	const publish = async () => {
		const counts = await checkEndings();

		if ( counts && counts.empty > 0 ) {
			setConfirmPublish( true );

			return;
		}

		await save( 'published' );
	};

	const leave = useCallback( () => ( isDirty ? setConfirmLeave( true ) : onClose() ), [ isDirty, onClose ] );
	const closeConfirmPublish = useCallback( () => setConfirmPublish( false ), [] );
	const closeConfirmLeave = useCallback( () => setConfirmLeave( false ), [] );

	const languageItems = useMemo( () => [
		{ value: null, label: __( 'Every language', 'searcio' ) },
		...languages.map( ( language ) => ( { value: language.code, label: `${ language.name } (${ language.code })` } ) ),
	], [ languages ] );

	if ( '' !== loadError ) {
		return (
			<Stack direction="column" gap="md">
				<Stack direction="row" gap="sm">
					<Button __next40pxDefaultSize variant="tertiary" icon={ chevronLeft } onClick={ onClose }>
						{ __( 'All quizzes', 'searcio' ) }
					</Button>
				</Stack>
				<Notice.Root intent="error">
					<Notice.Title>{ __( 'The quiz could not be loaded.', 'searcio' ) }</Notice.Title>
					<Notice.Description>{ loadError }</Notice.Description>
					<Notice.Actions>
						<Notice.ActionButton onClick={ () => setAttempt( ( value ) => value + 1 ) }>
							{ __( 'Try again', 'searcio' ) }
						</Notice.ActionButton>
					</Notice.Actions>
				</Notice.Root>
			</Stack>
		);
	}

	if ( null === quiz ) {
		return (
			<div className="whsc-quiz-editor__loading" role="status" aria-busy="true" aria-label={ __( 'Loading the quiz', 'searcio' ) }>
				<Stack direction="column" gap="lg">
					<Skeleton className="whsc-quiz-editor__skeleton-bar" />
					<Skeleton className="whsc-quiz-editor__skeleton-body" />
				</Stack>
			</div>
		);
	}

	const fields = Object.keys( facetValues || {} );
	const counts = endings.endings ? endingCounts( endings.endings ) : null;
	const stale = null !== counts && endings.checkedForm !== current;
	const saveDescription = ! isSaving && ! isDirty ? __( 'No unsaved changes.', 'searcio' ) : undefined;
	const isPublished = 'published' === quiz.status;

	const sections = [
		{
			id: 'quiz',
			label: __( 'Quiz', 'searcio' ),
			summary: [
				statusLabel( quiz.status ),
				languages.length > 1 ? languageName( quiz.lang, languages ) : '',
				sprintf(
					/* translators: %d: number of questions. */
					_n( '%d question', '%d questions', quiz.questions.length, 'searcio' ),
					quiz.questions.length
				),
			],
			content: (
				<section className="whsc-quiz-section">
					<Stack direction="column" gap="xs">
						<Text render={ <h3 /> } variant="heading-md" className="whsc-quiz-section__title">{ __( 'Quiz', 'searcio' ) }</Text>
						<Text render={ <p /> } variant="body-sm" className="whsc-quiz-section__description">
							{ isPublished
								? __( 'Published: shoppers can take it in the product finder.', 'searcio' )
								: __( 'A draft: shoppers do not see it until it is published.', 'searcio' ) }
						</Text>
					</Stack>
					<Grid auto={ 280 } gap="var(--wpds-dimension-gap-md)" align="start">
						<InputControl
							label={ __( 'Name', 'searcio' ) }
							description={ __( 'Shoppers see it when a site has more than one quiz to choose from.', 'searcio' ) }
							value={ quiz.name }
							onValueChange={ ( name ) => setQuiz( ( value ) => ( { ...value, name } ) ) }
						/>
						{ languages.length > 1 && (
							<SelectControl
								label={ __( 'Language', 'searcio' ) }
								description={ __( 'The quiz is offered only on pages in this language.', 'searcio' ) }
								{ ...selectProps( languageItems, quiz.lang, ( lang ) => setQuiz( ( value ) => ( { ...value, lang } ) ) ) }
							/>
						) }
					</Grid>
				</section>
			),
		},
		...quiz.questions.map( ( question, index ) => ( {
			id: sectionOf( question ),
			label: questionTitle( question, index ),
			summary: [
				0 === question.options.length
					? __( 'No answers yet', 'searcio' )
					: sprintf(
						/* translators: %d: number of answers. */
						_n( '%d answer', '%d answers', question.options.length, 'searcio' ),
						question.options.length
					),
			],
			content: (
				<QuestionEditor
					question={ question }
					index={ index }
					questions={ quiz.questions }
					facetValues={ facetValues }
					listPrefix={ LIST_PREFIX }
					canRemove={ quiz.questions.length > 1 }
					onChange={ ( changed ) => setQuestions( quiz.questions.map( ( item, i ) => ( i === index ? changed : item ) ) ) }
					onRemove={ () => {
						setQuestions( removeQuestion( quiz.questions, index ) );
						jumpTo( 'quiz' );
					} }
				/>
			),
		} ) ),
		{
			id: 'endings',
			label: __( 'Where the quiz ends', 'searcio' ),
			summary: [
				null === counts ? __( 'Not checked yet', 'searcio' ) : sprintf(
					/* translators: %d: number of endings. */
					_n( '%d ending', '%d endings', counts.total, 'searcio' ),
					counts.total
				),
				null !== counts && counts.empty + counts.unknown > 0
					? sprintf(
						/* translators: %d: number of endings that show no products. */
						_n( '%d without products', '%d without products', counts.empty + counts.unknown, 'searcio' ),
						counts.empty + counts.unknown
					)
					: '',
				stale ? __( 'Changed since the check', 'searcio' ) : '',
			],
			content: <QuizEndings state={ { ...endings, stale } } onCheck={ checkEndings } />,
		},
	];

	return (
		<Stack direction="column" gap="lg" className="whsc-quiz-editor">
			<Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap" className="whsc-quiz-editor__bar">
				<Stack direction="row" gap="sm" align="center" wrap="wrap">
					<Button __next40pxDefaultSize variant="tertiary" icon={ chevronLeft } onClick={ leave }>
						{ __( 'All quizzes', 'searcio' ) }
					</Button>
					<Text render={ <h3 /> } variant="heading-lg" className="whsc-quiz-editor__title">
						{ quiz.name.trim() || __( '(no name)', 'searcio' ) }
					</Text>
					<Badge intent={ isPublished ? 'stable' : 'draft' }>{ statusLabel( quiz.status ) }</Badge>
				</Stack>
				<Stack direction="row" gap="sm" align="center" wrap="wrap">
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						variant="secondary"
						disabled={ quiz.questions.length >= MAX_QUESTIONS }
						description={ quiz.questions.length >= MAX_QUESTIONS
							? sprintf(
								/* translators: %d: the most questions a quiz can have. */
								__( 'A quiz has at most %d questions.', 'searcio' ),
								MAX_QUESTIONS
							)
							: undefined }
						showTooltip={ quiz.questions.length >= MAX_QUESTIONS }
						onClick={ addQuestion }
					>
						{ __( 'Add a question', 'searcio' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						variant={ isPublished ? 'primary' : 'secondary' }
						isBusy={ isSaving }
						disabled={ isSaving || ! isDirty }
						description={ saveDescription }
						showTooltip={ !! saveDescription }
						onClick={ () => save() }
					>
						{ isSaving ? __( 'Saving…', 'searcio' ) : __( 'Save changes', 'searcio' ) }
					</Button>
					{ isPublished ? (
						<Button __next40pxDefaultSize variant="tertiary" disabled={ isSaving } onClick={ () => save( 'draft' ) }>
							{ __( 'Make a draft', 'searcio' ) }
						</Button>
					) : (
						<Button __next40pxDefaultSize variant="primary" disabled={ isSaving || endings.isChecking } onClick={ publish }>
							{ __( 'Publish', 'searcio' ) }
						</Button>
					) }
				</Stack>
			</Stack>

			{ saveErrors.length > 0 && (
				<Notice.Root intent="error">
					<Notice.Title>{ __( 'The quiz could not be saved.', 'searcio' ) }</Notice.Title>
					<Notice.Description>
						{ 1 === saveErrors.length ? saveErrors[ 0 ] : (
							<ul className="whsc-quiz-editor__reasons">
								{ saveErrors.map( ( reason, index ) => <li key={ index }>{ reason }</li> ) }
							</ul>
						) }
					</Notice.Description>
					<Notice.CloseIconButton onClick={ () => setSaveErrors( [] ) } />
				</Notice.Root>
			) }

			<SectionList key={ listKey } label={ __( 'Quiz sections', 'searcio' ) } sections={ sections } />

			{ /* The values of each filter, offered while a value is typed. */ }
			{ fields.map( ( field, index ) => (
				<datalist key={ field } id={ `${ LIST_PREFIX }-${ index }` }>
					{ ( facetValues[ field ] || [] ).map( ( entry ) => <option key={ entry.value } value={ entry.value } /> ) }
				</datalist>
			) ) }

			<Modal
				isOpen={ confirmPublish }
				onClose={ closeConfirmPublish }
				title={ __( 'Publish with endings that show no products?', 'searcio' ) }
				size="small"
				actions={ [
					{
						label: __( 'Review the endings', 'searcio' ),
						variant: 'tertiary',
						onClick: () => jumpTo( 'endings' ),
					},
					{
						label: __( 'Publish anyway', 'searcio' ),
						variant: 'primary',
						onClick: () => save( 'published' ),
					},
				] }
			>
				<Text>
					{ sprintf(
						/* translators: %d: number of endings that show no products. */
						_n(
							'%d way through the quiz ends on no products, and a shopper who takes it sees nothing.',
							'%d ways through the quiz end on no products, and a shopper who takes one sees nothing.',
							counts?.empty || 0,
							'searcio'
						),
						counts?.empty || 0
					) }
				</Text>
			</Modal>

			{ /* Leaving drops the changes for good, so it is asked in a dialog
			     that only its own buttons close. */ }
			<Modal
				isOpen={ confirmLeave }
				onClose={ closeConfirmLeave }
				title={ __( 'Leave without saving?', 'searcio' ) }
				size="small"
				showCloseButton={ false }
				closeOnEscape={ false }
				closeOnBackdropClick={ false }
				actions={ [
					{ label: __( 'Keep editing', 'searcio' ), variant: 'tertiary' },
					{ label: __( 'Leave without saving', 'searcio' ), variant: 'primary', isDestructive: true, onClick: onClose },
				] }
			>
				<Text>{ __( 'The changes to this quiz since it was last saved are lost.', 'searcio' ) }</Text>
			</Modal>
		</Stack>
	);
};

export default QuizEditor;
