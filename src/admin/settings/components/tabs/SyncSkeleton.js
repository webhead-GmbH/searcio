import ContentLoader from 'react-content-loader';

/**
 * Loading placeholder for the Sync tab. Mirrors the dashboard layout (heading,
 * status card, control buttons, history table) so the screen does not jump when
 * data arrives, per the front-end guideline to use react-content-loader instead
 * of a spinner.
 */
const SyncSkeleton = () => (
	<ContentLoader
		width="100%"
		height={ 380 }
		role="presentation"
		aria-hidden="true"
		className="webhead-search-cloud-sync-skeleton"
	>
		<rect x="0" y="0" rx="6" ry="6" width="260" height="22" />
		<rect x="0" y="40" rx="10" ry="10" width="100%" height="96" />
		<rect x="0" y="150" rx="6" ry="6" width="120" height="34" />
		<rect x="140" y="150" rx="6" ry="6" width="160" height="34" />
		<rect x="0" y="212" rx="6" ry="6" width="180" height="18" />
		<rect x="0" y="250" rx="8" ry="8" width="100%" height="120" />
	</ContentLoader>
);

export default SyncSkeleton;
