# Choosing a component

Loaded from `webhead-design-system` when the question is *which* component, or why a call that
looks right does nothing. `componentStatus` moves between releases — re-extract it from the
Storybook rather than trusting this list once it is more than a release old.

Snapshot: 2026-10-03, `@wordpress/components` 41 and `@wordpress/ui` 0.23. `Notice`,
`InputControl`, `SelectControl`, `CheckboxControl`, `Text` and `Flex` were on the "keep" list one
snapshot earlier, so code written before then may still import them from `@wordpress/components`.

## Move these — not-recommended, and the replacement is green

| do not use | use instead |
|---|---|
| `TextControl`, `InputControl`, `NumberControl` | `InputControl` from `@wordpress/ui` (`type="number"` for numbers) |
| `TextareaControl` | `TextareaControl` from `@wordpress/ui` |
| `SelectControl` | `SelectControl` from `@wordpress/ui` |
| `CheckboxControl` | `CheckboxControl` from `@wordpress/ui` |
| `BaseControl` | `Field` from `@wordpress/ui`; `Fieldset` + `Fieldset.Legend` for a group |
| `Notice` | `Notice` from `@wordpress/ui` — `Notice.Root` with `intent`, see below |
| `Card` and its subcomponents | `Card` or `CollapsibleCard` from `@wordpress/ui` |
| `TabPanel`, `Tabs` | `Tabs` from `@wordpress/ui` |
| `Heading`, `Text` | `Text` from `@wordpress/ui`, `render` for the element, `variant` for the size |
| `Spinner` | `Spinner` from `@wordpress/ui` |
| `Tooltip` | `Tooltip` from `@wordpress/ui` |
| `Badge` | `Badge` from `@wordpress/ui` |
| `VisuallyHidden` | `VisuallyHidden` from `@wordpress/ui` |
| `HStack`, `VStack`, `Flex` | `Stack` from `@wordpress/ui`, or `src/components/Layout` |
| `ExternalLink` | `Link` from `@wordpress/ui` with `openInNewTab` |
| `Icon` (for SVGs) | `Icon` from `@wordpress/ui` |
| `Elevation` | the elevation SASS variables — see `tokens.md` |
| `Animate` | your own CSS animation on the motion tokens |
| `ResponsiveWrapper` | the CSS `aspect-ratio` property |
| `Divider`, `Grid`, `Spacer`, `ZStack`, `View`, `Scrollable`, `Surface` | deprecated or planned for it — write your own CSS |

## Keep these on `@wordpress/components`

They are recommended there, and their `@wordpress/ui` counterpart is missing or use-with-caution:

`Button`, `ConfirmDialog`, `Popover`, `Dropdown`, `Snackbar`, `ProgressBar`,

> `Modal` is deliberately absent: use the house modal. `ConfirmDialog` stays, because the
> undoable case wants its standard two-button shape.

`ToggleControl`, `RadioControl`, `RangeControl`, `SearchControl`, `ToggleGroupControl`,
`ComboboxControl`, `CustomSelectControl`, `FormTokenField`, `UnitControl`, `DropZone`,
`FormFileUpload`, `MenuGroup`, `MenuItem`, and the colour pickers. `PanelBody` stays, but **only**
in the block inspector — for collapsible sections elsewhere use `CollapsibleCard`.

**Not yet, from `@wordpress/ui`:** `Button`, `LinkButton`, `IconButton`, `AlertDialog`, `Dialog`,
`Drawer`, `Popover`, `Menu`, `Breadcrumb`, `SwitchControl`, `Radio`, `RadioGroup`, `Combobox`,
`SearchableSelect`, and the `Validated*` controls. They are use-with-caution, nearly all because
they are "not yet recommended for use alongside components from `@wordpress/components`". That is
why a switch is still `ToggleControl` and a button is still `Button` from `@wordpress/components`.

Many of the kept components carry "will be superseded by X in `@wordpress/ui`, but continue using
for now". That is upstream saying the migration is not ready. Do not front-run it.

