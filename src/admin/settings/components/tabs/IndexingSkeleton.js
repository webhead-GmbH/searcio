import { __ } from '@wordpress/i18n';
import { Skeleton, Stack } from '@wordpress/ui';

/**
 * Mirrors the stacked rows of the Indexing and Search Config tabs: an intro,
 * then one placeholder per card. The region is what says "loading"; the blocks
 * in it are decorative.
 */
const IndexingSkeleton = ( { label = __( 'Loading the indexing configuration', 'webhead-search-cloud' ) } ) => (
	<div className="whsc-skeleton" role="status" aria-busy="true" aria-label={ label }>
		<Stack direction="column" gap="lg">
			<Stack direction="column" gap="sm">
				<Skeleton className="whsc-skeleton__title" />
				<Skeleton className="whsc-skeleton__line" />
			</Stack>
			<Skeleton className="whsc-skeleton__row" />
			<Skeleton className="whsc-skeleton__row" />
			<Skeleton className="whsc-skeleton__row" />
			<Skeleton className="whsc-skeleton__row" />
		</Stack>
	</div>
);

export default IndexingSkeleton;
