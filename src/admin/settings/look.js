/**
 * The Look editor's logic that does not draw: which controls a group shows,
 * what a control holds for a device, and the look with one value changed.
 *
 * The values are the server's (`Look`): a colour, a choice or a font is a
 * string, a toggle is `true`, a control per device holds `{ desktop, tablet,
 * mobile }`, a border and a typography an object. A value that is not there
 * is the storefront's own, and a device without one takes the larger one's.
 */

export const DEVICES = [ 'desktop', 'tablet', 'mobile' ];

/** The preview's width of each device, the breakpoints the CSS is written at below it. */
export const DEVICE_WIDTHS = { desktop: 1280, tablet: 768, mobile: 390 };

/**
 * The states a group's controls are in, in the order the editor shows them.
 *
 * @param {Object} group A group of the schema (`Look_Schema`).
 * @return {string[]} `normal` and whichever of `hover`, `active` and `focus` it has.
 */
export const statesOf = ( group ) => {
	const found = new Set( ( group?.controls || [] ).map( ( control ) => control.state || 'normal' ) );

	return [ 'normal', 'hover', 'active', 'focus' ].filter( ( state ) => found.has( state ) );
};

/**
 * Whether a control applies to the search as it is set, e.g. the magnifier's
 * colours only where the search is shown as a magnifier.
 *
 * @param {Object} control
 * @param {Object} search The search settings.
 * @return {boolean} Whether to show it.
 */
export const applies = ( control, search ) =>
	Object.entries( control?.when || {} ).every( ( [ key, value ] ) => search?.[ key ] === value );

/**
 * The controls of a group to show in one state.
 *
 * @param {Object} group
 * @param {string} state
 * @param {Object} search
 * @return {Object[]} The controls.
 */
export const controlsIn = ( group, state, search ) =>
	( group?.controls || [] ).filter( ( control ) => ( control.state || 'normal' ) === state && applies( control, search ) );

/**
 * Whether a control writes a value per device.
 *
 * @param {Object} control
 * @return {boolean} Whether it does.
 */
export const isResponsive = ( control ) => Boolean( control?.responsive ) || 'spacing' === control?.type;

/**
 * What a control holds for a device, falling back to the larger devices';
 * `undefined` where none is set.
 *
 * @param {*}      value  The control's value in the look.
 * @param {string} device
 * @return {*} The value that applies.
 */
export const forDevice = ( value, device ) => {
	if ( null === value || undefined === value || 'object' !== typeof value || Array.isArray( value ) ) {
		return value;
	}

	for ( const one of DEVICES.slice( 0, DEVICES.indexOf( device ) + 1 ).reverse() ) {
		if ( undefined !== value[ one ] && null !== value[ one ] ) {
			return value[ one ];
		}
	}

	return undefined;
};

/**
 * Whether the device has a value of its own, not one it takes from a larger.
 *
 * @param {*}      value
 * @param {string} device
 * @return {boolean} Whether it has.
 */
export const hasOwn = ( value, device ) =>
	Boolean( value ) && 'object' === typeof value && ! Array.isArray( value ) && undefined !== value[ device ] && null !== value[ device ];

/**
 * A value per device with one device's changed; `undefined` takes it away,
 * and nothing left is no value at all.
 *
 * @param {*}      value  What the control holds now.
 * @param {string} device
 * @param {*}      next   The device's new value.
 * @return {Object|undefined} The control's new value.
 */
export const withDevice = ( value, device, next ) => {
	const current = value && 'object' === typeof value && ! Array.isArray( value ) ? { ...value } : {};

	if ( undefined === next || null === next || '' === next ) {
		delete current[ device ];
	} else {
		current[ device ] = next;
	}

	return Object.keys( current ).length > 0 ? current : undefined;
};

/**
 * The look with one control's value changed, or taken away.
 *
 * @param {Object} look
 * @param {string} id
 * @param {*}      value `undefined`, `null`, '' or an empty object take it away.
 * @return {Object} The new look.
 */
export const withValue = ( look, id, value ) => {
	const next = { ...( look || {} ) };
	const empty = undefined === value || null === value || '' === value || false === value ||
		( 'object' === typeof value && ! Array.isArray( value ) && 0 === Object.keys( value ).length );

	if ( empty ) {
		delete next[ id ];
	} else {
		next[ id ] = value;
	}

	return next;
};

/**
 * How many settings a group has that are set: the number on its title.
 *
 * @param {Object} group
 * @param {Object} look
 * @return {number} The count.
 */
export const setInGroup = ( group, look ) =>
	( group?.controls || [] ).filter( ( control ) => undefined !== look?.[ control.id ] ).length;

/**
 * The fonts to offer: the site's own first, then Google's that the site does
 * not have, each once.
 *
 * @param {{site?: string[], google?: string[]}} fonts From the endpoint.
 * @return {{value: string, label: string, google: boolean}[]} The options.
 */
export const fontOptions = ( fonts ) => {
	const site = Array.isArray( fonts?.site ) ? fonts.site : [];
	const google = ( Array.isArray( fonts?.google ) ? fonts.google : [] ).filter( ( family ) => ! site.includes( family ) );

	return [
		...site.map( ( family ) => ( { value: family, label: family, google: false } ) ),
		...google.map( ( family ) => ( { value: family, label: family, google: true } ) ),
	];
};
