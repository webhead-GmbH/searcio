import { __ } from '@wordpress/i18n';
import { Skeleton } from '@wordpress/ui';

import { Grid } from '../../../components/Layout';

/**
 * The shape of what is coming: the same grid the settings cards are laid out
 * in, with a placeholder where each card will be.
 *
 * `Skeleton` is decorative, so the region around it is what says "loading":
 * one polite status with a name, and not a name on every block. It also stops
 * pulsing by itself when the visitor has asked their system for reduced motion.
 */
const SettingsSkeleton = () => (
	<div
		className="whsc-settings-skeleton"
		role="status"
		aria-busy="true"
		aria-label={ __( 'Loading settings', 'searcio' ) }
	>
		<Grid auto={ { base: 280, md: 320 } } gap="var(--wpds-dimension-gap-xl)" align="start">
			<Skeleton className="whsc-settings-skeleton__card" />
			<Skeleton className="whsc-settings-skeleton__card" />
		</Grid>
	</div>
);

export default SettingsSkeleton;
