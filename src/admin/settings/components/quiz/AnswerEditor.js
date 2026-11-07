import { Button } from '@wordpress/components';
import { Card, Fieldset, InputControl, SelectControl, Stack, Text } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';
import { closeSmall, trash } from '@wordpress/icons';

import { Grid } from '../../../../components/Layout';
import { humanizeFieldLabel } from '../../../../utils/facets';
import { formatNumber } from '../../../../utils/number';
import { selectProps } from '../../../../utils/select';
import { valueStatus } from '../../quizEditor';
import { questionTitle } from './quizApi';

/**
 * What is said under a filter value: how many products have it, that it is a
 * value of the site spelled in another case (with a button, in `details`, to
 * take the site's spelling), or that no product has it.
 *
 * @param {Object}   status    From `valueStatus()`.
 * @param {Function} onRespell Called with the site's spelling.
 * @return {{description: (string|undefined), details: *}} The control's two props.
 */
const valueNote = ( status, onRespell ) => {
	if ( 'known' === status.kind ) {
		return {
			description: sprintf(
				/* translators: %s: number of products. */
				_n( '%s product has this value.', '%s products have this value.', status.count, 'searcio' ),
				formatNumber( status.count )
			),
		};
	}

	if ( 'respell' === status.kind ) {
		return {
			description: __( 'Filters match the case of a value.', 'searcio' ),
			details: (
				<Button variant="link" onClick={ () => onRespell( status.value ) }>
					{ sprintf(
						/* translators: %s: a value as the site spells it. */
						__( 'Use "%s"', 'searcio' ),
						status.value
					) }
				</Button>
			),
		};
	}

	return { description: 'unknown' === status.kind ? __( 'No product has this value.', 'searcio' ) : undefined };
};

/**
 * One answer of a question: its label, the question that follows it or the
 * products it ends on, and what it narrows the products to - a filter value,
 * words in the product name, a range such as a budget. Several conditions on
 * one answer all have to match.
 *
 * @param {Object}        props
 * @param {Object}        props.option      The answer.
 * @param {number}        props.index       Its place among the question's answers.
 * @param {Object}        props.question    The question it answers.
 * @param {Array<Object>} props.questions   Every question of the quiz, for "Then".
 * @param {Object}        props.facetValues `{ field: [{ value, count }] }`, or null while loading.
 * @param {string}        props.listPrefix  The id prefix of the value lists, one per field.
 * @param {Function}      props.onChange    Called with the changed answer.
 * @param {Function}      props.onRemove
 */
