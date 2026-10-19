import { Fragment } from '@wordpress/element';
import { Link } from '@wordpress/ui';

/**
 * The legal documents a consent names, as links that open in a new tab. A
 * document Searcio has no address for is left out.
 *
 * @param {Object}                              props
 * @param {Array<{url: string, label: string}>} props.links
 */
const LegalLinks = ( { links } ) => {
	const known = links.filter( ( link ) => link.url );

	if ( 0 === known.length ) {
		return null;
	}

	return known.map( ( link, index ) => (
		<Fragment key={ link.url }>
			{ index > 0 && ' · ' }
			<Link href={ link.url } openInNewTab>
				{ link.label }
			</Link>
		</Fragment>
	) );
};

export default LegalLinks;
