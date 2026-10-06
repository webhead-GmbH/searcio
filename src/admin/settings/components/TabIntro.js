import { Stack, Text } from '@wordpress/ui';

/**
 * What a tab is for, at the top of its panel: the section's heading under the
 * page title, and a sentence or two. A tab is one region of the page, so it is
 * put straight into the shell and not into a card of its own; the cards below
 * this are the sections of the tab.
 */
const TabIntro = ( { title, description } ) => (
	<Stack direction="column" gap="xs" className="whsc-tab-intro">
		<Text render={ <h2 /> } variant="heading-lg" className="whsc-tab-intro__title">
			{ title }
		</Text>
		{ description ? (
			<Text render={ <p /> } variant="body-md" className="whsc-tab-intro__description">
				{ description }
			</Text>
		) : null }
	</Stack>
);

export default TabIntro;
