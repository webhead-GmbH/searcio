import { Button } from '@wordpress/components';
import { InputControl, Stack, Text } from '@wordpress/ui';
import { __, sprintf } from '@wordpress/i18n';

import { Grid } from '../../../../components/Layout';
import { MAX_OPTIONS, newOption } from '../../quizEditor';
import AnswerEditor from './AnswerEditor';

/**
 * One question of the quiz, the content of its section: the question shoppers
 * read, an optional picture, and its answers, each a card of its own.
 *
 * @param {Object}        props
 * @param {Object}        props.question
 * @param {number}        props.index       Its place in the quiz.
 * @param {Array<Object>} props.questions   Every question, for each answer's "Then".
 * @param {Object}        props.facetValues `{ field: [{ value, count }] }`, or null while loading.
 * @param {string}        props.listPrefix  The id prefix of the value lists.
 * @param {Function}      props.onChange    Called with the changed question.
 * @param {Function}      props.onRemove
 * @param {boolean}       props.canRemove   A quiz keeps at least one question.
 */
const QuestionEditor = ( { question, index, questions, facetValues, listPrefix, onChange, onRemove, canRemove } ) => {
	const setOption = ( at, option ) => onChange( { ...question, options: question.options.map( ( item, i ) => ( i === at ? option : item ) ) } );

	return (
		<Stack direction="column" gap="lg">
			<section className="whsc-quiz-section">
				<Stack direction="row" gap="md" justify="space-between" align="center" wrap="wrap">
					<Text render={ <h3 /> } variant="heading-md" className="whsc-quiz-section__title">
						{ sprintf(
							/* translators: %d: the question's position in the quiz. */
							__( 'Question %d', 'searcio' ),
							index + 1
						) }
					</Text>
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						variant="tertiary"
						isDestructive
						disabled={ ! canRemove }
						description={ canRemove ? undefined : __( 'A quiz has at least one question.', 'searcio' ) }
						showTooltip={ ! canRemove }
						onClick={ onRemove }
					>
						{ __( 'Remove question', 'searcio' ) }
					</Button>
				</Stack>
				<Grid auto={ 280 } gap="var(--wpds-dimension-gap-md)" align="start">
					<InputControl
						label={ __( 'Question', 'searcio' ) }
						placeholder={ __( 'e.g. Who is the gift for?', 'searcio' ) }
						value={ question.text }
						onValueChange={ ( text ) => onChange( { ...question, text } ) }
					/>
					<InputControl
						type="url"
						label={ __( 'Picture (optional)', 'searcio' ) }
						description={ __( 'The address of a picture shown above the question, starting with https://.', 'searcio' ) }
						value={ question.image }
						onValueChange={ ( image ) => onChange( { ...question, image } ) }
					/>
				</Grid>
			</section>

			{ question.options.map( ( option, at ) => (
				<AnswerEditor
					key={ option.id || at }
					option={ option }
					index={ at }
					question={ question }
					questions={ questions }
					facetValues={ facetValues }
					listPrefix={ listPrefix }
					onChange={ ( changed ) => setOption( at, changed ) }
					onRemove={ () => onChange( { ...question, options: question.options.filter( ( _, i ) => i !== at ) } ) }
				/>
			) ) }

			<Stack direction="row" gap="sm">
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					variant="secondary"
					disabled={ question.options.length >= MAX_OPTIONS }
					description={ question.options.length >= MAX_OPTIONS
						? sprintf(
							/* translators: %d: the most answers a question can have. */
							__( 'A question has at most %d answers.', 'searcio' ),
							MAX_OPTIONS
						)
						: undefined }
					showTooltip={ question.options.length >= MAX_OPTIONS }
					onClick={ () => onChange( { ...question, options: [ ...question.options, newOption( question ) ] } ) }
				>
					{ __( 'Add an answer', 'searcio' ) }
				</Button>
			</Stack>
		</Stack>
	);
};

export default QuestionEditor;
