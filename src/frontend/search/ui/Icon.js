import { cloneElement, createElement, isValidElement } from '@wordpress/element';
import { SVG } from '@wordpress/primitives';

/**
 * Renders an icon of `@wordpress/icons` at a size.
 *
 * The storefront drew its icons with `Icon` of `@wordpress/components`, which
 * brought that package, with the date library and the rich-text editor behind
 * it (more than a megabyte of JavaScript on every page that has a search
 * trigger), for what is a `cloneElement`. This does what that one does for
 * the icons the storefront uses: an element of the `SVG` primitive or an
 * `svg`, or a component, at a size of 24 unless it is given another.
 *
 * @param {Object}                          props
 * @param {*}                               props.icon Element, or component, of `@wordpress/icons`.
 * @param {number}                          [props.size=24]
 */
const Icon = ( { icon = null, size = 24, ...additionalProps } ) => {
	if ( 'function' === typeof icon ) {
		return createElement( icon, { size, ...additionalProps } );
	}

	if ( isValidElement( icon ) ) {
		const { style: consumerStyle, ...restProps } = additionalProps;
		const style = icon.props.style || consumerStyle ? { ...icon.props.style, ...consumerStyle } : undefined;
		const styleProps = style ? { style } : {};

		if ( 'svg' === icon.type || SVG === icon.type ) {
			return <SVG { ...icon.props } width={ size } height={ size } { ...restProps } { ...styleProps } />;
		}

		return cloneElement( icon, { size, width: size, height: size, ...restProps, ...styleProps } );
	}

	return icon;
};

export default Icon;
