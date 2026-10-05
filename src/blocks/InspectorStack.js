import { Children } from '@wordpress/element';
import { Stack } from '@wordpress/ui';

/**
 * The controls of an inspector panel, one under the other with the same space
 * between each.
 *
 * The block inspector spaces a control of `@wordpress/components` with a margin
 * under it, unless the control is the last child of its parent. A control of
 * `@wordpress/ui` carries no margin at all. Written one after the other in a
 * panel, the first kind come out 16px apart and the second kind touch what
 * follows them. Here each control gets a box of its own, in which it is the
 * last child and so has no margin, and the column's gap spaces them all alike.
 *
 * A fragment counts as one child: give what it holds a stack of its own.
 */
const InspectorStack = ( { children } ) => (
	<Stack direction="column" gap="lg">
		{ Children.toArray( children ).map( ( child ) => (
			<div key={ child.key }>{ child }</div>
		) ) }
	</Stack>
);

export default InspectorStack;
