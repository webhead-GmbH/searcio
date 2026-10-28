/**
 * Wiring for a `SelectControl` from `@wordpress/ui` whose choice is kept as a
 * string.
 *
 * The control gives each of its items the item itself as its value. It hands
 * the whole `{ value, label }` item to `onValueChange`, and it marks an item as
 * the chosen one only when `value` is that same object. Handed a string, the
 * trigger still finds the right label, so nothing looks wrong until a choice is
 * made and the item lands where the string belongs: a stored "[object Object]".
 */

/**
 * The `items`, `value` and `onValueChange` props for a select whose choice is
 * kept as a string. Spread them on the control, so the item it marks as chosen
 * is one of the items it draws.
 *
 * An empty or missing value is the item whose value is null, which the control
 * labels in place of its "Select" placeholder.
 *
 * @param {Array<{value: ?string, label: string}>} items    The options.
 * @param {?string}                                value    The stored choice.
 * @param {function(?string): void}                onChange Receives the value of the item picked.
 * @return {{items: Array, value: ?Object, onValueChange: function(?Object): void}} The props.
 */
export const selectProps = ( items, value, onChange ) => {
	const stored = '' === value || undefined === value ? null : value;

	return {
		items,
		value: items.find( ( item ) => item.value === stored ) ?? null,
		onValueChange: ( item ) => onChange( item?.value ?? null ),
	};
};
