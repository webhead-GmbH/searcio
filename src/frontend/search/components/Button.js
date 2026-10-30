import { Icon, Tooltip } from '@wordpress/components';

/**
 * A button of the storefront, drawn by this plugin's stylesheet alone.
 *
 * `Button` of `@wordpress/components` carries `.components-button`, the class
 * WooCommerce's Cart and Checkout blocks are built with, so a theme styles it:
 * Miniture writes `.components-button { color: #fff !important }`, and every
 * icon of the search window went white on white, whatever its widget said. No
 * weight in this plugin's stylesheet beats a site's `!important`, so these
 * buttons do not carry the class. What a site writes for `button` is taken off
 * them by the rule of `style.scss` that does so for every `whsc-` element.
 *
 * Takes the props of the package's button that this surface uses.
 *
 * @param {Object}  props
 * @param {*}       [props.icon]        An icon, or an element that holds one.
 * @param {string}  [props.label]       The accessible name of an icon-only button.
 * @param {boolean} [props.showTooltip] Whether `label` also shows as a tooltip.
 * @param {boolean} [props.isPressed]   The state of a toggle.
 * @param {string}  [props.className]
 * @param {string}  [props.type]
 * @param {*}       [props.children]
 */
const Button = ( { icon, label, showTooltip = false, isPressed, className = '', type = 'button', children, ...props } ) => {
	const button = (
		<button
			{ ...props }
			// eslint-disable-next-line react/button-has-type -- `submit` for the assistant's form, `button` otherwise.
			type={ type }
			className={ `whsc-control ${ className }${ isPressed ? ' is-pressed' : '' }`.trim() }
			aria-label={ label }
			aria-pressed={ isPressed }
		>
			{ icon && <Icon icon={ icon } /> }
			{ children }
		</button>
	);

	return showTooltip && label ? <Tooltip text={ label }>{ button }</Tooltip> : button;
};

export default Button;
