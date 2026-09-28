# Choosing a component

Loaded from `webhead-design-system` when the question is *which* component, or why a call that
looks right does nothing. `componentStatus` moves between releases — re-extract it from the
Storybook rather than trusting this list once it is more than a release old.

## Move these — not-recommended, and the replacement is green

| do not use | use instead |
|---|---|
| `TextControl`, `InputControl`, `NumberControl` | `InputControl` from `@wordpress/ui` (`type="number"` for numbers) |
| `TextareaControl` | `TextareaControl` from `@wordpress/ui` |
| `BaseControl` | `Field` from `@wordpress/ui`; `Fieldset` + `Fieldset.Legend` for a group |
| `Card` and its subcomponents | `Card` or `CollapsibleCard` from `@wordpress/ui` |
| `TabPanel` | `Tabs` from `@wordpress/ui` |
| `Heading`, `Text` | `Text` from `@wordpress/ui`, `render` for the element, `variant` for the size |
| `Spinner` | `Spinner` from `@wordpress/ui` |
| `Tooltip` | `Tooltip` from `@wordpress/ui` |
| `VisuallyHidden` | `VisuallyHidden` from `@wordpress/ui` |
| `HStack`, `VStack`, `Flex` | `Stack` from `@wordpress/ui`, or your own CSS |
| `ExternalLink` | `Link` from `@wordpress/ui` with `openInNewTab` |
| `Elevation` | the elevation SASS variables — see below |
| `Animate` | your own CSS animation on the motion tokens |
| `Divider`, `Grid`, `Spacer`, `ZStack`, `View`, `Scrollable`, `Surface` | deprecation planned — write your own CSS |

## Keep these on `@wordpress/components`

`Button`, `Notice`, `ConfirmDialog`, `Popover`, `Dropdown`, `Snackbar`, `ProgressBar`,

> `Modal` is deliberately absent: use the house modal below. `ConfirmDialog` stays, because the
> undoable case wants its standard two-button shape.

`CheckboxControl`, `SelectControl`, `RadioControl`, `RangeControl`, `SearchControl`,
`ToggleControl`, `ToggleGroupControl`, `ComboboxControl`, `FormTokenField`, `UnitControl`,
`DropZone`, `FormFileUpload`, and the colour pickers. `PanelBody` stays, but **only** in the block
inspector — for collapsible sections elsewhere use `CollapsibleCard`.

Many carry "will be superseded by X in `@wordpress/ui`, but continue using for now". That is
upstream saying the migration is not ready. Do not front-run it.

## Props that look right and silently do nothing

Every one of these was written the obvious way first and failed without an error:

- **`Stack`'s `gap` takes a token, not a number** — `'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'`.
  `gap={ 3 }` produces no gap.
- **`Stack`'s `wrap` is a `flex-wrap` string, not a boolean.** `wrap="wrap"`. Writing bare `wrap`
  passes `true`, which is not a valid CSS value, so nothing wraps and content overflows its card.
- **`ToggleControl` ignores `hideLabelFromVision`** — it renders its own label rather than
  `BaseControl`'s. Hide it with CSS if the surrounding heading already names the switch.
- **`Badge`'s `intent` values** are `none | stable | draft | informational | low | medium | high`,
  not status words. `intent="success"` is not one of them.
- **`ToggleGroupControl` is exported as `__experimentalToggleGroupControl`.** The plain name is
  `undefined`, which React reports only as the minified error #130.
- **The `@wordpress/ui` controls take `onValueChange`, not `onChange`.** A field wired with
  `onChange` renders perfectly and never updates.
