import { registerBlockType } from '@wordpress/blocks';

import metadata from '../../../blocks/search/block.json';
import Edit from './edit';

registerBlockType( metadata.name, {
	edit: Edit,
	save: () => null,
} );