const AnswerEditor = ( { option, index, question, questions, facetValues, listPrefix, onChange, onRemove } ) => {
	const fields = Object.keys( facetValues || {} );
	const set = ( changes ) => onChange( { ...option, ...changes } );
	const setTag = ( at, tag ) => set( { tags_matched: option.tags_matched.map( ( item, i ) => ( i === at ? tag : item ) ) } );
	const setRange = ( at, range ) => set( { ranges_matched: option.ranges_matched.map( ( item, i ) => ( i === at ? range : item ) ) } );
	const fieldItems = fields.map( ( field ) => ( { value: field, label: humanizeFieldLabel( field ) } ) );
	// A range is on a number: the price, or a facet whose values are numbers.
	const rangeFields = fields.filter( ( field ) => 'price' === field || ( facetValues[ field ].length > 0 && facetValues[ field ].every( ( entry ) => Number.isFinite( Number( entry.value ) ) ) ) );
	const nextItems = [
		{ value: null, label: __( 'Show the products', 'searcio' ) },
		...questions
			.map( ( item, at ) => ( { item, at } ) )
			.filter( ( { item } ) => item.id !== question.id )
			.map( ( { item, at } ) => ( {
				value: item.id,
				label: sprintf(
					/* translators: %s: the text of the next question, or its place in the quiz. */
					__( 'Ask: %s', 'searcio' ),
					questionTitle( item, at )
				),
			} ) ),
	];
	const hasConditions = option.tags_matched.length > 0 || '' !== option.keywords || option.ranges_matched.length > 0;

	return (
		<Card.Root className="whsc-card whsc-card--dotted whsc-quiz-answer">
			<Card.Header className="whsc-card__header">
				<Stack direction="row" gap="md" justify="space-between" align="center">
					<Card.Title render={ <h4 /> }>
						{ option.label.trim() || sprintf(
							/* translators: %d: the answer's position in its question. */
							__( 'Answer %d', 'searcio' ),
							index + 1
						) }
					</Card.Title>
					<Button
						size="compact"
						icon={ trash }
						isDestructive
						variant="tertiary"
						label={ __( 'Remove answer', 'searcio' ) }
						onClick={ onRemove }
					/>
				</Stack>
			</Card.Header>
			<Card.Content className="whsc-card__content">
				<Stack direction="column" gap="lg">
					<Grid auto={ 240 } gap="var(--wpds-dimension-gap-md)" align="start">
						<InputControl
							label={ __( 'Answer', 'searcio' ) }
							value={ option.label }
							onValueChange={ ( label ) => set( { label } ) }
						/>
						<SelectControl
							label={ __( 'Then', 'searcio' ) }
							{ ...selectProps( nextItems, option.next_question_id, ( next ) => set( { next_question_id: next } ) ) }
						/>
					</Grid>

					<Fieldset.Root className="whsc-quiz-conditions">
						<Fieldset.Legend>{ __( 'Products this answer shows', 'searcio' ) }</Fieldset.Legend>
						<Stack direction="column" gap="md">
							<Text render={ <p /> } variant="body-sm" className="whsc-quiz-conditions__hint">
								{ hasConditions
									? __( 'A product has to match every condition of the answer.', 'searcio' )
									: __( 'Without a condition the answer narrows nothing.', 'searcio' ) }
							</Text>

							{ option.tags_matched.map( ( tag, at ) => (
								<Stack key={ `tag-${ at }` } direction="row" gap="sm" align="start" className="whsc-quiz-condition">
									<Grid auto={ 200 } gap="var(--wpds-dimension-gap-md)" align="start" className="whsc-quiz-condition__fields">
										<SelectControl
											label={ __( 'Filter', 'searcio' ) }
											{ ...selectProps( fieldItems, tag.field, ( field ) => setTag( at, { field: field || '', value: tag.value } ) ) }
										/>
										<InputControl
											label={ __( 'Value', 'searcio' ) }
											list={ tag.field ? `${ listPrefix }-${ fields.indexOf( tag.field ) }` : undefined }
											value={ tag.value }
											{ ...valueNote( valueStatus( tag.value, facetValues?.[ tag.field ] ), ( value ) => setTag( at, { ...tag, value } ) ) }
											onValueChange={ ( value ) => setTag( at, { ...tag, value } ) }
										/>
									</Grid>
									<Button
										className="whsc-quiz-condition__remove"
										icon={ closeSmall }
										variant="tertiary"
										label={ __( 'Remove the filter', 'searcio' ) }
										onClick={ () => set( { tags_matched: option.tags_matched.filter( ( _, i ) => i !== at ) } ) }
									/>
								</Stack>
							) ) }

							{ '' !== option.keywords || option.keywordsOpen ? (
								<Stack direction="row" gap="sm" align="start" className="whsc-quiz-condition">
									<InputControl
										className="whsc-quiz-condition__fields"
										label={ __( 'Name contains', 'searcio' ) }
										placeholder={ __( 'e.g. waterproof, rain jacket', 'searcio' ) }
										description={ __( 'Separate alternatives with commas: the product name needs one of them. A word also finds longer words that start with it.', 'searcio' ) }
										value={ option.keywords }
										onValueChange={ ( keywords ) => set( { keywords } ) }
									/>
									<Button
										className="whsc-quiz-condition__remove"
										icon={ closeSmall }
										variant="tertiary"
										label={ __( 'Remove the words', 'searcio' ) }
										onClick={ () => set( { keywords: '', keywordsOpen: false } ) }
									/>
								</Stack>
							) : null }

							{ option.ranges_matched.map( ( range, at ) => (
								<Stack key={ `range-${ at }` } direction="row" gap="sm" align="start" className="whsc-quiz-condition">
									<Grid auto={ 160 } gap="var(--wpds-dimension-gap-md)" align="start" className="whsc-quiz-condition__fields">
										<SelectControl
											label={ __( 'Range on', 'searcio' ) }
											{ ...selectProps(
												rangeFields.map( ( field ) => ( { value: field, label: humanizeFieldLabel( field ) } ) ),
												range.field,
												( field ) => setRange( at, { ...range, field: field || '' } )
											) }
										/>
										<InputControl
											type="number"
											label={ __( 'From', 'searcio' ) }
											value={ null === range.min ? '' : String( range.min ) }
											onValueChange={ ( min ) => setRange( at, { ...range, min: '' === min ? null : min } ) }
										/>
										<InputControl
											type="number"
											label={ __( 'To', 'searcio' ) }
											value={ null === range.max ? '' : String( range.max ) }
											onValueChange={ ( max ) => setRange( at, { ...range, max: '' === max ? null : max } ) }
										/>
									</Grid>
									<Button
										className="whsc-quiz-condition__remove"
										icon={ closeSmall }
										variant="tertiary"
										label={ __( 'Remove the range', 'searcio' ) }
										onClick={ () => set( { ranges_matched: option.ranges_matched.filter( ( _, i ) => i !== at ) } ) }
									/>
								</Stack>
							) ) }

							<Stack direction="row" gap="sm" wrap="wrap">
								<Button
									__next40pxDefaultSize
									variant="secondary"
									disabled={ 0 === fields.length }
									onClick={ () => set( { tags_matched: [ ...option.tags_matched, { field: fields[ 0 ] || '', value: '' } ] } ) }
								>
									{ __( 'Add a filter', 'searcio' ) }
								</Button>
								{ '' === option.keywords && ! option.keywordsOpen && (
									<Button __next40pxDefaultSize variant="secondary" onClick={ () => set( { keywordsOpen: true } ) }>
										{ __( 'Add name words', 'searcio' ) }
									</Button>
								) }
								<Button
									__next40pxDefaultSize
									variant="secondary"
									disabled={ 0 === rangeFields.length }
									onClick={ () => set( { ranges_matched: [ ...option.ranges_matched, { field: rangeFields[ 0 ] || '', min: null, max: null } ] } ) }
								>
									{ __( 'Add a range', 'searcio' ) }
								</Button>
							</Stack>
						</Stack>
					</Fieldset.Root>
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

export default AnswerEditor;
