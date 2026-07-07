import ContentLoader from 'react-content-loader';

// Mirrors the real screen's stacked collapsible rows, per the front-end
// guideline to use react-content-loader for known layouts instead of a spinner.
const IndexingSkeleton = () => (
	<ContentLoader
		width="100%"
		height={ 360 }
		role="presentation"
		aria-hidden="true"
		className="webhead-search-cloud-indexing-skeleton"
	>
		<rect x="0" y="0" rx="6" ry="6" width="320" height="22" />
		<rect x="0" y="40" rx="6" ry="6" width="80%" height="14" />
		<rect x="0" y="80" rx="10" ry="10" width="100%" height="56" />
		<rect x="0" y="148" rx="10" ry="10" width="100%" height="56" />
		<rect x="0" y="216" rx="10" ry="10" width="100%" height="56" />
		<rect x="0" y="284" rx="10" ry="10" width="100%" height="56" />
	</ContentLoader>
);

export default IndexingSkeleton;
