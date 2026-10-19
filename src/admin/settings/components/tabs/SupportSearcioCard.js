import { Button, ToggleControl } from '@wordpress/components';
import { Card, Stack, Text } from '@wordpress/ui';
import { __ } from '@wordpress/i18n';

import { usePlan } from '../../plan';

const KEY = 'support_searcio';

/**
 * Support Searcio: the searcio logo, small in the bottom corner of the search
 * window and linked to searcio.com.
 *
 * Its own card rather than a field of the schema-driven grid, because it
 * depends on the plan: a Free plan always shows the logo, so there the switch
 * is on and cannot be turned off, and the card says why. The value is a setting
 * like the others on this tab and is saved with them.
 *
 * @param {Object}   props
 * @param {Object}   props.settings      The settings being edited.
 * @param {Function} props.updateSetting Changes one of them.
 */
const SupportSearcioCard = ( { settings, updateSetting } ) => {
	const plan = usePlan();
	const isFree = true === plan?.is_free;

	return (
		<Card.Root className="whsc-settings-card whsc-card whsc-card--dotted">
			<Card.Header className="whsc-settings-card-header">
				<div className="whsc-settings-card-copy">
					<Card.Title render={ <h2 /> }>
						{ __( 'Support Searcio', 'searcio' ) }
					</Card.Title>
					<Text render={ <p /> } variant="body-sm">
						{ __(
							'Shows the searcio logo, small in the bottom corner of the search window, linked to searcio.com.',
							'searcio'
						) }
					</Text>
				</div>
			</Card.Header>
			<Card.Content className="whsc-settings-card-content">
				<Stack direction="column" gap="md">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show the searcio logo in the search window', 'searcio' ) }
						help={ isFree
							? __( 'The Free plan always shows it. On a paid plan you can turn it off.', 'searcio' )
							: undefined }
						checked={ isFree || false !== settings?.[ KEY ] }
						disabled={ isFree }
						onChange={ ( value ) => updateSetting( KEY, value ) }
					/>
					{ isFree && plan?.upgrade_url && (
						<Stack direction="row" gap="sm" wrap="wrap">
							<Button
								__next40pxDefaultSize
								variant="secondary"
								href={ plan.upgrade_url }
								target="_blank"
								rel="noopener noreferrer"
							>
								{ __( 'Upgrade plan', 'searcio' ) }
							</Button>
						</Stack>
					) }
				</Stack>
			</Card.Content>
		</Card.Root>
	);
};

export default SupportSearcioCard;
