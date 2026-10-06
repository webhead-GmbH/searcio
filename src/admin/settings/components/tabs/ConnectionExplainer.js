import {useState} from '@wordpress/element';
import {Button} from '@wordpress/components';
import {Text} from '@wordpress/ui';
import {__} from '@wordpress/i18n';

import Modal from '../../../../components/Modal';
import LegalLinks from './LegalLinks';

/**
 * A link-styled button under the connect action that opens the full
 * account-creation-vs-linking explanation (long enough to need paragraphs) in
 * a modal.
 *
 * @param {Object} props
 * @param {{termsUrl: string, privacyUrl: string, dpaUrl: string}} props.legal Live-or-fallback legal links, owned by the parent Connection tab.
 */
const ConnectionExplainer = ({legal}) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const links = [
		{url: legal.termsUrl, label: __('Terms of Service', 'webhead-search-cloud')},
		{url: legal.privacyUrl, label: __('Privacy Policy', 'webhead-search-cloud')},
		{url: legal.dpaUrl, label: __('Data Processing Agreement', 'webhead-search-cloud')},
	];

	return (
		<>
			<Button
				variant="link"
				className="webhead-search-cloud-connection-explainer-link"
				onClick={() => setIsModalOpen(true)}
			>
				{__('How connecting works', 'webhead-search-cloud')}
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
				{links.some((link) => link.url) && (
					<Text render={<p/>} variant="body-sm">
						<LegalLinks links={links}/>
					</Text>
				)}
			</Modal>
		</>
	);
};

export default ConnectionExplainer;
