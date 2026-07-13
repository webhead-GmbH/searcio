import {useState} from '@wordpress/element';
import {Button, Modal} from '@wordpress/components';
import {Text} from '@wordpress/ui';
import {__} from '@wordpress/i18n';
import {info} from '@wordpress/icons';

/**
 * Short explanation lives in the info icon's built-in tooltip; the full
 * account-creation-vs-linking behavior (long enough to need paragraphs) lives
 * behind "Learn more" in a modal instead of cramming it into the tooltip.
 *
 * @param {Object} props
 * @param {{termsUrl: string, privacyUrl: string, dpaUrl: string}} props.legal Live-or-fallback legal links, owned by the parent Connection tab.
 */
const ConnectionExplainer = ({legal}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			<Button
				icon={info}
				variant="tertiary"
				size="small"
				label={__(
					'Creates a new Search Cloud account for this email, or connects this site to an existing one.',
					'webhead-search-cloud'
				)}
				showTooltip
				className="webhead-search-cloud-connection-explainer-trigger"
			/>
			<Button
				variant="link"
				onClick={() => setIsModalOpen(true)}
			>
				{__('Learn more', 'webhead-search-cloud')}
			</Button>

			{isModalOpen && (
				<Modal
					title={__('How connecting to Search Cloud works', 'webhead-search-cloud')}
					onRequestClose={() => setIsModalOpen(false)}
					className="webhead-search-cloud-connection-explainer-modal"
				>
					<Text render={<p/>} variant="body-md">
						{__(
							'Clicking Connect sends the email address shown below (or the one you enter under "Use a different email") to Search Cloud, along with this site\'s address.',
							'webhead-search-cloud'
						)}
					</Text>
					<Text render={<p/>} variant="body-md">
						{__(
							'If that email has no Search Cloud account yet, one is created automatically and this site is connected right away - no further steps.',
							'webhead-search-cloud'
						)}
					</Text>
					<Text render={<p/>} variant="body-md">
						{__(
							'If that email already has a Search Cloud account, nothing is created or changed yet. Search Cloud emails a confirmation link to that address; once its owner clicks it, they choose which account to connect this site to. Come back here afterwards and paste the resulting keys into "Advanced: manual key entry" below.',
							'webhead-search-cloud'
						)}
					</Text>
					<Text render={<p/>} variant="body-md">
						{__(
							'Accepting the Terms of Service and Privacy Policy is required to continue. Accepting the Data Processing Agreement is optional.',
							'webhead-search-cloud'
						)}
					</Text>
					{(legal.termsUrl || legal.privacyUrl || legal.dpaUrl) && (
						<Text render={<p/>} variant="body-sm">
							{legal.termsUrl && (
								<a href={legal.termsUrl} target="_blank" rel="noreferrer">
									{__('Terms of Service', 'webhead-search-cloud')}
								</a>
							)}
							{legal.privacyUrl && (
								<>
									{legal.termsUrl && ' · '}
									<a href={legal.privacyUrl} target="_blank" rel="noreferrer">
										{__('Privacy Policy', 'webhead-search-cloud')}
									</a>
								</>
							)}
							{legal.dpaUrl && (
								<>
									{(legal.termsUrl || legal.privacyUrl) && ' · '}
									<a href={legal.dpaUrl} target="_blank" rel="noreferrer">
										{__('Data Processing Agreement', 'webhead-search-cloud')}
									</a>
								</>
							)}
						</Text>
					)}
				</Modal>
			)}
		</>
	);
};

export default ConnectionExplainer;
