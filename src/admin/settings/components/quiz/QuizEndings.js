import { Button } from '@wordpress/components';
import { Badge, Notice, Stack, Text } from '@wordpress/ui';
import { __, _n, sprintf } from '@wordpress/i18n';

import { formatNumber } from '../../../../utils/number';
import { endingCounts } from '../../quizEditor';

/**
 * How many products an ending shows, as a badge: none is a dead end for the
 * shopper and stands out; a field that is not a filter of the site cannot be
 * counted, and the quiz cannot be published with it.
 *
 * @param {Object} props
 * @param {Object} props.ending
 */
const EndingCount = ( { ending } ) => {
	if ( null === ending.count ) {
		return <Badge intent="high">{ __( 'Not a filter', 'searcio' ) }</Badge>;
	}

	if ( 0 === ending.count ) {
		return <Badge intent="high">{ __( 'No products', 'searcio' ) }</Badge>;
	}

	return (
		<Badge intent="none">
			{ sprintf(
				/* translators: %s: number of products. */
				_n( '%s product', '%s products', ending.count, 'searcio' ),
				formatNumber( ending.count )
			) }
		</Badge>
	);
};

/**
 * Every way a shopper can go through the quiz, with the products it ends on,
 * counted by Searcio for the quiz as it is in the editor, saved or not.
 *
 * @param {Object}   props
 * @param {Object}   props.state   `{ endings, truncated, isChecking, error, stale }`.
 * @param {Function} props.onCheck
 */
const QuizEndings = ( { state, onCheck } ) => {
	const { endings, truncated, isChecking, error, stale } = state;
	const counts = endings ? endingCounts( endings ) : null;

	return (
		<section className="whsc-quiz-section">
			<Stack direction="column" gap="xs">
				<Text render={ <h3 /> } variant="heading-md" className="whsc-quiz-section__title">
					{ __( 'Where the quiz ends', 'searcio' ) }
				</Text>
				<Text render={ <p /> } variant="body-sm" className="whsc-quiz-section__description">
					{ __( 'Every way through the quiz and how many products it shows. Before publishing, change the answers of an ending that shows none.', 'searcio' ) }
				</Text>
			</Stack>

			<Stack direction="row" gap="sm">
				<Button __next40pxDefaultSize variant="secondary" isBusy={ isChecking } disabled={ isChecking } onClick={ onCheck }>
					{ isChecking ? __( 'Checking…', 'searcio' ) : __( 'Check the endings', 'searcio' ) }
				</Button>
			</Stack>

			{ error && (
				<Notice.Root intent="error">
					<Notice.Description>{ error }</Notice.Description>
				</Notice.Root>
			) }

			{ counts && stale && (
				<Notice.Root intent="info">
					<Notice.Description>{ __( 'The quiz has changed since this check.', 'searcio' ) }</Notice.Description>
				</Notice.Root>
			) }

			{ counts && (
				<Stack direction="column" gap="sm">
					<Text render={ <p /> } variant="body-md">
						{ sprintf(
							/* translators: 1: number of endings, 2: how many of them show no products. */
							_n( '%1$d ending, %2$d of them without products.', '%1$d endings, %2$d of them without products.', counts.total, 'searcio' ),
							counts.total,
							counts.empty + counts.unknown
						) }
					</Text>
					<ol className="whsc-quiz-endings">
						{ endings.map( ( ending, index ) => (
							<li key={ index } className="whsc-quiz-endings__item">
								<span className="whsc-quiz-endings__path">
									{ ( ending.answers || [] ).map( ( step ) => step.answer ).join( ' › ' ) || __( '(no answer)', 'searcio' ) }
								</span>
								<EndingCount ending={ ending } />
								{ ( ending.unknown_fields || [] ).length > 0 && (
									<Text variant="body-sm" className="whsc-quiz-endings__note">
										{ sprintf(
											/* translators: %s: names of fields, comma-separated. */
											__( 'Not a filter of this site: %s', 'searcio' ),
											ending.unknown_fields.join( ', ' )
										) }
									</Text>
								) }
							</li>
						) ) }
					</ol>
					{ truncated && (
						<Text render={ <p /> } variant="body-sm">{ __( 'Only the first endings are listed.', 'searcio' ) }</Text>
					) }
				</Stack>
			) }
		</section>
	);
};

export default QuizEndings;
