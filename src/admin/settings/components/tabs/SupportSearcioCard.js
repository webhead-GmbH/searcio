import { ToggleControl } from '@wordpress/components';
import { Card, Text } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

const KEY = 'support_searcio';

/**
 * Support Searcio: the Searcio logo, small in the bottom corner of the search
 * window and linked to searcio.com.
 *
 * Its own card rather than a field of the schema-driven grid, so it reads as
 * the shop's choice to credit Searcio, which it is on every plan: off until the
 * shop turns it on. The value is a setting like the others on this tab and is
 * saved with them.
 *
 * @param {Object}   props
 * @param {Object}   props.settings      The settings being edited.
 * @param {Function} props.updateSetting Changes one of them.
 */
const SupportSearcioCard = ( { settings, updateSetting } ) => {
	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h2 /> }>
						{ __( 'Support Searcio', 'searcio' ) }
					</Card.Title>
					<Text render={ <p /> } variant="body-sm">
						{ __(
							'Shows the Searcio logo, small in the bottom corner of the search window, linked to searcio.com.',
							'searcio'
						) }
					</Text>
				</div>
				{ /* A switch is the answer to the question its title asks, so it sits on
				   that row, as it does on the card beside this one. The title and the
				   sentence say what it does; the switch keeps its name for a screen reader. */ }
				<div className="whsc-settings-card-switch">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show the Searcio logo in the search window', 'searcio' ) }
						hideLabelFromVision
						checked={ true === settings?.[ KEY ] }
						onChange={ ( value ) => updateSetting( KEY, value ) }
					/>
				</div>
			</Card.Header>
		</Card.Root>
	);
};

export default SupportSearcioCard;
