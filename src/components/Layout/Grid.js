// Webhead scaffold managed file. scaffold:update may refresh this file.

import { forwardRef } from '@wordpress/element';

import { cx, setResponsiveVar, toCssValue } from './responsive';

const formatColumns = ( value ) => {
	if ( value === undefined || value === null || value === '' ) {
		return undefined;
	}

	if ( typeof value === 'number' ) {
		return `repeat(${ Math.max( 1, value ) }, minmax(0, 1fr))`;
	}

	if ( Array.isArray( value ) ) {
		return value.join( ' ' );
	}

	return String( value );
};

const formatAreas = ( value ) => {
	if ( value === undefined || value === null || value === '' ) {
		return undefined;
	}

	if ( Array.isArray( value ) ) {
		return value.map( ( row ) => `"${ row }"` ).join( ' ' );
	}

	return String( value );
};

const isPlainObject = ( value ) => (
	value !== null &&
	typeof value === 'object' &&
	! Array.isArray( value )
);

const formatAutoTemplate = ( mode ) => ( value ) => {
	const width = toCssValue( value );

	return width ? `repeat(${ mode }, minmax(min(100%, ${ width }), 1fr))` : undefined;
};

const resolveAutoFlow = ( autoFlow, dense ) => {
	if ( ! dense ) {
		return autoFlow;
	}

	if ( isPlainObject( autoFlow ) ) {
		return Object.fromEntries(
			Object.entries( autoFlow ).map( ( [ breakpoint, value ] ) => [
				breakpoint,
				`${ value || 'row' } dense`,
			] )
		);
	}

	return `${ autoFlow || 'row' } dense`;
};

const buildGridStyle = ( props, style = {} ) => {
	const nextStyle = { ...style };
	const repeatMode = props.fill || props.autoFill ? 'auto-fill' : 'auto-fit';
	const autoWidth = props.auto ?? props.minColumnWidth;
	const templateColumns = props.templateColumns ?? props.columns;
	const templateRows = props.templateRows ?? props.rows;
	const alignItems = props.alignItems ?? props.align;
	const justifyContent = props.justifyContent ?? props.justify;

	if ( templateColumns !== undefined ) {
		setResponsiveVar( nextStyle, 'wh-grid-template-columns', templateColumns, formatColumns );
	} else {
		setResponsiveVar( nextStyle, 'wh-grid-template-columns', autoWidth, formatAutoTemplate( repeatMode ) );
	}

	setResponsiveVar( nextStyle, 'wh-grid-template-rows', templateRows, formatColumns );
	setResponsiveVar( nextStyle, 'wh-grid-gap', props.gap );
	setResponsiveVar( nextStyle, 'wh-grid-row-gap', props.rowGap );
	setResponsiveVar( nextStyle, 'wh-grid-column-gap', props.columnGap );
	setResponsiveVar( nextStyle, 'wh-grid-auto-rows', props.autoRows );
	setResponsiveVar( nextStyle, 'wh-grid-auto-columns', props.autoColumns );
	setResponsiveVar( nextStyle, 'wh-grid-auto-flow', props.autoFlow );
	setResponsiveVar( nextStyle, 'wh-grid-align-items', alignItems );
	setResponsiveVar( nextStyle, 'wh-grid-justify-items', props.justifyItems );
	setResponsiveVar( nextStyle, 'wh-grid-align-content', props.alignContent );
	setResponsiveVar( nextStyle, 'wh-grid-justify-content', justifyContent );
	setResponsiveVar( nextStyle, 'wh-grid-place-items', props.placeItems );
	setResponsiveVar( nextStyle, 'wh-grid-place-content', props.placeContent );
	setResponsiveVar( nextStyle, 'wh-grid-template-areas', props.areas, formatAreas );

	return nextStyle;
};

const buildGridItemStyle = ( props, style = {} ) => {
	const nextStyle = { ...style };

	setResponsiveVar( nextStyle, 'wh-grid-item-column', props.column );
	setResponsiveVar( nextStyle, 'wh-grid-item-row', props.row );
	setResponsiveVar( nextStyle, 'wh-grid-item-area', props.area );
	setResponsiveVar( nextStyle, 'wh-grid-item-order', props.order, String );
	setResponsiveVar( nextStyle, 'wh-grid-item-align-self', props.alignSelf );
	setResponsiveVar( nextStyle, 'wh-grid-item-justify-self', props.justifySelf );
	setResponsiveVar( nextStyle, 'wh-grid-item-place-self', props.placeSelf );

	return nextStyle;
};

const GridItem = forwardRef( function GridItem(
	{
		as: Component = 'div',
		children,
		className,
		column,
		row,
		area,
		order,
		alignSelf,
		justifySelf,
		placeSelf,
		style,
		...props
	},
	ref
) {
	return (
		<Component
			ref={ ref }
			className={ cx( 'webhead-layout-grid__item', className ) }
			style={ buildGridItemStyle( { column, row, area, order, alignSelf, justifySelf, placeSelf }, style ) }
			{ ...props }
		>
			{ children }
		</Component>
	);
} );

const Grid = forwardRef( function Grid(
	{
		as: Component = 'div',
		children,
		className,
		columns,
		templateColumns,
		rows,
		templateRows,
		auto,
		minColumnWidth,
		autoFill = false,
		fill = false,
		gap,
		rowGap,
		columnGap,
		autoRows,
		autoColumns,
		autoFlow,
		dense = false,
		align,
		alignItems,
		justifyItems,
		alignContent,
		justify,
		justifyContent,
		placeItems,
		placeContent,
		areas,
		inline = false,
		isInline = false,
		style,
		...props
	},
	ref
) {
	const resolvedAutoFlow = resolveAutoFlow( autoFlow, dense );

	return (
		<Component
			ref={ ref }
			className={ cx( 'webhead-layout-grid', className ) }
			data-inline={ inline || isInline ? 'true' : undefined }
			style={ buildGridStyle( {
				columns,
				templateColumns,
				rows,
				templateRows,
				auto,
				minColumnWidth,
				autoFill,
				fill,
				gap,
				rowGap,
				columnGap,
				autoRows,
				autoColumns,
				autoFlow: resolvedAutoFlow,
				align,
				alignItems,
				justifyItems,
				alignContent,
				justify,
				justifyContent,
				placeItems,
				placeContent,
				areas,
			}, style ) }
			{ ...props }
		>
			{ children }
		</Component>
	);
} );

Grid.Item = GridItem;

export { Grid, GridItem };
