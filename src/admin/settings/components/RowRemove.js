import { Button } from '@wordpress/components';
import { trash } from '@wordpress/icons';

import { PHONE, useMediaQuery } from '../../../utils/mediaQuery';

/**
 * The delete of a row that repeats (a field, a rule, a redirect). On a screen
 * with room it is a button as tall as the fields beside it. On a phone the row
 * is a group with its fields one under another, and the delete stands on the
 * line of the first field's label, at the end of it: a button as tall as a
 * field would reach down over that field, so it is the compact one there.
 *
 * @param {Object}   props
 * @param {string}   props.label   What the button removes, for assistive technology and the tooltip.
 * @param {Function} props.onClick
 */
export default function RowRemove( { label, onClick } ) {
	const phone = useMediaQuery( PHONE );

	return (
		<div className="whsc-row-remove">
			<Button
				size={ phone ? 'compact' : undefined }
				__next40pxDefaultSize={ ! phone }
				icon={ trash }
				isDestructive
				variant="tertiary"
				label={ label }
				onClick={ onClick }
			/>
		</div>
	);
}
