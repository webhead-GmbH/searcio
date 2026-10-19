import { __ } from '@wordpress/i18n';
import { Skeleton, Stack } from '@wordpress/ui';

/**
 * Loading placeholder for the Sync tab. Mirrors the dashboard layout (intro,
 * control buttons, history table) so the screen does not jump when the status
 * arrives.
 */
const SyncSkeleton = () => (
	<div
		className="whsc-skeleton"
		role="status"
		aria-busy="true"
		aria-label={ __( 'Loading the sync status', 'searcio' ) }
	>
		<Stack direction="column" gap="lg">
			<Stack direction="column" gap="sm">
				<Skeleton className="whsc-skeleton__title" />
				<Skeleton className="whsc-skeleton__line" />
			</Stack>
			<Stack direction="row" gap="sm">
				<Skeleton className="whsc-skeleton__button" />
				<Skeleton className="whsc-skeleton__button" />
			</Stack>
			<Skeleton className="whsc-skeleton__table" />
		</Stack>
	</div>
);

export default SyncSkeleton;
