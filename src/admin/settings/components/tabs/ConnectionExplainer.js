import {useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {Text} from '@wordpress/ui';
import {__} from '@wordpress/i18n';

import Modal from '../../../../components/Modal';

/**
 * A small inline "Learn more" link that sits inside the connection hint
 * sentence and opens the full account-creation-vs-linking explanation
 * (long enough to need paragraphs) in a modal.
 *
 * @param {Object} props
 * @param {{termsUrl: string, privacyUrl: string, dpaUrl: string}} props.legal Live-or-fallback legal links, owned by the parent Connection tab.
 */
const ConnectionExplainer = ({legal}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			<Button
				variant="link"
				className="webhead-search-cloud-connection-explainer-link"
				onClick={() => setIsModalOpen(true)}
			>
				{__('Learn more', 'webhead-search-cloud')}
			</Button>

			<Modal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={__('How connecting to Search Cloud works', 'webhead-search-cloud')}
				size="medium"
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
		</>
	);
};

export default ConnectionExplainer;
