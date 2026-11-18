import { Stack, Text } from '@wordpress/ui';

/**
 * A section with nothing beside it: the same title and sentence a card has,
 * straight on the panel. A card separates one region from another, and a box
 * round the only one says a second is coming that never does.
 *
 * @param {Object}                    props
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {string}                    [props.className] Added to the section's own class.
 * @param {import('react').ReactNode} props.children
 */
export default function PlainSection( { title, description, className = '', children } ) {
	return (
		<section className={ `whsc-placement-section ${ className }`.trim() }>
			<Stack direction="column" gap="xs" className="whsc-placement-section__header">
				<Text render={ <h3 /> } variant="heading-md" className="whsc-placement-section__title">
					{ title }
				</Text>
				{ description ? (
					<Text render={ <p /> } variant="body-sm" className="whsc-placement-section__description">
						{ description }
					</Text>
				) : null }
			</Stack>
			{ children }
		</section>
	);
}
