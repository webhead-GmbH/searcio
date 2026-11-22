import { useEffect, useState } from '@wordpress/element';
import { InputControl, Notice, SelectControl, Stack } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

import Modal from '../../../../components/Modal';
import { useAnnounce } from '../../../../utils/announce';
import { selectProps } from '../../../../utils/select';
import { QUIZZES_PATH, quizErrorMessage } from './quizApi';
import { forget } from '../../remote';

/**
 * Names a new quiz, and on a multilingual site its language, and makes it in
 * Searcio as a draft with one empty question; the editor opens on it.
 *
 * @param {Object}        props
 * @param {boolean}       props.isOpen
 * @param {Function}      props.onClose
 * @param {Function}      props.onCreated Called with the new quiz's id.
 * @param {Array<Object>} props.languages The site's languages, `{ code, name }`.
 * @param {?string}       props.defaultLanguage The language the admin works in, which a new quiz starts in.
 *                                              "Every language" is a choice to make, not the start: a German
 *                                              quiz was shown on the English pages too.
 */
const NewQuizModal = ( { isOpen, onClose, onCreated, languages, defaultLanguage = null } ) => {
	const start = languages.some( ( language ) => language.code === defaultLanguage ) ? defaultLanguage : null;
	const [ name, setName ] = useState( '' );
	const [ lang, setLang ] = useState( start );
	const [ isCreating, setIsCreating ] = useState( false );
	const [ error, setError ] = useState( '' );

	useAnnounce( error, 'assertive' );

	useEffect( () => {
		if ( isOpen ) {
			setName( '' );
			setLang( start );
			setError( '' );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isOpen ] );

	const create = async () => {
		if ( '' === name.trim() ) {
			setError( __( 'Give the quiz a name, such as "Gift finder".', 'searcio' ) );

			return;
		}

		setIsCreating( true );
		setError( '' );

		try {
			const quiz = await apiFetch( { path: QUIZZES_PATH, method: 'POST', data: { quiz: { name: name.trim(), lang } } } );

			forget( `${ QUIZZES_PATH }?` );

			onCreated( Number( quiz?.id ) );
		} catch ( reason ) {
			setError( quizErrorMessage( reason ) );
		} finally {
			setIsCreating( false );
		}
	};

	const languageItems = [
		{ value: null, label: __( 'Every language', 'searcio' ) },
		...languages.map( ( language ) => ( { value: language.code, label: `${ language.name } (${ language.code })` } ) ),
	];

	return (
		<Modal
			isOpen={ isOpen }
			onClose={ onClose }
			title={ __( 'Add a quiz', 'searcio' ) }
			size="medium"
			actions={ [
				{ label: __( 'Cancel', 'searcio' ), variant: 'tertiary' },
				{
					label: isCreating ? __( 'Adding…', 'searcio' ) : __( 'Add the quiz', 'searcio' ),
					variant: 'primary',
					onClick: create,
					disabled: isCreating,
					closeOnClick: false,
				},
			] }
		>
			<form
				onSubmit={ ( event ) => {
					event.preventDefault();
					void create();
				} }
				// The form has no button of its own (the modal's are outside it),
				// so with the language select beside the name, Enter in the name
				// submitted nothing.
				onKeyDown={ ( event ) => {
					if ( 'Enter' === event.key && 'INPUT' === event.target?.tagName && ! event.nativeEvent?.isComposing && ! isCreating ) {
						event.preventDefault();
						void create();
					}
				} }
			>
				<Stack direction="column" gap="lg">
					<InputControl
						label={ __( 'Name', 'searcio' ) }
						description={ __( 'Shoppers see it when a site has more than one quiz to choose from.', 'searcio' ) }
						value={ name }
						onValueChange={ ( value ) => {
							setName( value );

							// "Give the quiz a name" stayed under the name typed since.
							if ( '' !== value.trim() ) {
								setError( '' );
							}
						} }
					/>
					{ languages.length > 1 && (
						<SelectControl
							label={ __( 'Language', 'searcio' ) }
							description={ __( 'The quiz is offered only on pages in this language.', 'searcio' ) }
							{ ...selectProps( languageItems, lang, setLang ) }
						/>
					) }
					{ '' !== error && (
						<Notice.Root intent="error">
							<Notice.Description>{ error }</Notice.Description>
						</Notice.Root>
					) }
				</Stack>
			</form>
		</Modal>
	);
};

export default NewQuizModal;
