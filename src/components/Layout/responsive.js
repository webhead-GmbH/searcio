// Webhead scaffold managed file. scaffold:update may refresh this file.

const BREAKPOINT_SUFFIXES = {
	sm: 'sm',
	md: 'md',
	lg: 'lg',
	xl: 'xl',
};

const isPlainObject = ( value ) => (
	value !== null &&
	typeof value === 'object' &&
	! Array.isArray( value )
);

export const toCssValue = ( value ) => {
	if ( value === undefined || value === null || value === '' ) {
		return undefined;
	}

	if ( typeof value === 'number' ) {
		return `${ value }px`;
	}

	return String( value );
};

export const setResponsiveVar = ( style, name, value, formatter = toCssValue ) => {
	if ( value === undefined || value === null ) {
		return style;
	}

	if ( isPlainObject( value ) ) {
		Object.entries( value ).forEach( ( [ breakpoint, breakpointValue ] ) => {
			const suffix = breakpoint === 'base' ? '' : `-${ BREAKPOINT_SUFFIXES[ breakpoint ] || breakpoint }`;
			const formatted = formatter( breakpointValue );

			if ( formatted !== undefined ) {
				style[ `--${ name }${ suffix }` ] = formatted;
			}
		} );

		return style;
	}

	const formatted = formatter( value );

	if ( formatted !== undefined ) {
		style[ `--${ name }` ] = formatted;
	}

	return style;
};

export const cx = ( ...classes ) => classes.filter( Boolean ).join( ' ' );