**The two packages take their colour from different places, and the stylesheet makes them
agree.** Black is the brand: every control, fill and button. Green is for focus and for links.
A `@wordpress/ui` control reads the tokens the theme provider works out from the `primary` it is
given, `#101010`. A `@wordpress/components` control reads `--wp-components-color-accent`, which
`default.scss` sets to the same black. For a black brand the provider's darkest fill is `#2d2d2d`
and its focus ring is the brand, so `default.scss` also sets the fill tokens, and the ring and
label of an outlined control, to that black, and the focus ring and the links to the green. A checked `CheckboxControl`, a `ToggleControl` and a primary
button are one colour. If you see a control that is not, do not set another `--wpds-*` or
`--wp-components-*` property: say that you saw it, and let the person decide.

## `Notice` from `@wordpress/ui`

```jsx
<Notice.Root intent="error">
    <Notice.Title>{ __( 'Settings were not saved', 'webhead-search-cloud' ) }</Notice.Title>
    <Notice.Description>{ reason }</Notice.Description>
    <Notice.Actions>
        <Notice.ActionButton onClick={ retry }>{ __( 'Try again', 'webhead-search-cloud' ) }</Notice.ActionButton>
    </Notice.Actions>
    <Notice.CloseIcon onClick={ dismiss } />
</Notice.Root>
```

- **`intent`, not `status`** — `neutral | info | warning | success | error`.
- **No `isDismissible`, no `onRemove`, no `actions` prop.** It can be closed when it holds a
  `Notice.CloseIcon`; actions are `Notice.ActionButton` and `Notice.ActionLink` inside
  `Notice.Actions`; text goes in `Notice.Title` and `Notice.Description`.
- **It announces itself at 0.23**, assertively for `intent="error"`. Do not add a live region or a
  `speak()` beside it. A later release moves that to the caller; `patterns.md` says how to tell.

## The Storybook is ahead of the package

The Storybook documents Gutenberg's trunk. There `LinkButton` is `ButtonLink`, `Notice.CloseIcon`
is `Notice.CloseIconButton`, and `Progress` exists; `@wordpress/ui` 0.23 has none of those names.
A name the package does not export is `undefined`, which React reports only as the minified error
#130. Take the rule from the Storybook and the name from
`node_modules/@wordpress/ui/build-types/index.d.ts`.

## Props that look right and silently do nothing

Every one of these was written the obvious way first and failed without an error:

- **`Stack`'s `gap` takes a token, not a number** — `'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'`.
  `gap={ 3 }` produces no gap.
- **`Stack`'s `wrap` is a `flex-wrap` string, not a boolean.** `wrap="wrap"`. Writing bare `wrap`
  passes `true`, which is not a valid CSS value, so nothing wraps and content overflows its card.
- **`Card.Content` does not space its children.** Two elements in it touch. Put them in a
  `Stack direction="column"` with a `gap`.
- **`ToggleControl` ignores `hideLabelFromVision`** — it renders its own label rather than
  `BaseControl`'s. Hide it with CSS if the surrounding heading already names the switch.
- **`Badge`'s `intent` values** are `none | stable | draft | informational | low | medium | high`,
  not status words. `intent="success"` is not one of them. A badge holds text, never an icon.
- **`ToggleGroupControl` is exported as `__experimentalToggleGroupControl`.** The plain name is
  `undefined`, which React reports only as the minified error #130.
- **No `@wordpress/ui` control takes `onChange`, and they do not all take the same thing.**
  `InputControl`, `TextareaControl`, `SelectControl` and `RadioGroupControl` take `value` and
  `onValueChange`. `CheckboxControl` and `SwitchControl` take `checked` and `onCheckedChange`. A
  control wired with the wrong one renders perfectly and never updates.
- **`SelectControl` takes `items`**, an array of `{ value, label }`, not `options`.
- **`EmptyState.Root` centres what is in it, not itself.** It is at most 320px wide and sits where
  its parent puts it, which in a page is the left edge. Put it in
  `<Stack direction="column" align="center">`. Given to DataViews through `empty`, the table
  centres it.
- **`ConfirmDialog` shows no title.** Its `title` names the dialog for assistive technology and is
  not drawn, so the question goes in the body.
- **`ProgressBar` is 160px wide whatever holds it.** Give it a class of yours for another width.
- **`Select.Item` children start with `ItemLabel`** since `@wordpress/ui` 0.23.
