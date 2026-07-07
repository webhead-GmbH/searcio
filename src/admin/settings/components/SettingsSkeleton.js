import ContentLoader from 'react-content-loader';

const SettingsSkeleton = () => (
	<ContentLoader
		width="100%"
		height={ 420 }
		role="presentation"
		aria-hidden="true"
		className="webhead-search-cloud-settings-skeleton"
	>
		<rect x="0" y="0" rx="20" ry="20" width="220" height="40" />
		<rect x="0" y="70" rx="18" ry="18" width="100%" height="300" />
	</ContentLoader>
);

export default SettingsSkeleton;
