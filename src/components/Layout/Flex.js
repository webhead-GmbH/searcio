// Webhead scaffold managed file. scaffold:update may refresh this file.

import { forwardRef } from '@wordpress/element';

import { cx, setResponsiveVar } from './responsive';

const isPlainObject = ( value ) => (
	value !== null &&
	typeof value === 'object' &&
	! Array.isArray( value )
);

const formatWrap = ( value ) => {
	if ( value === undefined || value === null || value === '' ) {
		return undefined;
	}

	if ( typeof value === 'boolean' ) {
		return value ? 'wrap' : 'nowrap';
	}

	return String( value );
};

const resolveWrap = ( wrap, noWrap ) => {
	if ( noWrap === undefined ) {
		return wrap;
	}

	if ( isPlainObject( noWrap ) ) {
		return Object.fromEntries(
			Object.entries( noWrap ).map( ( [ breakpoint, value ] ) => [
				breakpoint,
				value ? 'nowrap' : 'wrap',
			] )
		);
	}

	return noWrap ? 'nowrap' : wrap;
};

const buildFlexStyle = ( props, style = {} ) => {
	const nextStyle = { ...style };
	const align = props.center ? 'center' : props.align;
	const justify = props.center ? 'center' : props.justify;

	setResponsiveVar( nextStyle, 'wh-flex-direction', props.direction );
	setResponsiveVar( nextStyle, 'wh-flex-wrap', props.wrap, formatWrap );
	setResponsiveVar( nextStyle, 'wh-flex-gap', props.gap );
	setResponsiveVar( nextStyle, 'wh-flex-row-gap', props.rowGap );
	setResponsiveVar( nextStyle, 'wh-flex-column-gap', props.columnGap );
	setResponsiveVar( nextStyle, 'wh-flex-align-items', align );
	setResponsiveVar( nextStyle, 'wh-flex-justify-content', justify );
	setResponsiveVar( nextStyle, 'wh-flex-align-content', props.content );

	return nextStyle;
};

const buildFlexItemStyle = ( props, style = {} ) => {
	const nextStyle = { ...style };

	setResponsiveVar( nextStyle, 'wh-flex-item-grow', props.grow, String );
	setResponsiveVar( nextStyle, 'wh-flex-item-shrink', props.shrink, String );
	setResponsiveVar( nextStyle, 'wh-flex-item-basis', props.basis );
	setResponsiveVar( nextStyle, 'wh-flex-item-order', props.order, String );
	setResponsiveVar( nextStyle, 'wh-flex-item-align-self', props.alignSelf );
	setResponsiveVar( nextStyle, 'wh-flex-item-width', props.width );
	setResponsiveVar( nextStyle, 'wh-flex-item-min-width', props.minWidth );
	setResponsiveVar( nextStyle, 'wh-flex-item-max-width', props.maxWidth );

	return nextStyle;
};

const FlexItem = forwardRef( function FlexItem(
	{
		as: Component = 'div',
		children,
		className,
		grow,
		shrink,
		basis,
		order,
		alignSelf,
		width,
		minWidth,
		maxWidth,
		style,
		...props
	},
	ref
) {
	return (
		<Component
			ref={ ref }
			className={ cx( 'webhead-layout-flex__item', className ) }
			style={ buildFlexItemStyle( { grow, shrink, basis, order, alignSelf, width, minWidth, maxWidth }, style ) }
			{ ...props }
		>
			{ children }
		</Component>
	);
} );

const FlexBlock = forwardRef( function FlexBlock(
	{
		grow = 1,
		shrink = 1,
		basis = 0,
		minWidth = 0,
		...props
	},
	ref
) {
	return (
		<FlexItem
			ref={ ref }
			grow={ grow }
			shrink={ shrink }
			basis={ basis }
			minWidth={ minWidth }
			{ ...props }
		/>
	);
} );

const Flex = forwardRef( function Flex(
	{
		as: Component = 'div',
		children,
		className,
		direction = 'row',
		wrap = 'wrap',
		noWrap,
		gap,
		rowGap,
		columnGap,
		align,
		justify,
		content,
		center = false,
		inline = false,
		isInline = false,
		fullWidth = false,
		expanded = false,
		style,
		...props
	},
	ref
) {
	const resolvedWrap = resolveWrap( wrap, noWrap );
	const isExpanded = fullWidth || expanded;

	return (
		<Component
			ref={ ref }
			className={ cx( 'webhead-layout-flex', className ) }
			data-inline={ inline || isInline ? 'true' : undefined }
			data-full-width={ isExpanded ? 'true' : undefined }
			style={ buildFlexStyle( { direction, wrap: resolvedWrap, gap, rowGap, columnGap, align, justify, content, center }, style ) }
			{ ...props }
		>
			{ children }
		</Component>
	);
} );

Flex.Item = FlexItem;
Flex.Block = FlexBlock;

export { Flex, FlexBlock, FlexItem };
